-- ============================================================================
-- CrowdCity AI v2.0 - Government Schemes Foundation Migration
-- Module: Government Scheme Eligibility Checker (Modular & Isolated)
-- ============================================================================

-- 1. Helper function for updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_v2_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- Table 1: scheme_categories
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scheme_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_name VARCHAR(150) NOT NULL UNIQUE,
  category_code VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  icon_name VARCHAR(100) DEFAULT 'fa-building-columns',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index on category_code for fast lookups
CREATE INDEX IF NOT EXISTS idx_scheme_categories_code ON public.scheme_categories(category_code);

-- ----------------------------------------------------------------------------
-- Table 2: government_schemes
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.government_schemes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.scheme_categories(id) ON DELETE SET NULL,
  scheme_name VARCHAR(255) NOT NULL,
  scheme_code VARCHAR(100) UNIQUE,
  department_name VARCHAR(255) NOT NULL,
  state_or_central VARCHAR(50) NOT NULL DEFAULT 'state', -- 'state', 'central', 'joint'
  short_description TEXT NOT NULL,
  detailed_description TEXT,
  eligibility_criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
  benefits_summary TEXT NOT NULL,
  required_documents JSONB DEFAULT '[]'::jsonb,
  official_portal_url TEXT,
  application_fee NUMERIC(10, 2) DEFAULT 0.00,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying & filtering
CREATE INDEX IF NOT EXISTS idx_government_schemes_category ON public.government_schemes(category_id);
CREATE INDEX IF NOT EXISTS idx_government_schemes_state_central ON public.government_schemes(state_or_central);
CREATE INDEX IF NOT EXISTS idx_government_schemes_is_active ON public.government_schemes(is_active);
CREATE INDEX IF NOT EXISTS idx_government_schemes_eligibility ON public.government_schemes USING gin (eligibility_criteria);

-- ----------------------------------------------------------------------------
-- Table 3: saved_schemes (User Bookmarks / Saved List)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.saved_schemes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scheme_id UUID NOT NULL REFERENCES public.government_schemes(id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_saved_scheme UNIQUE (user_id, scheme_id)
);

-- Indexes for bookmarks
CREATE INDEX IF NOT EXISTS idx_saved_schemes_user ON public.saved_schemes(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_schemes_scheme ON public.saved_schemes(scheme_id);

-- ----------------------------------------------------------------------------
-- Table 4: user_scheme_preferences (Demographic profile for matching)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_scheme_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  age INTEGER CHECK (age >= 0 AND age <= 120),
  gender VARCHAR(50),
  annual_income NUMERIC(12, 2),
  occupation VARCHAR(100),
  district VARCHAR(100),
  social_category VARCHAR(100),
  is_differently_abled BOOLEAN NOT NULL DEFAULT false,
  is_student BOOLEAN NOT NULL DEFAULT false,
  is_farmer BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index on user_id for preferences
CREATE INDEX IF NOT EXISTS idx_user_scheme_prefs_user ON public.user_scheme_preferences(user_id);

-- ----------------------------------------------------------------------------
-- Triggers for automatic updated_at
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_scheme_categories_updated_at ON public.scheme_categories;
CREATE TRIGGER trg_scheme_categories_updated_at
  BEFORE UPDATE ON public.scheme_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_v2_updated_at_column();

DROP TRIGGER IF EXISTS trg_government_schemes_updated_at ON public.government_schemes;
CREATE TRIGGER trg_government_schemes_updated_at
  BEFORE UPDATE ON public.government_schemes
  FOR EACH ROW EXECUTE FUNCTION public.update_v2_updated_at_column();

DROP TRIGGER IF EXISTS trg_user_scheme_prefs_updated_at ON public.user_scheme_preferences;
CREATE TRIGGER trg_user_scheme_prefs_updated_at
  BEFORE UPDATE ON public.user_scheme_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_v2_updated_at_column();

-- ----------------------------------------------------------------------------
-- Row Level Security (RLS) Policies
-- ----------------------------------------------------------------------------
ALTER TABLE public.scheme_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.government_schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_scheme_preferences ENABLE ROW LEVEL SECURITY;

-- Read policies for public/authenticated users for categories & schemes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'scheme_categories' AND policyname = 'Allow public read access for scheme_categories'
  ) THEN
    CREATE POLICY "Allow public read access for scheme_categories"
      ON public.scheme_categories FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'government_schemes' AND policyname = 'Allow public read access for active government_schemes'
  ) THEN
    CREATE POLICY "Allow public read access for active government_schemes"
      ON public.government_schemes FOR SELECT USING (is_active = true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'saved_schemes' AND policyname = 'Allow users to view their saved_schemes'
  ) THEN
    CREATE POLICY "Allow users to view their saved_schemes"
      ON public.saved_schemes FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'saved_schemes' AND policyname = 'Allow users to save schemes'
  ) THEN
    CREATE POLICY "Allow users to save schemes"
      ON public.saved_schemes FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'saved_schemes' AND policyname = 'Allow users to delete their saved_schemes'
  ) THEN
    CREATE POLICY "Allow users to delete their saved_schemes"
      ON public.saved_schemes FOR DELETE USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_scheme_preferences' AND policyname = 'Allow users to view their scheme preferences'
  ) THEN
    CREATE POLICY "Allow users to view their scheme preferences"
      ON public.user_scheme_preferences FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_scheme_preferences' AND policyname = 'Allow users to insert/update their scheme preferences'
  ) THEN
    CREATE POLICY "Allow users to insert/update their scheme preferences"
      ON public.user_scheme_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_scheme_preferences' AND policyname = 'Allow users to update their own scheme preferences'
  ) THEN
    CREATE POLICY "Allow users to update their own scheme preferences"
      ON public.user_scheme_preferences FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Seed Initial Scheme Categories
-- ----------------------------------------------------------------------------
INSERT INTO public.scheme_categories (category_name, category_code, description, icon_name)
VALUES
  ('Women Welfare & Financial Support', 'women_welfare', 'Welfare schemes providing financial assistance, pensions, and empowerment for women.', 'fa-person-dress'),
  ('Education & Scholarships', 'education', 'Scholarships, free laptops, higher education incentives, and student aid.', 'fa-graduation-cap'),
  ('Agriculture & Farming', 'agriculture', 'Crop insurance, fertilizer subsidies, machinery grants, and farmer income support.', 'fa-wheat-awn'),
  ('Healthcare & Insurance', 'healthcare', 'Comprehensive health cover, medical assistance, and maternal care.', 'fa-heart-pulse'),
  ('Housing & Infrastructure', 'housing', 'Free house site patta, subsidized housing construction, and rural housing schemes.', 'fa-house-user'),
  ('Employment & Skill Development', 'employment', 'Self-employment loans, skill training programs, and youth entrepreneurship funds.', 'fa-briefcase')
ON CONFLICT (category_code) DO NOTHING;
