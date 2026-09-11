-- ==============================================================================
-- Migration: v9_weather_alerts.sql
-- Module: CrowdCity Public Pulse - Official IMD Weather Alerts
-- Source: India Meteorological Department, Ministry of Earth Sciences, Govt of India
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.weather_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source VARCHAR(100) NOT NULL DEFAULT 'India Meteorological Department',
    source_reference VARCHAR(255),
    imd_object_id VARCHAR(50),
    district VARCHAR(100) NOT NULL,
    warning_date DATE NOT NULL,
    issued_date DATE,
    issued_time VARCHAR(50),
    warning_codes INTEGER[] DEFAULT '{}',
    warning_types TEXT[] DEFAULT '{}',
    severity_code INTEGER NOT NULL DEFAULT 4,
    severity VARCHAR(50) NOT NULL DEFAULT 'No Warning',
    last_updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_weather_alert_district_date UNIQUE (district, warning_date)
);

-- Recommended Performance Indexes
CREATE INDEX IF NOT EXISTS idx_weather_alerts_district ON public.weather_alerts (district);
CREATE INDEX IF NOT EXISTS idx_weather_alerts_warning_date ON public.weather_alerts (warning_date);
CREATE INDEX IF NOT EXISTS idx_weather_alerts_severity ON public.weather_alerts (severity);
CREATE INDEX IF NOT EXISTS idx_weather_alerts_last_updated_at ON public.weather_alerts (last_updated_at);

-- Row Level Security (RLS)
ALTER TABLE public.weather_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access for weather alerts" ON public.weather_alerts;
CREATE POLICY "Public read access for weather alerts"
    ON public.weather_alerts FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Service role write access for weather alerts" ON public.weather_alerts;
CREATE POLICY "Service role write access for weather alerts"
    ON public.weather_alerts FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
