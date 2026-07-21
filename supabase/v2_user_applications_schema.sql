-- ====================================================================
-- CrowdCity AI v2.0 - Step 17: User Government Application Tracker Database Schema
-- Run in Supabase SQL Editor ("Run without RLS")
-- ====================================================================

-- 1. Create user_scheme_applications Table
CREATE TABLE IF NOT EXISTS public.user_scheme_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scheme_name VARCHAR(255) NOT NULL,
  department_name VARCHAR(255),
  application_ref_no VARCHAR(100) NOT NULL,
  submission_date DATE DEFAULT CURRENT_DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'Submitted',
  official_portal_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Indexes for fast query lookup
CREATE INDEX IF NOT EXISTS idx_user_scheme_apps_user_id ON public.user_scheme_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_scheme_apps_status ON public.user_scheme_applications(status);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.user_scheme_applications ENABLE ROW LEVEL SECURITY;

-- 4. RLS Security Policies
DROP POLICY IF EXISTS "Users can view own application tracker entries" ON public.user_scheme_applications;
CREATE POLICY "Users can view own application tracker entries"
  ON public.user_scheme_applications
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own application tracker entries" ON public.user_scheme_applications;
CREATE POLICY "Users can insert own application tracker entries"
  ON public.user_scheme_applications
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own application tracker entries" ON public.user_scheme_applications;
CREATE POLICY "Users can update own application tracker entries"
  ON public.user_scheme_applications
  FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own application tracker entries" ON public.user_scheme_applications;
CREATE POLICY "Users can delete own application tracker entries"
  ON public.user_scheme_applications
  FOR DELETE
  USING (auth.uid() = user_id);
