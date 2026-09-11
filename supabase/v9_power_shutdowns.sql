-- ==============================================================================
-- CROWDCITY — POWER SHUTDOWN NOTIFICATIONS SCHEMA (v9)
-- Normalized table for Tamil Nadu electricity planned outage updates
-- Sources: TNPDCL / TANGEDCO official publications
-- ==============================================================================

CREATE TABLE IF NOT EXISTS power_shutdowns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source TEXT NOT NULL DEFAULT 'TNPDCL',
    source_reference TEXT,
    district TEXT NOT NULL,
    circle TEXT,
    division TEXT,
    area TEXT NOT NULL,
    shutdown_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status TEXT NOT NULL DEFAULT 'SCHEDULED', -- 'SCHEDULED', 'ONGOING', 'RESTORED', 'CANCELLED'
    affected_area TEXT,
    last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for lightning-fast querying across filters
CREATE INDEX IF NOT EXISTS idx_power_shutdowns_district ON power_shutdowns(LOWER(district));
CREATE INDEX IF NOT EXISTS idx_power_shutdowns_date ON power_shutdowns(shutdown_date);
CREATE INDEX IF NOT EXISTS idx_power_shutdowns_status ON power_shutdowns(status);
CREATE INDEX IF NOT EXISTS idx_power_shutdowns_area ON power_shutdowns(LOWER(area));
CREATE INDEX IF NOT EXISTS idx_power_shutdowns_composite ON power_shutdowns(LOWER(district), shutdown_date, status);

-- Enable Row Level Security (RLS)
ALTER TABLE power_shutdowns ENABLE ROW LEVEL SECURITY;

-- Allow public read access to all citizens & visitors
CREATE POLICY "Allow public read access to power shutdowns"
    ON power_shutdowns
    FOR SELECT
    USING (true);

-- Allow authenticated service/admin role to manage records
CREATE POLICY "Allow service role to manage power shutdowns"
    ON power_shutdowns
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role' OR auth.jwt() ->> 'role' = 'admin');

COMMENT ON TABLE power_shutdowns IS 'Verified planned electricity shutdowns in Tamil Nadu referenced from official TNPDCL publications';
