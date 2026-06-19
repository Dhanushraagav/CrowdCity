-- CrowdCity Complete Database Schema & Migration Setup
-- Paste this script directly into your Supabase SQL Editor to initialize all tables, constraints, triggers, indexes, views, and RLS policies.

-- ===================================================
-- 1. Create Departments Table
-- ===================================================
CREATE TABLE IF NOT EXISTS public.departments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  description text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ===================================================
-- 2. Create Profiles Table (Tied to Supabase Auth)
-- ===================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name text,
  avatar_url text,
  role text DEFAULT 'citizen' CHECK (role IN ('citizen', 'authority', 'admin')),
  points integer DEFAULT 0,
  is_suspended boolean DEFAULT false,
  is_verified_authority boolean DEFAULT false,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ===================================================
-- 3. Create Users View (For prompt name compatibility)
-- ===================================================
CREATE OR REPLACE VIEW public.users WITH (security_invoker = true) AS
SELECT 
  p.id,
  u.email,
  p.full_name,
  p.avatar_url,
  p.role,
  p.points,
  p.created_at
FROM public.profiles p
LEFT JOIN auth.users u ON p.id = u.id;

-- ===================================================
-- 4. Create Issues Table
-- ===================================================
CREATE TABLE IF NOT EXISTS public.issues (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL, -- Prompts compatibility column
  title text NOT NULL,
  description text NOT NULL,
  category text not null CHECK (category IN ('roads', 'streetlights', 'water_supply', 'drainage', 'garbage', 'traffic', 'public_property', 'parks', 'sanitation', 'safety_hazard', 'environment', 'other')),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'resolved', 'rejected', 'verified')),
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  address text,
  image_url text,
  priority text, -- Prompts priority column
  department text, -- Prompts department column
  ai_summary text,
  ai_category text,
  ai_priority text CHECK (ai_priority IN ('low', 'medium', 'high', 'critical')),
  ai_department text,
  upvotes_count integer DEFAULT 0,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  completion_proof_url text,
  completion_notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ===================================================
-- 5. Create Comments Table
-- ===================================================
CREATE TABLE IF NOT EXISTS public.comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_id uuid REFERENCES public.issues(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  comment_text text, -- Codebase text column
  comment text, -- Prompts text column
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ===================================================
-- 6. Create Votes Table
-- ===================================================
CREATE TABLE IF NOT EXISTS public.votes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  issue_id uuid REFERENCES public.issues(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, issue_id)
);

-- ===================================================
-- 7. Create Notifications Table
-- ===================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text CHECK (type IN ('status_change', 'assignment', 'other')),
  issue_id uuid REFERENCES public.issues(id) ON DELETE CASCADE,
  is_read boolean DEFAULT false NOT NULL, -- Codebase read flag
  read boolean DEFAULT false NOT NULL, -- Prompts read flag
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ===================================================
-- 8. Create Status History Table
-- ===================================================
CREATE TABLE IF NOT EXISTS public.status_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_id uuid REFERENCES public.issues(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'assigned', 'in_progress', 'resolved', 'rejected', 'verified')),
  notes text, -- Codebase remarks column
  remarks text, -- Prompts remarks column
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ===================================================
-- 9. Create Leaderboard View (Dynamically Evaluated)
-- ===================================================
CREATE OR REPLACE VIEW public.leaderboard WITH (security_invoker = true) AS
SELECT
  p.id,
  p.id AS user_id,
  p.points,
  row_number() OVER (ORDER BY p.points DESC) AS rank
FROM public.profiles p
WHERE p.role = 'citizen';

-- ===================================================
-- 10. Create User Badges & Achievements View
-- ===================================================
CREATE TABLE IF NOT EXISTS public.user_badges (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  badge_type text NOT NULL,
  badge_name text NOT NULL,
  badge_description text NOT NULL,
  badge_icon text NOT NULL,
  awarded_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, badge_type)
);

CREATE OR REPLACE VIEW public.achievements WITH (security_invoker = true) AS
SELECT 
  id,
  user_id,
  badge_type AS achievement_type,
  badge_name AS title,
  badge_description AS description,
  badge_icon AS icon,
  awarded_at AS created_at
