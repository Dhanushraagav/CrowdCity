-- ====================================================================
-- CROWD CITY AI — SCHEMA MIGRATION V5: SLA & AUTOMATIC ESCALATION SYSTEM
-- ====================================================================
-- Safe, idempotent migration for SLA tracking and automatic escalation.
-- 1. Adds SLA tracking columns to issues table
-- 2. Adds indexes for high-speed overdue/escalation queries
-- 3. Creates SLA configuration table
-- 4. Trigger for automatic SLA deadline assignment on issue insert
-- 5. Stored procedure for automated backend/cron escalation sweeps
-- ====================================================================

-- 1. ADD SLA COLUMNS TO ISSUES TABLE (Safe with IF NOT EXISTS)
DO $$
BEGIN
  -- sla_deadline: calculated response deadline in UTC (Asia/Kolkata aware)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'issues' AND column_name = 'sla_deadline') THEN
    ALTER TABLE public.issues ADD COLUMN sla_deadline TIMESTAMPTZ;
  END IF;

  -- sla_status: 'within_sla', 'overdue', 'escalated', 'met', 'breached'
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'issues' AND column_name = 'sla_status') THEN
    ALTER TABLE public.issues ADD COLUMN sla_status VARCHAR(50) DEFAULT 'within_sla';
  END IF;

  -- responded_at: timestamp when first authoritative action was taken
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'issues' AND column_name = 'responded_at') THEN
    ALTER TABLE public.issues ADD COLUMN responded_at TIMESTAMPTZ;
  END IF;

  -- escalated_at: timestamp when escalation occurred
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'issues' AND column_name = 'escalated_at') THEN
    ALTER TABLE public.issues ADD COLUMN escalated_at TIMESTAMPTZ;
  END IF;

  -- escalation_level: 0 (normal), 1 (escalated)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'issues' AND column_name = 'escalation_level') THEN
    ALTER TABLE public.issues ADD COLUMN escalation_level INT DEFAULT 0;
  END IF;
END $$;

-- 2. INDEXES FOR HIGH PERFORMANCE QUERYING
CREATE INDEX IF NOT EXISTS idx_issues_sla_lookup 
ON public.issues (status, sla_status, sla_deadline)
WHERE status IN ('pending', 'overdue');

CREATE INDEX IF NOT EXISTS idx_issues_sla_deadline 
ON public.issues (sla_deadline);

