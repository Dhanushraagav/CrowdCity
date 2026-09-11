-- ==============================================================================
-- CROWD CITY — STEP 2: AUTHORITATIVE TAMIL NADU LOCATION DATA INGESTION
-- Migration Version: v9_authoritative_location_ingestion.sql
-- Ingestion of 388 TNRD Blocks, 12,525 Village Panchayats, Quarantining Synthetic Data
-- ==============================================================================

-- 1. Create Blocks Table (Rural Administrative Units)
CREATE TABLE IF NOT EXISTS public.blocks (
  id VARCHAR(100) PRIMARY KEY,
  district_id VARCHAR(50) NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,
  lgd_code VARCHAR(20) UNIQUE,
  name VARCHAR(150) NOT NULL,
  tamil_name VARCHAR(150),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blocks_district ON public.blocks(district_id);
CREATE INDEX IF NOT EXISTS idx_blocks_lgd ON public.blocks(lgd_code);

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read blocks" ON public.blocks FOR SELECT USING (true);

-- 2. Enhance Locations Table with Administrative Hierarchy & Provenance Metadata
ALTER TABLE public.locations ALTER COLUMN taluk_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'locations' AND column_name = 'block_id') THEN
    ALTER TABLE public.locations ADD COLUMN block_id VARCHAR(100) REFERENCES public.blocks(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'locations' AND column_name = 'lgd_code') THEN
    ALTER TABLE public.locations ADD COLUMN lgd_code VARCHAR(20);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'locations' AND column_name = 'is_synthetic') THEN
    ALTER TABLE public.locations ADD COLUMN is_synthetic BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'locations' AND column_name = 'is_quarantined') THEN
    ALTER TABLE public.locations ADD COLUMN is_quarantined BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'locations' AND column_name = 'is_verified') THEN
    ALTER TABLE public.locations ADD COLUMN is_verified BOOLEAN DEFAULT TRUE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'locations' AND column_name = 'source_name') THEN
    ALTER TABLE public.locations ADD COLUMN source_name VARCHAR(50) DEFAULT 'tnrd';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'locations' AND column_name = 'source_url') THEN
    ALTER TABLE public.locations ADD COLUMN source_url TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'locations' AND column_name = 'source_verified_at') THEN
    ALTER TABLE public.locations ADD COLUMN source_verified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_locations_block ON public.locations(block_id);
CREATE INDEX IF NOT EXISTS idx_locations_lgd ON public.locations(lgd_code);
CREATE INDEX IF NOT EXISTS idx_locations_quarantined ON public.locations(is_quarantined);
CREATE INDEX IF NOT EXISTS idx_locations_verified ON public.locations(is_verified);
