-- CrowdCity AI v3.2 - Smart Transportation Module Database Schema
-- Isolated database tables for Transportation Issue Reporting

-- 1. Transportation Departments Registry
CREATE TABLE IF NOT EXISTS transportation_departments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  name_ta VARCHAR(100),
  code VARCHAR(20) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed Default Departments
INSERT INTO transportation_departments (name, name_ta, code) VALUES
  ('Roads Department', 'சாலைகள் துறை', 'ROADS'),
  ('Traffic Police', 'போக்குவரத்து காவல்துறை', 'TRAFFIC_POLICE'),
  ('Municipal Corporation', 'மாநகராட்சி', 'MUNICIPAL'),
  ('Highways Department', 'நெடுஞ்சாலைத் துறை', 'HIGHWAYS'),
  ('Street Lighting Department', 'தெருவிளக்குகள் துறை', 'LIGHTING'),
  ('Transport Department', 'போக்குவரத்து துறை', 'TRANSPORT')
ON CONFLICT (name) DO NOTHING;

-- 2. Transportation Reports Table
CREATE TABLE IF NOT EXISTS transportation_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_number VARCHAR(30) UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(100) NOT NULL,
  priority VARCHAR(20) DEFAULT 'Medium', -- Critical, High, Medium, Low
  severity VARCHAR(20) DEFAULT 'Medium',
  status VARCHAR(30) DEFAULT 'Submitted', -- Submitted, Under Review, Assigned, In Progress, Resolved, Closed
  address TEXT,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  photo_urls TEXT[],
  responsible_department VARCHAR(100),
  suggested_resolution TEXT,
  confidence_score NUMERIC(5, 2),
  summary TEXT,
  assigned_to VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexing for fast search and filtering
CREATE INDEX IF NOT EXISTS idx_trans_reports_category ON transportation_reports(category);
CREATE INDEX IF NOT EXISTS idx_trans_reports_status ON transportation_reports(status);
CREATE INDEX IF NOT EXISTS idx_trans_reports_priority ON transportation_reports(priority);
CREATE INDEX IF NOT EXISTS idx_trans_reports_dept ON transportation_reports(responsible_department);

-- 3. Transportation Updates / History Log
CREATE TABLE IF NOT EXISTS transportation_updates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID REFERENCES transportation_reports(id) ON DELETE CASCADE,
  updated_by VARCHAR(100),
  status VARCHAR(30) NOT NULL,
  remarks TEXT,
  completion_photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Transportation Attachments Table
CREATE TABLE IF NOT EXISTS transportation_attachments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID REFERENCES transportation_reports(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_type VARCHAR(50) DEFAULT 'image',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