FROM public.user_badges;


-- ===================================================
-- 11. Column Synchronization Triggers
-- ===================================================

-- Trigger: Synchronize Issues reporter_id & user_id
CREATE OR REPLACE FUNCTION public.sync_issue_ids_fn()
RETURNS trigger AS $$
BEGIN
  IF NEW.reporter_id IS NOT NULL AND NEW.user_id IS NULL THEN
    NEW.user_id := NEW.reporter_id;
  ELSIF NEW.user_id IS NOT NULL AND NEW.reporter_id IS NULL THEN
    NEW.reporter_id := NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER on_issue_ids_sync
  BEFORE INSERT OR UPDATE ON public.issues
  FOR EACH ROW EXECUTE PROCEDURE public.sync_issue_ids_fn();

-- Trigger: Synchronize Comments comment_text & comment
CREATE OR REPLACE FUNCTION public.sync_comment_text_fn()
RETURNS trigger AS $$
BEGIN
  IF NEW.comment_text IS NOT NULL AND NEW.comment IS NULL THEN
    NEW.comment := NEW.comment_text;
  ELSIF NEW.comment IS NOT NULL AND NEW.comment_text IS NULL THEN
    NEW.comment_text := NEW.comment;
  ELSIF NEW.comment_text IS NULL AND NEW.comment IS NULL THEN
    NEW.comment_text := '';
    NEW.comment := '';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER on_comment_text_sync
  BEFORE INSERT OR UPDATE ON public.comments
  FOR EACH ROW EXECUTE PROCEDURE public.sync_comment_text_fn();

-- Trigger: Synchronize Notifications is_read & read
CREATE OR REPLACE FUNCTION public.sync_notification_read_fn()
RETURNS trigger AS $$
BEGIN
  IF NEW.is_read IS NOT NULL AND NEW.read IS NULL THEN
    NEW.read := NEW.is_read;
  ELSIF NEW.read IS NOT NULL AND NEW.is_read IS NULL THEN
    NEW.is_read := NEW.read;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER on_notification_read_sync
  BEFORE INSERT OR UPDATE ON public.notifications
  FOR EACH ROW EXECUTE PROCEDURE public.sync_notification_read_fn();

-- Trigger: Synchronize Status History notes & remarks
CREATE OR REPLACE FUNCTION public.sync_status_remarks_fn()
RETURNS trigger AS $$
BEGIN
  IF NEW.notes IS NOT NULL AND NEW.remarks IS NULL THEN
    NEW.remarks := NEW.notes;
  ELSIF NEW.remarks IS NOT NULL AND NEW.notes IS NULL THEN
    NEW.notes := NEW.remarks;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER on_status_remarks_sync
  BEFORE INSERT OR UPDATE ON public.status_history
  FOR EACH ROW EXECUTE PROCEDURE public.sync_status_remarks_fn();

-- Trigger: Auto-increment issue upvotes_count on vote insert
CREATE OR REPLACE FUNCTION public.handle_vote_insert()
RETURNS trigger AS $$
BEGIN
  UPDATE public.issues
  SET upvotes_count = upvotes_count + 1
  WHERE id = NEW.issue_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_vote_inserted
  AFTER INSERT ON public.votes
  FOR EACH ROW EXECUTE PROCEDURE public.handle_vote_insert();

-- Trigger: Auto-decrement issue upvotes_count on vote delete
CREATE OR REPLACE FUNCTION public.handle_vote_delete()
RETURNS trigger AS $$
BEGIN
  UPDATE public.issues
  SET upvotes_count = greatest(0, upvotes_count - 1)
  WHERE id = OLD.issue_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_vote_deleted
  AFTER DELETE ON public.votes
  FOR EACH ROW EXECUTE PROCEDURE public.handle_vote_delete();

-- Trigger: Auto-create public profile when new Auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'Citizen'),
    coalesce(NEW.raw_user_meta_data->>'avatar_url', ''),
    'citizen'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- ===================================================
