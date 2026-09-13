-- ============================================================================
-- CrowdCity AI - Migration v12: Enhanced Emergency Services Schema
-- Supports Government & Private Hospitals, Clinics, Ambulances, Police & Fire
-- Location-First Emergency Assistance Engine
-- ============================================================================

-- Create enum types if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'emergency_service_type') THEN
    CREATE TYPE emergency_service_type AS ENUM (
      'hospital',
      'clinic',
      'ambulance',
      'police_station',
      'fire_station'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'facility_ownership_type') THEN
    CREATE TYPE facility_ownership_type AS ENUM (
      'government',
      'private',
      'ngo',
      'trust',
      'unknown'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'emergency_capability_status') THEN
    CREATE TYPE emergency_capability_status AS ENUM (
      'verified_emergency',
      'unverified',
      'no_emergency'
    );
  END IF;
END $$;

-- Create or update emergency_services table
CREATE TABLE IF NOT EXISTS emergency_services (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  service_type VARCHAR(32) NOT NULL, -- 'hospital', 'clinic', 'ambulance', 'police_station', 'fire_station'
  facility_type VARCHAR(64) DEFAULT 'General', -- e.g. 'Multispeciality Hospital', 'Primary Health Centre', 'Private Ambulance', 'Police Station'
  ownership_type VARCHAR(32) DEFAULT 'government', -- 'government', 'private', 'ngo', 'trust', 'unknown'
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  address TEXT NOT NULL,
  phone VARCHAR(64),
  emergency_phone VARCHAR(64),
  district_id VARCHAR(64),
  pincode VARCHAR(10),
  operates_24x7 BOOLEAN DEFAULT false,
  emergency_available BOOLEAN DEFAULT false,
  verification_status VARCHAR(32) DEFAULT 'verified', -- 'verified', 'community_reported', 'unverified'
  source_name VARCHAR(128) NOT NULL DEFAULT 'Government Directory',
  source_url VARCHAR(512),
  source_priority INTEGER DEFAULT 1, -- 1: Official Gov, 2: Verified Partner, 3: OSM / Registry
  is_verified BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Geospatial & lookup indexes
CREATE INDEX IF NOT EXISTS idx_emergency_services_coords 
  ON emergency_services (latitude, longitude);

CREATE INDEX IF NOT EXISTS idx_emergency_services_type 
  ON emergency_services (service_type);

CREATE INDEX IF NOT EXISTS idx_emergency_services_district 
  ON emergency_services (district_id);

CREATE INDEX IF NOT EXISTS idx_emergency_services_active 
  ON emergency_services (is_active);

-- Enable RLS
ALTER TABLE emergency_services ENABLE ROW LEVEL SECURITY;

-- Allow public read access to active emergency services
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'emergency_services' 
    AND policyname = 'Public read active emergency services'
  ) THEN
    CREATE POLICY "Public read active emergency services"
      ON emergency_services
      FOR SELECT
      TO anon, authenticated
      USING (is_active = true);
  END IF;
END $$;
