-- ==============================================================================
-- CROWDCITY — EMERGENCY SERVICES DIRECTORY SCHEMA (v11)
-- Normalized table for verified Tamil Nadu emergency services
-- Sources: TN Health & Family Welfare / HMIS, TN Police, TNFRS, TNGIS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS emergency_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    service_type TEXT NOT NULL CHECK (service_type IN ('hospital', 'ambulance', 'police_station', 'fire_station')),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    address TEXT NOT NULL,
    phone TEXT,
    district_id TEXT NOT NULL,
    source_name TEXT NOT NULL,
    source_url TEXT,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_verified BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient spatial and category lookups
CREATE INDEX IF NOT EXISTS idx_emergency_services_type ON emergency_services(service_type);
CREATE INDEX IF NOT EXISTS idx_emergency_services_district ON emergency_services(district_id);
CREATE INDEX IF NOT EXISTS idx_emergency_services_active ON emergency_services(is_active);
CREATE INDEX IF NOT EXISTS idx_emergency_services_coords ON emergency_services(latitude, longitude);

-- Enable Row Level Security (RLS)
ALTER TABLE emergency_services ENABLE ROW LEVEL SECURITY;

-- Allow public read access to all citizens and visitors
CREATE POLICY "Allow public read access to emergency services"
    ON emergency_services
    FOR SELECT
    USING (is_active = true);

-- Allow authenticated service/admin role to manage records
CREATE POLICY "Allow service role to manage emergency services"
    ON emergency_services
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role' OR auth.jwt() ->> 'role' = 'admin');

COMMENT ON TABLE emergency_services IS 'Verified emergency services (hospitals, ambulances, police stations, fire stations) across Tamil Nadu referenced from official government directories';