-- 3. SLA CONFIGURATION TABLE
CREATE TABLE IF NOT EXISTS public.sla_configurations (
  priority VARCHAR(50) PRIMARY KEY,
  duration_hours INT NOT NULL,
  escalation_threshold_hours INT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed authoritative SLA values (matches server/config/slaConfig.js)
INSERT INTO public.sla_configurations (priority, duration_hours, escalation_threshold_hours, description)
VALUES 
  ('critical', 4, 2, 'Critical / Emergency civic hazards requiring urgent response within 4 hours'),
  ('high', 24, 12, 'High priority infrastructure damage requiring response within 24 hours'),
  ('medium', 72, 24, 'Medium priority neighborhood issues requiring response within 3 days (72 hours)'),
  ('low', 168, 48, 'Low priority routine civic maintenance requiring response within 7 days (168 hours)')
ON CONFLICT (priority) DO UPDATE SET
  duration_hours = EXCLUDED.duration_hours,
  escalation_threshold_hours = EXCLUDED.escalation_threshold_hours,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Enable RLS on sla_configurations with public read
ALTER TABLE public.sla_configurations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sla_configurations' AND policyname = 'Allow public read of sla_configurations') THEN
    CREATE POLICY "Allow public read of sla_configurations"
    ON public.sla_configurations FOR SELECT
    TO public
    USING (true);
  END IF;
END $$;

-- 4. FUNCTION & TRIGGER TO AUTO-ASSIGN SLA DEADLINE ON INSERT
CREATE OR REPLACE FUNCTION public.set_complaint_sla_deadline()
RETURNS TRIGGER AS $$
DECLARE
  v_priority VARCHAR(50);
  v_duration_hours INT;
BEGIN
  -- Determine priority level (priority, ai_priority, or critical if is_emergency)
  IF NEW.is_emergency = true THEN
    v_priority := 'critical';
  ELSE
    v_priority := LOWER(COALESCE(NEW.priority, NEW.ai_priority, 'medium'));
  END IF;

  -- Default durations if config lookup fails
  IF v_priority = 'critical' THEN
    v_duration_hours := 4;
  ELSIF v_priority = 'high' THEN
    v_duration_hours := 24;
  ELSIF v_priority = 'low' THEN
    v_duration_hours := 168;
  ELSE
    v_duration_hours := 72; -- medium
  END IF;

  -- Calculate SLA deadline from created_at
  IF NEW.sla_deadline IS NULL THEN
    NEW.sla_deadline := COALESCE(NEW.created_at, NOW()) + (v_duration_hours || ' hours')::INTERVAL;
  END IF;

  IF NEW.sla_status IS NULL THEN
    NEW.sla_status := 'within_sla';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_complaint_sla_deadline ON public.issues;
CREATE TRIGGER trg_set_complaint_sla_deadline
BEFORE INSERT ON public.issues
FOR EACH ROW
EXECUTE FUNCTION public.set_complaint_sla_deadline();

-- 5. STORED PROCEDURE FOR AUTOMATED ESCALATION SWEEPS
-- Can be called via cron (pg_cron) or from backend API endpoint
CREATE OR REPLACE FUNCTION public.process_sla_escalations()
RETURNS JSONB AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_overdue_count INT := 0;
  v_escalated_count INT := 0;
  r RECORD;
BEGIN
  -- Step A: Transition PENDING -> OVERDUE when now > sla_deadline and unhandled
  FOR r IN 
    SELECT id, title, reporter_id, sla_deadline
    FROM public.issues
    WHERE status = 'pending'
      AND responded_at IS NULL
      AND sla_deadline IS NOT NULL
      AND sla_deadline < v_now
  LOOP
    UPDATE public.issues
    SET status = 'overdue',
        sla_status = 'overdue',
        updated_at = v_now
    WHERE id = r.id;

    -- Append audit history (preserves all previous entries)
    INSERT INTO public.status_history (issue_id, status, notes, created_at)
    VALUES (
      r.id, 
      'overdue', 
      'SLA Response Deadline (' || TO_CHAR(r.sla_deadline AT TIME ZONE 'Asia/Kolkata', 'DD Mon YYYY, HH:MI AM') || ' IST) breached without authority action. Marked as OVERDUE.',
      v_now
    );

    v_overdue_count := v_overdue_count + 1;
  END LOOP;

  -- Step B: Transition OVERDUE -> ESCALATED when overdue beyond threshold
  FOR r IN
    SELECT i.id, i.title, i.reporter_id, i.sla_deadline, i.ai_priority, i.is_emergency,
           COALESCE(c.escalation_threshold_hours, 24) as threshold_hours
    FROM public.issues i
    LEFT JOIN public.sla_configurations c 
      ON c.priority = CASE 
        WHEN i.is_emergency = true THEN 'critical' 
        ELSE LOWER(COALESCE(i.priority, i.ai_priority, 'medium')) 
      END
    WHERE i.status = 'overdue'
      AND i.responded_at IS NULL
      AND i.escalation_level = 0
      AND i.sla_deadline + (COALESCE(c.escalation_threshold_hours, 24) || ' hours')::INTERVAL < v_now
  LOOP
    UPDATE public.issues
    SET status = 'escalated',
        sla_status = 'escalated',
        escalated_at = v_now,
        escalation_level = 1,
        updated_at = v_now
    WHERE id = r.id;

    -- Append audit history
    INSERT INTO public.status_history (issue_id, status, notes, created_at)
    VALUES (
      r.id, 
      'escalated', 
      'Automated Escalation: Complaint remained unhandled beyond escalation threshold. Escalated to Senior Municipal Authority.',
      v_now
    );

    v_escalated_count := v_escalated_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'overdue_processed', v_overdue_count,
    'escalated_processed', v_escalated_count,
    'timestamp', v_now
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. SAFE BACKFILL FOR EXISTING ISSUES
-- For existing issues lacking sla_deadline, calculate deterministically from created_at
UPDATE public.issues i
SET sla_deadline = i.created_at + (
  CASE 
    WHEN i.is_emergency = true OR LOWER(COALESCE(i.priority, i.ai_priority, '')) = 'critical' THEN 4
    WHEN LOWER(COALESCE(i.priority, i.ai_priority, '')) = 'high' THEN 24
    WHEN LOWER(COALESCE(i.priority, i.ai_priority, '')) = 'low' THEN 168
    ELSE 72
  END || ' hours'
)::INTERVAL,
sla_status = CASE
  WHEN i.status IN ('resolved', 'verified', 'closed') THEN 'met'
  WHEN i.assigned_to IS NOT NULL OR i.status IN ('assigned', 'in_progress') THEN 'met'
  WHEN i.status = 'overdue' THEN 'overdue'
  WHEN i.status = 'escalated' THEN 'escalated'
  ELSE 'within_sla'
END,
responded_at = CASE
  WHEN i.assigned_to IS NOT NULL OR i.status IN ('assigned', 'in_progress', 'resolved', 'verified') 
  THEN COALESCE(i.updated_at, i.created_at)
  ELSE NULL
END
WHERE i.sla_deadline IS NULL;
