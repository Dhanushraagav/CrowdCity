-- CrowdCity Schema Migration: Add 'verified' status constraint, suspension flags, and departments CRUD
-- Execute this SQL script in the Supabase SQL editor

-- ===================================================
-- 1. Update issue/history status constraints
-- ===================================================
-- Drop existing status check constraints
ALTER TABLE public.issues DROP CONSTRAINT IF EXISTS issues_status_check;
ALTER TABLE public.status_history DROP CONSTRAINT IF EXISTS status_history_status_check;

-- Add updated check constraints supporting the 'verified' status
ALTER TABLE public.issues 
  ADD CONSTRAINT issues_status_check 
  CHECK (status IN ('pending', 'assigned', 'in_progress', 'resolved', 'rejected', 'verified'));

ALTER TABLE public.status_history 
  ADD CONSTRAINT status_history_status_check 
  CHECK (status IN ('pending', 'assigned', 'in_progress', 'resolved', 'rejected', 'verified'));

COMMENT ON CONSTRAINT issues_status_check ON public.issues IS 'Ensures complaint lifecycle transitions conform to: pending -> assigned -> in_progress -> resolved -> verified (or rejected)';


-- ===================================================
-- 2. Create Departments table
-- ===================================================
CREATE TABLE IF NOT EXISTS public.departments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  description text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on public.departments
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- Departments Policies
CREATE POLICY "Departments are viewable by everyone" ON public.departments 
  FOR SELECT USING (true);

CREATE POLICY "Only Admin can manage departments" ON public.departments 
  FOR ALL USING (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );


-- ===================================================
-- 3. Add Suspension, Verification, and Department fields to Profiles
-- ===================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_suspended boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_verified_authority boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;


-- ===================================================
-- 4. Prepopulate Default Departments
-- ===================================================
INSERT INTO public.departments (name, code, description) VALUES
  ('Road Department', 'ROAD', 'Responsible for potholes, road damage, and sidewalks.'),
  ('Sanitation Department', 'SAN', 'Responsible for garbage collection, waste management, and littering.'),
  ('Water Department', 'WATER', 'Responsible for water leakages, pipeline bursts, and drainage blockages.'),
  ('Electrical Department', 'ELEC', 'Responsible for streetlight outages and electrical faults.')
ON CONFLICT (code) DO NOTHING;

-- ===================================================
-- 5. Add updated_at column to Profiles
-- ===================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL;

-- ===================================================
-- 6. Update Row Level Security Policies for Profiles
-- ===================================================
-- Drop old update policy if it exists
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated user may update own profile" ON public.profiles;

-- Create the new update policy with the exact name
CREATE POLICY "Authenticated user may update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Create the new insert policy to allow safe first sync
DROP POLICY IF EXISTS "Authenticated user may insert own profile" ON public.profiles;
CREATE POLICY "Authenticated user may insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);


-- ===================================================
-- 7. Add welcome_email_sent to Profiles
-- ===================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS welcome_email_sent boolean DEFAULT false;



