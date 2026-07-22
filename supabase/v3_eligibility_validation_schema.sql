-- ============================================================================
-- CrowdCity AI v2.2.1 - Official Eligibility Validation & Confidence System Schema
-- Run in Supabase SQL Editor ("Run without RLS")
-- ============================================================================

-- 1. Add Official Metadata Columns to government_schemes
ALTER TABLE public.government_schemes 
  ADD COLUMN IF NOT EXISTS official_notification_number VARCHAR(150),
  ADD COLUMN IF NOT EXISTS official_pdf_link TEXT,
  ADD COLUMN IF NOT EXISTS last_verified_date DATE NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS data_source VARCHAR(150) DEFAULT 'Tamil Nadu Government';

-- 2. Create eligibility_audit_logs Table
CREATE TABLE IF NOT EXISTS public.eligibility_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id UUID NOT NULL REFERENCES public.government_schemes(id) ON DELETE CASCADE,
  previous_rule JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_rule JSONB NOT NULL DEFAULT '{}'::jsonb,
  administrator VARCHAR(255) NOT NULL DEFAULT 'Admin',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason_for_change TEXT NOT NULL DEFAULT 'Routine configuration update'
);

-- Index for fast audit queries
CREATE INDEX IF NOT EXISTS idx_eligibility_audit_scheme ON public.eligibility_audit_logs(scheme_id);

-- Enable RLS on audit logs
ALTER TABLE public.eligibility_audit_logs ENABLE ROW LEVEL SECURITY;

-- Select policies for audit logs
CREATE POLICY "Allow public read access for audit logs" 
  ON public.eligibility_audit_logs FOR SELECT USING (true);

-- Insert policies for audit logs
CREATE POLICY "Allow authenticated insert for audit logs" 
  ON public.eligibility_audit_logs FOR INSERT WITH CHECK (true);

-- 3. Seed Metadata details for the 12 welfare schemes
UPDATE public.government_schemes
SET 
  official_notification_number = 'G.O. (Ms) No. 25',
  official_pdf_link = 'https://www.tn.gov.in/go_view/dept/30',
  last_verified_date = '2026-07-01',
  data_source = 'Tamil Nadu Government'
WHERE scheme_code = 'TN-KMUT-001';

UPDATE public.government_schemes
SET 
  official_notification_number = 'G.O. (Ms) No. 42',
  official_pdf_link = 'https://www.pudhumapenn.tn.gov.in',
  last_verified_date = '2026-07-05',
  data_source = 'Tamil Nadu Government'
WHERE scheme_code = 'TN-PUDHUMAI-002';

UPDATE public.government_schemes
SET 
  official_notification_number = 'G.O. (Ms) No. 12',
  official_pdf_link = 'https://www.naanmudhalvan.tn.gov.in',
  last_verified_date = '2026-06-15',
  data_source = 'TNSDC'
WHERE scheme_code = 'TN-NM-003';

UPDATE public.government_schemes
SET 
  official_notification_number = 'G.O. (Ms) No. 169',
  official_pdf_link = 'https://www.cmchistn.com',
  last_verified_date = '2026-07-10',
  data_source = 'Tamil Nadu Government'
WHERE scheme_code = 'TN-CMCHIS-004';

UPDATE public.government_schemes
SET 
  official_notification_number = 'G.O. (Ms) No. 89',
  official_pdf_link = 'https://tnrd.tn.gov.in',
  last_verified_date = '2026-07-20',
  data_source = 'Tamil Nadu Government'
WHERE scheme_code = 'TN-KKI-005';

UPDATE public.government_schemes
SET 
  official_notification_number = 'G.O. (Ms) No. 456',
  official_pdf_link = 'https://www.tn.gov.in',
  last_verified_date = '2026-05-10',
  data_source = 'Tamil Nadu Government'
WHERE scheme_code = 'TN-UZHAVAR-006';

UPDATE public.government_schemes
SET 
  official_notification_number = 'Notification No. 1-1/2018-Credit',
  official_pdf_link = 'https://pmkisan.gov.in',
  last_verified_date = '2026-07-15',
  data_source = 'Government of India'
WHERE scheme_code = 'CENTRAL-PMKISAN-007';

UPDATE public.government_schemes
SET 
  official_notification_number = 'Notification No. S.O. 3122(E)',
  official_pdf_link = 'https://pmjay.gov.in',
  last_verified_date = '2026-07-02',
  data_source = 'Government of India'
WHERE scheme_code = 'CENTRAL-PMJAY-008';

UPDATE public.government_schemes
SET 
  official_notification_number = 'Mudra Guidelines 2015',
  official_pdf_link = 'https://www.mudra.org.in',
  last_verified_date = '2026-04-18',
  data_source = 'Government of India'
WHERE scheme_code = 'CENTRAL-PMMY-009';

UPDATE public.government_schemes
SET 
  official_notification_number = 'Notification G.S.R. 914(E)',
  official_pdf_link = 'https://www.indiapost.gov.in',
  last_verified_date = '2026-07-08',
  data_source = 'Government of India'
WHERE scheme_code = 'CENTRAL-SSY-010';

UPDATE public.government_schemes
SET 
  official_notification_number = 'PMAY Urban Guidelines 2015',
  official_pdf_link = 'https://pmaymis.gov.in',
  last_verified_date = '2026-06-20',
  data_source = 'Government of India'
WHERE scheme_code = 'CENTRAL-PMAY-011';

UPDATE public.government_schemes
SET 
  official_notification_number = 'Vidya Lakshmi Scheme 2015',
  official_pdf_link = 'https://www.vidyalakshmi.co.in',
  last_verified_date = '2026-07-12',
  data_source = 'Government of India'
WHERE scheme_code = 'CENTRAL-VIDYALAKSHMI-012';
