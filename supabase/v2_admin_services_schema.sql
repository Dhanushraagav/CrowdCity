-- ====================================================================
-- CrowdCity AI v2.0 - Step 20: Government Services Admin Portal Schema
-- Run in Supabase SQL Editor ("Run without RLS")
-- ====================================================================

-- 1. Announcements Table
CREATE TABLE IF NOT EXISTS public.v2_scheme_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  department VARCHAR(255),
  priority VARCHAR(50) DEFAULT 'Normal',
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. FAQs & Knowledge Base Table
CREATE TABLE IF NOT EXISTS public.v2_scheme_faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category VARCHAR(100),
  department VARCHAR(255),
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.v2_scheme_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_scheme_faqs ENABLE ROW LEVEL SECURITY;

-- Allow Public Read Access
DROP POLICY IF EXISTS "Public read access for announcements" ON public.v2_scheme_announcements;
CREATE POLICY "Public read access for announcements" ON public.v2_scheme_announcements FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read access for FAQs" ON public.v2_scheme_faqs;
CREATE POLICY "Public read access for FAQs" ON public.v2_scheme_faqs FOR SELECT USING (true);

-- Allow authenticated users to manage
DROP POLICY IF EXISTS "Auth insert announcements" ON public.v2_scheme_announcements;
CREATE POLICY "Auth insert announcements" ON public.v2_scheme_announcements FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth insert FAQs" ON public.v2_scheme_faqs;
CREATE POLICY "Auth insert FAQs" ON public.v2_scheme_faqs FOR INSERT WITH CHECK (auth.role() = 'authenticated');
