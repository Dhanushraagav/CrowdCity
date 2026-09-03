-- Migration: v7_global_civic_search.sql
-- Optimizes query performance for Global Civic Search

CREATE INDEX IF NOT EXISTS idx_issues_complaint_id ON public.issues (complaint_id);
CREATE INDEX IF NOT EXISTS idx_issues_category ON public.issues (category);
CREATE INDEX IF NOT EXISTS idx_issues_status ON public.issues (status);
CREATE INDEX IF NOT EXISTS idx_issues_district ON public.issues (district);
CREATE INDEX IF NOT EXISTS idx_issues_created_at_desc ON public.issues (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_issues_priority ON public.issues (priority);
CREATE INDEX IF NOT EXISTS idx_issues_department ON public.issues (department);
