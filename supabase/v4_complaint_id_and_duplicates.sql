-- ====================================================================
-- CrowdCity AI - Phase 4: Unique Complaint ID & Duplicate Complaint Master Migration
-- Execute this script in the Supabase SQL Editor
-- ====================================================================

-- 1. Create a dedicated sequence for Complaint IDs if it doesn't already exist
CREATE SEQUENCE IF NOT EXISTS public.complaint_id_seq START WITH 1 INCREMENT BY 1;

-- 2. Add complaint_id and citizen_count columns to issues table safely
ALTER TABLE public.issues 
  ADD COLUMN IF NOT EXISTS complaint_id VARCHAR(32),
  ADD COLUMN IF NOT EXISTS citizen_count INTEGER DEFAULT 1;

-- 3. Function to automatically generate dynamic CC-YYYY-NNNNNN Complaint ID
CREATE OR REPLACE FUNCTION public.generate_complaint_id()
RETURNS TRIGGER AS $$
DECLARE
  issue_year TEXT;
  seq_val BIGINT;
BEGIN
  -- Only generate if complaint_id is not already provided
  IF NEW.complaint_id IS NULL OR TRIM(NEW.complaint_id) = '' THEN
    issue_year := to_char(COALESCE(NEW.created_at, NOW()), 'YYYY');
    seq_val := nextval('public.complaint_id_seq');
    NEW.complaint_id := 'CC-' || issue_year || '-' || lpad(seq_val::text, 6, '0');
  END IF;

  -- Ensure citizen_count defaults to at least 1
  IF NEW.citizen_count IS NULL OR NEW.citizen_count < 1 THEN
    NEW.citizen_count := 1;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger on issues before insert
DROP TRIGGER IF EXISTS trg_generate_complaint_id ON public.issues;
CREATE TRIGGER trg_generate_complaint_id
  BEFORE INSERT ON public.issues
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_complaint_id();

-- 5. Backfill existing issues that lack complaint_id in chronological order
DO $$
DECLARE
  r RECORD;
  issue_year TEXT;
  seq_val BIGINT;
BEGIN
  FOR r IN SELECT id, created_at FROM public.issues WHERE complaint_id IS NULL OR complaint_id = '' ORDER BY created_at ASC LOOP
    issue_year := to_char(COALESCE(r.created_at, NOW()), 'YYYY');
    seq_val := nextval('public.complaint_id_seq');
    UPDATE public.issues 
    SET complaint_id = 'CC-' || issue_year || '-' || lpad(seq_val::text, 6, '0'),
        citizen_count = COALESCE(citizen_count, 1)
    WHERE id = r.id;
  END LOOP;
END $$;

-- 6. Enforce NOT NULL and UNIQUE constraint on complaint_id now that all rows are backfilled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'issues_complaint_id_key'
  ) THEN
    ALTER TABLE public.issues ALTER COLUMN complaint_id SET NOT NULL;
    ALTER TABLE public.issues ADD CONSTRAINT issues_complaint_id_key UNIQUE (complaint_id);
  END IF;
END $$;

-- Index for fast lookup by complaint_id
CREATE INDEX IF NOT EXISTS idx_issues_complaint_id ON public.issues(complaint_id);

-- Composite index for fast duplicate candidate lookup by category, status, and coordinates
CREATE INDEX IF NOT EXISTS idx_issues_geo_cat_status 
  ON public.issues(category, status, latitude, longitude)
  WHERE status IN ('pending', 'assigned', 'in_progress');


-- ====================================================================
-- 7. Master Complaint Supporting Reports Table
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.issue_supporting_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  citizen_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  citizen_name TEXT,
  citizen_email TEXT,
  comment TEXT,
  image_url TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT uq_issue_supporting_citizen UNIQUE (issue_id, citizen_id)
);

-- Index for fast lookup by issue_id and citizen_id
CREATE INDEX IF NOT EXISTS idx_supporting_reports_issue_id ON public.issue_supporting_reports(issue_id);
CREATE INDEX IF NOT EXISTS idx_supporting_reports_citizen_id ON public.issue_supporting_reports(citizen_id);

-- Enable RLS on issue_supporting_reports
ALTER TABLE public.issue_supporting_reports ENABLE ROW LEVEL SECURITY;

-- Supporting reports policies
DROP POLICY IF EXISTS "Supporting reports are viewable by everyone" ON public.issue_supporting_reports;
CREATE POLICY "Supporting reports are viewable by everyone" 
  ON public.issue_supporting_reports FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated citizens can insert own supporting reports" ON public.issue_supporting_reports;
CREATE POLICY "Authenticated citizens can insert own supporting reports" 
  ON public.issue_supporting_reports FOR INSERT WITH CHECK (auth.uid() = citizen_id);

DROP POLICY IF EXISTS "Citizens can update their own supporting reports" ON public.issue_supporting_reports;
CREATE POLICY "Citizens can update their own supporting reports" 
  ON public.issue_supporting_reports FOR UPDATE USING (auth.uid() = citizen_id) WITH CHECK (auth.uid() = citizen_id);

DROP POLICY IF EXISTS "Citizens or Admins can delete supporting reports" ON public.issue_supporting_reports;
CREATE POLICY "Citizens or Admins can delete supporting reports" 
  ON public.issue_supporting_reports FOR DELETE USING (
    auth.uid() = citizen_id OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );


-- ====================================================================
-- 8. Trigger to sync citizen_count on master complaint
-- ====================================================================

CREATE OR REPLACE FUNCTION public.sync_issue_citizen_count()
RETURNS TRIGGER AS $$
DECLARE
  target_issue_id UUID;
  distinct_citizens INTEGER;
BEGIN
  target_issue_id := COALESCE(NEW.issue_id, OLD.issue_id);

  -- Count distinct supporting citizens
  SELECT COUNT(DISTINCT citizen_id) INTO distinct_citizens
  FROM public.issue_supporting_reports
  WHERE issue_id = target_issue_id;

  -- Update master complaint: 1 (primary reporter) + count of supporting citizens
  UPDATE public.issues
  SET citizen_count = 1 + COALESCE(distinct_citizens, 0),
      updated_at = NOW()
  WHERE id = target_issue_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_issue_citizen_count ON public.issue_supporting_reports;
CREATE TRIGGER trg_sync_issue_citizen_count
  AFTER INSERT OR UPDATE OR DELETE ON public.issue_supporting_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_issue_citizen_count();
