-- ==============================================================================
-- CROWDCITY — GOVERNMENT OFFICES & E-SEVAI LOCATOR SCHEMA (v15)
-- Normalized table for verified Tamil Nadu Government Offices and E-Sevai Centers
-- Sources: TNeGA (tnega.tn.gov.in / tnesevai.tn.gov.in), Revenue Dept (tn.gov.in / nic.in), CMA (cma.tn.gov.in)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.government_offices (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_ta TEXT,
    office_type TEXT NOT NULL CHECK (office_type IN ('collectorate', 'taluk', 'esevai', 'vao', 'corporation', 'municipality', 'bdo')),
    department TEXT NOT NULL,
    address TEXT NOT NULL,
    district TEXT NOT NULL,
    district_id TEXT NOT NULL,
    taluk TEXT,
    taluk_id TEXT,
    pincode TEXT,
    phone TEXT,
    email TEXT,
    hours TEXT,
    services TEXT[] DEFAULT '{}',
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    source_name TEXT NOT NULL,
    source_url TEXT,
    last_verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_verified BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance indexes for spatial and categorical discovery
CREATE INDEX IF NOT EXISTS idx_govt_offices_type ON public.government_offices(office_type);
CREATE INDEX IF NOT EXISTS idx_govt_offices_district ON public.government_offices(district_id);
CREATE INDEX IF NOT EXISTS idx_govt_offices_taluk ON public.government_offices(taluk_id);
CREATE INDEX IF NOT EXISTS idx_govt_offices_pincode ON public.government_offices(pincode);
CREATE INDEX IF NOT EXISTS idx_govt_offices_active ON public.government_offices(is_active);
CREATE INDEX IF NOT EXISTS idx_govt_offices_coords ON public.government_offices(latitude, longitude);

-- Enable Row Level Security (RLS)
ALTER TABLE public.government_offices ENABLE ROW LEVEL SECURITY;

-- Allow public read access to all citizens
CREATE POLICY "Allow public read access to government offices"
    ON public.government_offices
    FOR SELECT
    USING (is_active = true);

-- Allow service role / admin to manage records
CREATE POLICY "Allow service role to manage government offices"
    ON public.government_offices
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role' OR auth.jwt() ->> 'role' = 'admin');

COMMENT ON TABLE public.government_offices IS 'Authoritative directory of Tamil Nadu Government Offices, District Collectorates, Taluk Offices, and TNeGA E-Sevai Centers';
