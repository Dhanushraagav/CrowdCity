-- ============================================================================
-- CrowdCity AI - Tamil Nadu Administrative Hierarchy & Authority Directory Schema
-- Provides normalized relational storage for 38 Districts, Subdivisions (Taluks/Blocks),
-- Local Bodies, Authorities, Verified Contacts, and Service Mappings.
-- ============================================================================

-- 1. Tamil Nadu 38 Districts Registry
CREATE TABLE IF NOT EXISTS tn_districts (
  id VARCHAR(50) PRIMARY KEY, -- e.g. 'coimbatore', 'chennai', 'madurai'
  code VARCHAR(10) UNIQUE NOT NULL, -- e.g. 'cbe', 'chn', 'mdu'
  name VARCHAR(100) NOT NULL,
  name_ta VARCHAR(100) NOT NULL,
  headquarters VARCHAR(100),
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  collectorate_phone VARCHAR(50),
  collectorate_email VARCHAR(100),
  portal_url VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Administrative Subdivisions (Taluks & Revenue/Development Blocks)
CREATE TABLE IF NOT EXISTS tn_subdivisions (
  id VARCHAR(100) PRIMARY KEY, -- e.g. 'cbe_sulur_taluk', 'cbe_sulur_block'
  district_id VARCHAR(50) NOT NULL REFERENCES tn_districts(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  name_ta VARCHAR(100),
  type VARCHAR(30) NOT NULL, -- 'taluk', 'block', 'revenue_division'
  headquarters VARCHAR(100),
  tahsildar_or_bdo_office VARCHAR(150),
  office_phone VARCHAR(50),
  office_email VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Local Bodies (Corporations, Municipalities, Town Panchayats, Village Panchayats)
CREATE TABLE IF NOT EXISTS tn_local_bodies (
  id VARCHAR(120) PRIMARY KEY, -- e.g. 'cbe_ccmc', 'cbe_sulur_tp', 'cbe_kannampalayam_vp'
  district_id VARCHAR(50) NOT NULL REFERENCES tn_districts(id) ON DELETE CASCADE,
  subdivision_id VARCHAR(100) REFERENCES tn_subdivisions(id) ON DELETE SET NULL,
  name VARCHAR(150) NOT NULL,
  name_ta VARCHAR(150),
  local_body_type VARCHAR(50) NOT NULL, 
  -- Urban: 'municipal_corporation', 'municipality', 'town_panchayat'
  -- Rural: 'village_panchayat', 'panchayat_union', 'district_panchayat'
  tier VARCHAR(20) NOT NULL, -- 'urban', 'rural'
  headquarters VARCHAR(100),
  ward_count INTEGER DEFAULT 0,
  portal_url VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Responsible Administrative Authorities & Offices
CREATE TABLE IF NOT EXISTS tn_authorities (
  id VARCHAR(120) PRIMARY KEY, -- e.g. 'auth_cbe_kannampalayam_eo', 'auth_cbe_ccmc_comm'
  local_body_id VARCHAR(120) REFERENCES tn_local_bodies(id) ON DELETE SET NULL,
  district_id VARCHAR(50) NOT NULL REFERENCES tn_districts(id) ON DELETE CASCADE,
  subdivision_id VARCHAR(100) REFERENCES tn_subdivisions(id) ON DELETE SET NULL,
  office_name VARCHAR(200) NOT NULL,
  office_name_ta VARCHAR(200),
  designation VARCHAR(150) NOT NULL,
  designation_ta VARCHAR(150),
  authority_type VARCHAR(30) NOT NULL DEFAULT 'administrative', 
  -- 'administrative', 'service', 'elected_representative', 'escalation'
  jurisdiction_level VARCHAR(30) NOT NULL, 
  -- 'village', 'town', 'block', 'municipality', 'corporation', 'district', 'state'
  department_code VARCHAR(50) NOT NULL, -- 'SAN', 'ROAD', 'WATER', 'LIGHTING', 'TRAFFIC', 'HEALTH', 'REVENUE', 'ADMIN'
  higher_authority_id VARCHAR(120) REFERENCES tn_authorities(id) ON DELETE SET NULL,
  address TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Verified Authority Contacts Directory
CREATE TABLE IF NOT EXISTS tn_authority_contacts (
  id VARCHAR(120) PRIMARY KEY,
  authority_id VARCHAR(120) NOT NULL REFERENCES tn_authorities(id) ON DELETE CASCADE,
  contact_type VARCHAR(40) NOT NULL, -- 'office_phone', 'helpline', 'official_email', 'control_room', 'toll_free'
  phone VARCHAR(50),
  email VARCHAR(100),
  is_verified BOOLEAN DEFAULT true,
  source_name VARCHAR(150) NOT NULL, -- e.g. 'Tamil Nadu Government Portal / District Collectorate'
  source_url VARCHAR(255) NOT NULL, -- e.g. 'https://coimbatore.nic.in'
  last_verified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Dynamic Service Responsibility & Escalation Mapping
CREATE TABLE IF NOT EXISTS tn_service_mappings (
  id VARCHAR(100) PRIMARY KEY,
  category VARCHAR(50) NOT NULL, -- 'garbage', 'roads', 'streetlights', 'water_supply', 'drainage', 'traffic', 'sanitation', 'transportation'
  local_body_type VARCHAR(50) NOT NULL, -- 'village_panchayat', 'town_panchayat', 'municipality', 'municipal_corporation', 'all'
  service_department_name VARCHAR(150) NOT NULL,
  default_designation VARCHAR(150) NOT NULL,
  escalation_level_1 VARCHAR(150), -- e.g. 'Block Development Officer (BDO)'
  escalation_level_2 VARCHAR(150), -- e.g. 'Assistant Director of Panchayats / Regional Director of Municipal Admin'
  escalation_level_3 VARCHAR(150)  -- e.g. 'District Collector / Municipal Administration Commissionerate'
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_tn_subdiv_district ON tn_subdivisions(district_id);
CREATE INDEX IF NOT EXISTS idx_tn_subdiv_type ON tn_subdivisions(type);
CREATE INDEX IF NOT EXISTS idx_tn_localbodies_dist ON tn_local_bodies(district_id);
CREATE INDEX IF NOT EXISTS idx_tn_localbodies_subdiv ON tn_local_bodies(subdivision_id);
CREATE INDEX IF NOT EXISTS idx_tn_localbodies_type ON tn_local_bodies(local_body_type);
CREATE INDEX IF NOT EXISTS idx_tn_authorities_localbody ON tn_authorities(local_body_id);
CREATE INDEX IF NOT EXISTS idx_tn_authorities_dept ON tn_authorities(department_code);
CREATE INDEX IF NOT EXISTS idx_tn_contacts_auth ON tn_authority_contacts(authority_id);
CREATE INDEX IF NOT EXISTS idx_tn_service_cat_type ON tn_service_mappings(category, local_body_type);

-- Row Level Security
ALTER TABLE tn_districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tn_subdivisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tn_local_bodies ENABLE ROW LEVEL SECURITY;
ALTER TABLE tn_authorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE tn_authority_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tn_service_mappings ENABLE ROW LEVEL SECURITY;

-- Public read policies (citizens need to query public verified contacts)
CREATE POLICY "Public read tn_districts" ON tn_districts FOR SELECT USING (true);
CREATE POLICY "Public read tn_subdivisions" ON tn_subdivisions FOR SELECT USING (true);
CREATE POLICY "Public read tn_local_bodies" ON tn_local_bodies FOR SELECT USING (true);
CREATE POLICY "Public read tn_authorities" ON tn_authorities FOR SELECT USING (true);
CREATE POLICY "Public read tn_authority_contacts" ON tn_authority_contacts FOR SELECT USING (true);
CREATE POLICY "Public read tn_service_mappings" ON tn_service_mappings FOR SELECT USING (true);
