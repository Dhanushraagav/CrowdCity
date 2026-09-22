-- ====================================================================
-- CrowdCity AI - Phase 5A: Civic Issue Priority Score Migration
-- Safe, transactional, non-destructive, and idempotent
-- ====================================================================

-- 1. Add Priority Score Columns safely to issues table
ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS priority_score NUMERIC(5, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS priority_level VARCHAR(20) DEFAULT 'LOW',
  ADD COLUMN IF NOT EXISTS priority_calculated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  ADD COLUMN IF NOT EXISTS priority_factors JSONB DEFAULT '{"severity": 50, "affected": 4, "recurrence": 0, "duration": 0, "public_importance": 50}'::jsonb,
  ADD COLUMN IF NOT EXISTS priority_model_version VARCHAR(10) DEFAULT 'v1';

-- 2. Indexes for high-performance priority sorting and queue filtering
CREATE INDEX IF NOT EXISTS idx_issues_priority_score 
  ON public.issues(priority_score DESC);

CREATE INDEX IF NOT EXISTS idx_issues_priority_level 
  ON public.issues(priority_level);

-- 3. Non-destructive backfill for existing historical complaints
-- Preserves historical IDs, titles, addresses, coordinates, and timestamps intact
DO $$
DECLARE
  r RECORD;
  calc_s NUMERIC;
  calc_a NUMERIC;
  calc_r NUMERIC;
  calc_d NUMERIC;
  calc_u NUMERIC;
  calc_p NUMERIC;
  calc_level TEXT;
BEGIN
  FOR r IN SELECT id, priority, ai_priority, is_emergency, citizen_count, created_at, status FROM public.issues LOOP
    -- Severity (S)
    IF r.is_emergency = true THEN
      calc_s := 100;
    ELSIF LOWER(COALESCE(r.priority, r.ai_priority, 'medium')) = 'critical' THEN
      calc_s := 100;
    ELSIF LOWER(COALESCE(r.priority, r.ai_priority, 'medium')) = 'high' THEN
      calc_s := 75;
    ELSIF LOWER(COALESCE(r.priority, r.ai_priority, 'medium')) = 'low' THEN
      calc_s := 25;
    ELSE
      calc_s := 50;
    END IF;

    -- Affected Citizens (A)
    calc_a := LEAST(100.0, (100.0 * COALESCE(r.citizen_count, 1)) / 25.0);

    -- Recurrence (R)
    calc_r := 0.0;

    -- Duration (D)
    IF r.status IN ('resolved', 'verified', 'completed', 'rejected') THEN
      calc_d := 0.0;
    ELSE
      calc_d := 50.0;
    END IF;

    -- Public Location Importance (U)
    calc_u := 50.0;

    -- Formula: P = 0.30S + 0.25A + 0.20R + 0.15D + 0.10U
    calc_p := (calc_s * 0.30) + (calc_a * 0.25) + (calc_r * 0.20) + (calc_d * 0.15) + (calc_u * 0.10);
    calc_p := LEAST(100.0, GREATEST(0.0, calc_p));

    IF calc_p >= 75.0 THEN
      calc_level := 'CRITICAL';
    ELSIF calc_p >= 50.0 THEN
      calc_level := 'HIGH';
    ELSIF calc_p >= 25.0 THEN
      calc_level := 'MODERATE';
    ELSE
      calc_level := 'LOW';
    END IF;

    UPDATE public.issues
    SET priority_score = ROUND(calc_p, 2),
        priority_level = calc_level,
        priority_calculated_at = timezone('utc'::text, now()),
        priority_factors = jsonb_build_object(
          'severity', ROUND(calc_s),
          'affected', ROUND(calc_a),
          'recurrence', ROUND(calc_r),
          'duration', ROUND(calc_d),
          'public_importance', ROUND(calc_u)
        ),
        priority_model_version = 'v1'
    WHERE id = r.id AND (priority_score IS NULL OR priority_score = 0.00);
  END LOOP;
END $$;
