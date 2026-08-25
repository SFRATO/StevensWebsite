-- =============================================================================
-- 007: Lead Number — periodic goals with pace tracking
-- =============================================================================
--
-- Pipeline Pro Tools' central organizing idea is a monthly "Lead Number": a
-- target you hit month after month. The value isn't the target itself, it's the
-- pace signal — a bare count tells you where you are, not whether to act today.
--
-- Everything needed to COUNT progress already exists (leads.created_at,
-- crm_tasks of kind 'appointment', leads.pipeline_stage = 'closed_won'), so this
-- migration stores only the targets and computes progress in a view.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'goal_metric') THEN
    CREATE TYPE goal_metric AS ENUM (
      'leads',        -- new lead rows created in the period
      'appointments', -- crm_tasks kind='appointment' starting in the period
      'closings'      -- leads reaching closed_won in the period
    );
  END IF;
END$$;


CREATE TABLE IF NOT EXISTS crm_goals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric       goal_metric NOT NULL,

  -- Half-open period [period_start, period_end). Stored as dates rather than a
  -- month integer so a quarterly or campaign-length goal needs no schema change.
  period_start DATE NOT NULL,
  period_end   DATE NOT NULL,

  target       INTEGER NOT NULL,
  notes        TEXT,

  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT crm_goals_period_chk CHECK (period_end > period_start),
  CONSTRAINT crm_goals_target_chk CHECK (target > 0)
);

-- One target per metric per period. Re-running a "set this month's goal" action
-- should update, not silently create a second competing target.
CREATE UNIQUE INDEX IF NOT EXISTS crm_goals_metric_period_idx
  ON crm_goals (metric, period_start, period_end);

-- "What is the goal for today" — the dashboard's only read pattern.
CREATE INDEX IF NOT EXISTS crm_goals_current_idx
  ON crm_goals (period_start DESC, period_end DESC);

COMMENT ON TABLE crm_goals IS
  'Periodic targets ("Lead Number"). Progress is computed in crm_goal_progress, '
  'not stored — the source tables are the only source of truth for counts.';

DROP TRIGGER IF EXISTS update_crm_goals_updated_at ON crm_goals;
CREATE TRIGGER update_crm_goals_updated_at
  BEFORE UPDATE ON crm_goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS crm_set_created_by ON crm_goals;
CREATE TRIGGER crm_set_created_by
  BEFORE INSERT ON crm_goals
  FOR EACH ROW EXECUTE FUNCTION public.crm_set_created_by();


-- -----------------------------------------------------------------------------
-- crm_goal_progress — actual vs target vs pace.
--
-- `expected_to_date` is what makes this actionable: being at 12 of 30 leads is
-- meaningless without knowing whether it's the 10th or the 25th of the month.
-- Pace is linear across the period, which is the right model for lead flow
-- (roughly uniform arrival) even though it would be wrong for, say, closings
-- that cluster at month end.
--
-- security_invoker so the caller's RLS applies — the counts touch `leads`.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW crm_goal_progress
WITH (security_invoker = on) AS
SELECT
  g.id,
  g.metric,
  g.period_start,
  g.period_end,
  g.target,
  g.notes,

  CASE g.metric
    WHEN 'leads' THEN (
      SELECT COUNT(*) FROM public.leads l
       WHERE l.created_at >= g.period_start
         AND l.created_at <  g.period_end
    )
    WHEN 'appointments' THEN (
      SELECT COUNT(*) FROM public.crm_tasks t
       WHERE t.kind = 'appointment'
         AND t.status <> 'cancelled'
         AND t.starts_at >= g.period_start
         AND t.starts_at <  g.period_end
    )
    WHEN 'closings' THEN (
      SELECT COUNT(*) FROM public.leads l
       WHERE l.pipeline_stage = 'closed_won'
         AND l.converted_at >= g.period_start
         AND l.converted_at <  g.period_end
    )
  END AS actual,

  -- Fraction of the period elapsed, clamped to [0,1] so a past or future period
  -- doesn't produce a nonsense expectation.
  LEAST(1.0, GREATEST(0.0,
    (CURRENT_DATE - g.period_start)::numeric
      / NULLIF((g.period_end - g.period_start)::numeric, 0)
  )) AS period_elapsed,

  ROUND(
    g.target * LEAST(1.0, GREATEST(0.0,
      (CURRENT_DATE - g.period_start)::numeric
        / NULLIF((g.period_end - g.period_start)::numeric, 0)
    ))
  )::INTEGER AS expected_to_date,

  (CURRENT_DATE >= g.period_start AND CURRENT_DATE < g.period_end) AS is_current

FROM public.crm_goals g;

REVOKE ALL    ON public.crm_goal_progress FROM PUBLIC, anon, authenticated;
GRANT  SELECT ON public.crm_goal_progress TO authenticated, service_role;


-- -----------------------------------------------------------------------------
-- RLS — same shape as every other CRM table (see 005).
-- -----------------------------------------------------------------------------
ALTER TABLE public.crm_goals ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.crm_goals FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.crm_goals TO authenticated;

DROP POLICY IF EXISTS crm_goals_admin ON public.crm_goals;
CREATE POLICY crm_goals_admin ON public.crm_goals
  FOR ALL TO authenticated
  USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
