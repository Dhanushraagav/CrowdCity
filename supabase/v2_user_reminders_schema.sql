-- ====================================================================
-- CrowdCity AI v2.0 - Step 18: Smart Reminder Center Database Schema
-- Run in Supabase SQL Editor ("Run without RLS")
-- ====================================================================

-- 1. Create user_reminders Table
CREATE TABLE IF NOT EXISTS public.user_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'Government Application Follow-up',
  related_scheme VARCHAR(255),
  related_application_ref VARCHAR(100),
  reminder_date DATE NOT NULL,
  reminder_time TIME DEFAULT '09:00:00',
  repeat_frequency VARCHAR(50) DEFAULT 'None',
  priority VARCHAR(20) DEFAULT 'Medium',
  status VARCHAR(20) DEFAULT 'Upcoming',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Indexes for fast query lookup
CREATE INDEX IF NOT EXISTS idx_user_reminders_user_id ON public.user_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_user_reminders_date ON public.user_reminders(reminder_date);
CREATE INDEX IF NOT EXISTS idx_user_reminders_status ON public.user_reminders(status);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.user_reminders ENABLE ROW LEVEL SECURITY;

-- 4. RLS Security Policies
DROP POLICY IF EXISTS "Users can view own reminders" ON public.user_reminders;
CREATE POLICY "Users can view own reminders"
  ON public.user_reminders
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own reminders" ON public.user_reminders;
CREATE POLICY "Users can insert own reminders"
  ON public.user_reminders
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own reminders" ON public.user_reminders;
CREATE POLICY "Users can update own reminders"
  ON public.user_reminders
  FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own reminders" ON public.user_reminders;
CREATE POLICY "Users can delete own reminders"
  ON public.user_reminders
  FOR DELETE
  USING (auth.uid() = user_id);
