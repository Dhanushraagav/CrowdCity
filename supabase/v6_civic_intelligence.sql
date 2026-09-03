-- ==============================================================================
-- CROWD CITY — TAMIL NADU 38-DISTRICT CIVIC INTELLIGENCE SCHEMA MIGRATION
-- Migration Version: v6_civic_intelligence.sql
-- ==============================================================================

-- 1. Add district column to issues table if not already present
ALTER TABLE public.issues 
ADD COLUMN IF NOT EXISTS district VARCHAR(100);

-- 2. Add performance index on district for fast state-wide and district queries
CREATE INDEX IF NOT EXISTS idx_issues_district ON public.issues(district);

-- 3. Composite indexes for high-speed multi-factor filtering
CREATE INDEX IF NOT EXISTS idx_issues_district_status ON public.issues(district, status);
CREATE INDEX IF NOT EXISTS idx_issues_category_status ON public.issues(category, status);
CREATE INDEX IF NOT EXISTS idx_issues_district_created ON public.issues(district, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_issues_created_at_desc ON public.issues(created_at DESC);

-- 4. Grant select permissions for public analytics
GRANT SELECT ON public.issues TO anon, authenticated;
