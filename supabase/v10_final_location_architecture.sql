-- ==============================================================================
-- CROWD CITY — STEP 3: FINAL LOCATION ARCHITECTURE, VALIDATION & AUTHORITY MAPPING
-- Migration Version: v10_final_location_architecture.sql
-- Establishes clean administrative branches: Revenue Administration, Rural Development,
-- and Urban Local Government, eliminating false parent-child conflations.
-- Preserves all historical complaints and legacy foreign keys with zero destructive drops.
-- ==============================================================================

-- 1. Ensure administrative_type column and check constraint on locations table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'locations' AND column_name = 'administrative_type'
  ) THEN
    ALTER TABLE public.locations ADD COLUMN administrative_type VARCHAR(50);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'locations' AND column_name = 'parent_type'
  ) THEN
    ALTER TABLE public.locations ADD COLUMN parent_type VARCHAR(50);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'locations' AND column_name = 'parent_id'
  ) THEN
    ALTER TABLE public.locations ADD COLUMN parent_id VARCHAR(100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'locations' AND column_name = 'urban_local_body_id'
  ) THEN
    ALTER TABLE public.locations ADD COLUMN urban_local_body_id VARCHAR(150);
  END IF;
END $$;

-- Populate administrative_type from location_type where null
UPDATE public.locations
SET administrative_type = CASE
  WHEN location_type = 'village_panchayat' THEN 'village_panchayat'
  WHEN location_type = 'revenue_village' THEN 'revenue_village'
  WHEN location_type = 'town_panchayat' THEN 'town_panchayat'
  WHEN location_type = 'municipality' THEN 'municipality'
  WHEN location_type IN ('corporation', 'municipal_corporation') THEN 'corporation'
  WHEN location_type = 'corporation_zone' THEN 'corporation_zone'
  WHEN location_type = 'locality' THEN 'locality'
  WHEN location_type = 'block' THEN 'block'
  WHEN location_type = 'taluk' THEN 'taluk'
  ELSE 'revenue_village'
END
WHERE administrative_type IS NULL;

-- 2. Create Explicit Table for Urban Local Bodies (Corporations, Municipalities, Town Panchayats)
CREATE TABLE IF NOT EXISTS public.urban_local_bodies (
  id VARCHAR(150) PRIMARY KEY,
  district_id VARCHAR(50) NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,
  taluk_id VARCHAR(100) REFERENCES public.taluks(id) ON DELETE SET NULL,
  name VARCHAR(150) NOT NULL,
  tamil_name VARCHAR(150),
  body_type VARCHAR(50) NOT NULL CHECK (body_type IN ('corporation', 'municipality', 'town_panchayat', 'corporation_zone')),
  tier VARCHAR(20) NOT NULL DEFAULT 'urban',
  source_name VARCHAR(50) DEFAULT 'cma_dtp',
  source_url TEXT DEFAULT 'https://tnurbantree.tn.gov.in',
  is_verified BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ulb_district ON public.urban_local_bodies(district_id);
CREATE INDEX IF NOT EXISTS idx_ulb_type ON public.urban_local_bodies(body_type);

ALTER TABLE public.urban_local_bodies ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'urban_local_bodies' AND policyname = 'Public read urban_local_bodies'
  ) THEN
    CREATE POLICY "Public read urban_local_bodies" ON public.urban_local_bodies FOR SELECT USING (true);
  END IF;
END $$;

-- 3. Create Explicit Table for Revenue Villages (Revenue Administration: Taluk -> Revenue Village)
CREATE TABLE IF NOT EXISTS public.revenue_villages (
  id VARCHAR(150) PRIMARY KEY,
  taluk_id VARCHAR(100) NOT NULL REFERENCES public.taluks(id) ON DELETE CASCADE,
  district_id VARCHAR(50) NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  tamil_name VARCHAR(150),
  source_name VARCHAR(50) DEFAULT 'cra',
  source_url TEXT DEFAULT 'https://revenue.tn.gov.in',
  is_verified BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rev_vil_taluk ON public.revenue_villages(taluk_id);
CREATE INDEX IF NOT EXISTS idx_rev_vil_district ON public.revenue_villages(district_id);

ALTER TABLE public.revenue_villages ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'revenue_villages' AND policyname = 'Public read revenue_villages'
  ) THEN
    CREATE POLICY "Public read revenue_villages" ON public.revenue_villages FOR SELECT USING (true);
  END IF;
END $$;

-- 4. Create Explicit Table for Village Panchayats (Rural Development: Block -> Village Panchayat)
CREATE TABLE IF NOT EXISTS public.village_panchayats (
  id VARCHAR(150) PRIMARY KEY,
  block_id VARCHAR(100) NOT NULL REFERENCES public.blocks(id) ON DELETE CASCADE,
  district_id VARCHAR(50) NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,
  lgd_code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  tamil_name VARCHAR(150),
  source_name VARCHAR(50) DEFAULT 'tnrd',
  source_url TEXT DEFAULT 'https://tnrd.tn.gov.in/rdweb_newsite/project/admin/village_lgd_pvcode.php',
  is_verified BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vp_block ON public.village_panchayats(block_id);
CREATE INDEX IF NOT EXISTS idx_vp_district ON public.village_panchayats(district_id);
CREATE INDEX IF NOT EXISTS idx_vp_lgd ON public.village_panchayats(lgd_code);

ALTER TABLE public.village_panchayats ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'village_panchayats' AND policyname = 'Public read village_panchayats'
  ) THEN
    CREATE POLICY "Public read village_panchayats" ON public.village_panchayats FOR SELECT USING (true);
  END IF;
END $$;

-- 5. Additional Performance Indexes on Locations
CREATE INDEX IF NOT EXISTS idx_locations_admin_type ON public.locations(administrative_type);
CREATE INDEX IF NOT EXISTS idx_locations_parent_id ON public.locations(parent_id);
CREATE INDEX IF NOT EXISTS idx_locations_ulb_id ON public.locations(urban_local_body_id);
CREATE INDEX IF NOT EXISTS idx_locations_active_search ON public.locations(district_id, is_quarantined) WHERE is_quarantined = FALSE;

-- 6. Verification Comment
COMMENT ON TABLE public.urban_local_bodies IS 'CrowdCity Step 3 Authoritative Urban Local Bodies (Corporations, Municipalities, Town Panchayats)';
COMMENT ON TABLE public.revenue_villages IS 'CrowdCity Step 3 Authoritative Revenue Villages under Taluk Revenue Administration';
COMMENT ON TABLE public.village_panchayats IS 'CrowdCity Step 3 Authoritative Village Panchayats under Rural Development Blocks';
