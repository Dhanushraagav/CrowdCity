-- CrowdCity Schema Migration: Chat, Withdrawal, Evidence Uploads
-- Execute this SQL script in the Supabase SQL editor

-- ===================================================
-- 1. Update issue/history status constraints to include 'withdrawn'
-- ===================================================
ALTER TABLE public.issues DROP CONSTRAINT IF EXISTS issues_status_check;
ALTER TABLE public.status_history DROP CONSTRAINT IF EXISTS status_history_status_check;

ALTER TABLE public.issues
  ADD CONSTRAINT issues_status_check
  CHECK (status IN ('pending', 'assigned', 'in_progress', 'resolved', 'rejected', 'verified', 'withdrawn'));

ALTER TABLE public.status_history
  ADD CONSTRAINT status_history_status_check
  CHECK (status IN ('pending', 'assigned', 'in_progress', 'resolved', 'rejected', 'verified', 'withdrawn'));

COMMENT ON CONSTRAINT issues_status_check ON public.issues IS 'Ensures complaint lifecycle transitions conform to: pending -> assigned -> in_progress -> resolved -> verified (or rejected/withdrawn)';


-- ===================================================
-- 2. Create Messages table (In-app chat between citizen and authority)
-- ===================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_id uuid REFERENCES public.issues(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  message_text text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on Messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Messages Policies:
-- Only the reporter and the assigned authority (or admin) can read messages for an issue
CREATE POLICY "Chat participants can view messages" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.issues
      WHERE issues.id = messages.issue_id
        AND (
          issues.reporter_id = auth.uid()
          OR issues.assigned_to = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
          )
        )
    )
  );

-- Only the reporter and assigned authority can send messages
CREATE POLICY "Chat participants can send messages" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.issues
      WHERE issues.id = messages.issue_id
        AND (
          issues.reporter_id = auth.uid()
          OR issues.assigned_to = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
          )
        )
    )
  );

-- Create index for fast message lookups per issue
CREATE INDEX IF NOT EXISTS idx_messages_issue_id ON public.messages(issue_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(issue_id, created_at);


-- ===================================================
-- 3. Create Issue Attachments table (Additional evidence uploads)
-- ===================================================
CREATE TABLE IF NOT EXISTS public.issue_attachments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_id uuid REFERENCES public.issues(id) ON DELETE CASCADE NOT NULL,
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  file_url text NOT NULL,
  file_name text,
  file_size integer,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on Issue Attachments
ALTER TABLE public.issue_attachments ENABLE ROW LEVEL SECURITY;

-- Attachments Policies
CREATE POLICY "Attachments are viewable by everyone" ON public.issue_attachments
  FOR SELECT USING (true);

CREATE POLICY "Reporter can upload attachments" ON public.issue_attachments
  FOR INSERT WITH CHECK (
    auth.uid() = uploaded_by
    AND EXISTS (
      SELECT 1 FROM public.issues
      WHERE issues.id = issue_attachments.issue_id
        AND issues.reporter_id = auth.uid()
    )
  );

-- Create index for fast attachment lookups per issue
CREATE INDEX IF NOT EXISTS idx_issue_attachments_issue_id ON public.issue_attachments(issue_id);


-- ===================================================
-- 4. Enable Supabase Realtime on Messages table for live chat
-- ===================================================
-- Note: This adds the messages table to the supabase_realtime publication
-- so that Supabase client can subscribe to INSERT events in real time.
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;


-- ===================================================
-- 5. Allow citizens to insert status_history for withdrawals
-- ===================================================
-- The existing policy only allows authority/admin inserts.
-- We need to also allow citizens to insert when withdrawing their own complaint.
CREATE POLICY "Citizens can log withdrawal status" ON public.status_history
  FOR INSERT WITH CHECK (
    auth.uid() = updated_by
    AND status = 'withdrawn'
    AND EXISTS (
      SELECT 1 FROM public.issues
      WHERE issues.id = status_history.issue_id
        AND issues.reporter_id = auth.uid()
    )
  );