-- 12. Safe Points Increment Stored Procedure
-- ===================================================
CREATE OR REPLACE FUNCTION public.increment_profile_points(user_id uuid, amount integer)
RETURNS void as $$
BEGIN
  UPDATE public.profiles
  SET points = coalesce(points, 0) + amount
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ===================================================
-- 13. Optimize Performance Database Indexes
-- ===================================================
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_points ON public.profiles(points DESC);

CREATE INDEX IF NOT EXISTS idx_issues_reporter ON public.issues(reporter_id);
CREATE INDEX IF NOT EXISTS idx_issues_assigned ON public.issues(assigned_to);
CREATE INDEX IF NOT EXISTS idx_issues_status ON public.issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_category ON public.issues(category);
CREATE INDEX IF NOT EXISTS idx_issues_created ON public.issues(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_issues_upvotes ON public.issues(upvotes_count DESC);

CREATE INDEX IF NOT EXISTS idx_comments_issue ON public.comments(issue_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON public.comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_created ON public.comments(created_at ASC);

CREATE INDEX IF NOT EXISTS idx_votes_issue ON public.votes(issue_id);
CREATE INDEX IF NOT EXISTS idx_votes_user ON public.votes(user_id);

CREATE INDEX IF NOT EXISTS idx_status_history_issue ON public.status_history(issue_id);
CREATE INDEX IF NOT EXISTS idx_status_history_created ON public.status_history(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(is_read) WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_user_badges_user ON public.user_badges(user_id);


-- ===================================================
-- 14. Enable Row Level Security (RLS) & Policies
-- ===================================================

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- Policies: Departments
CREATE POLICY "Everyone can view departments" ON public.departments 
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage departments" ON public.departments 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Policies: Profiles
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Authenticated user may update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Authenticated user may insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Policies: Issues
CREATE POLICY "Issues are viewable by everyone" ON public.issues
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can submit complaints" ON public.issues
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Reporter, assigned authority, or admins can update issue records" ON public.issues
  FOR UPDATE USING (
    auth.uid() = reporter_id OR 
    auth.uid() = assigned_to OR
    (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() 
          AND profiles.role = 'authority' 
          AND profiles.is_verified_authority = true
      )
      AND (
        assigned_to IS NULL OR
        assigned_to = auth.uid()
      )
    ) OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    auth.uid() = reporter_id OR 
    auth.uid() = assigned_to OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Policies: Comments
CREATE POLICY "Comments are viewable by everyone" ON public.comments
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can post comments" ON public.comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Comment authors can update or delete comments" ON public.comments
  FOR ALL USING (auth.uid() = user_id);

-- Policies: Votes
CREATE POLICY "Votes are viewable by everyone" ON public.votes
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can cast upvotes" ON public.votes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can retract their upvotes" ON public.votes
  FOR DELETE USING (auth.uid() = user_id);

-- Policies: Notifications
CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Policies: Status History
CREATE POLICY "Status history logs are viewable by everyone" ON public.status_history
  FOR SELECT USING (true);

CREATE POLICY "Only authorities and admins can create status logs" ON public.status_history
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('authority', 'admin')
    )
  );

-- Policies: User Badges
CREATE POLICY "User badges are viewable by everyone" ON public.user_badges
  FOR SELECT USING (true);

CREATE POLICY "System definer context awards user badges" ON public.user_badges
  FOR INSERT WITH CHECK (auth.uid() = user_id);


-- ===================================================
-- 15. Prepopulate Default Departments
-- ===================================================
INSERT INTO public.departments (name, code, description) VALUES
  ('Road Department', 'ROAD', 'Responsible for potholes, road damage, and sidewalks.'),
  ('Sanitation Department', 'SAN', 'Responsible for garbage collection, waste management, and littering.'),
  ('Water Department', 'WATER', 'Responsible for water leakages, pipeline bursts, and drainage blockages.'),
  ('Electrical Department', 'ELEC', 'Responsible for streetlight outages and electrical faults.')
ON CONFLICT (code) DO NOTHING;
