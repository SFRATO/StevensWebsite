-- =============================================================================
-- 003: Lead Activity + Behaviour-Triggered Follow-Ups
-- =============================================================================
--
-- Records what a known lead actually looks at on the site, and turns that into
-- targeted follow-up emails.
--
-- Scope note: activity is only ever recorded for a lead who (a) gave us their
-- email through a form and (b) accepted cookies. Anonymous visitors are never
-- written here — see src/utils/leadActivity.ts and
-- netlify/functions/track-activity.ts, which both no-op without consent.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- lead_activity: raw on-site event stream for known leads
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lead_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,

  -- page_view | tool_use | form_start | resubmit
  event_type VARCHAR(40) NOT NULL,
  path VARCHAR(500) NOT NULL,

  -- Denormalised geography so trigger queries don't need to re-resolve the URL.
  town VARCHAR(100),
  zipcode VARCHAR(10),
  county VARCHAR(100),

  -- Tool slug, referrer, etc. Never the figures a visitor typed into a calculator.
  metadata JSONB,

  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS lead_activity_lead_time_idx
  ON lead_activity (lead_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS lead_activity_town_idx
  ON lead_activity (lead_id, town, occurred_at DESC)
  WHERE town IS NOT NULL;

CREATE INDEX IF NOT EXISTS lead_activity_type_time_idx
  ON lead_activity (event_type, occurred_at DESC);

COMMENT ON TABLE lead_activity IS
  'On-site page views and tool usage for consented, identified leads. Drives behaviour_triggers.';

-- -----------------------------------------------------------------------------
-- behaviour trigger definitions (data, not code, so cadence is tunable in SQL)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS behavior_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,

  -- Renderer key in supabase/functions/send-behavior-triggers/index.ts.
  template_id VARCHAR(50) NOT NULL,
  subject_template VARCHAR(200) NOT NULL,

  -- Minimum days before this trigger may fire again for the same lead+subject.
  cooldown_days INTEGER NOT NULL DEFAULT 30,

  -- When true the trigger only alerts the agent; no email goes to the lead.
  notify_agent_only BOOLEAN NOT NULL DEFAULT FALSE,

  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- behaviour send log: cooldown bookkeeping + an audit trail of what we sent
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS behavior_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  trigger_slug VARCHAR(50) NOT NULL REFERENCES behavior_triggers(slug) ON DELETE CASCADE,

  -- What the send was about (usually a town), so town_repeat can cool down
  -- per-town rather than globally.
  subject_key VARCHAR(100) NOT NULL DEFAULT '',

  ses_message_id VARCHAR(100),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS behavior_sends_cooldown_idx
  ON behavior_sends (lead_id, trigger_slug, subject_key, sent_at DESC);

-- Global "one behaviour email per lead per week" check reads this.
CREATE INDEX IF NOT EXISTS behavior_sends_lead_time_idx
  ON behavior_sends (lead_id, sent_at DESC);

-- -----------------------------------------------------------------------------
-- Rollup view: one row per lead summarising their behaviour
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW lead_activity_summary AS
SELECT
  l.id                                       AS lead_id,
  l.email,
  l.name,
  l.status,
  l.lead_temperature,
  COUNT(a.id)                                AS total_events,
  COUNT(*) FILTER (WHERE a.event_type = 'page_view')  AS page_views,
  COUNT(*) FILTER (WHERE a.event_type = 'tool_use')   AS tool_uses,
  COUNT(DISTINCT a.town) FILTER (WHERE a.town IS NOT NULL) AS distinct_towns,
  MAX(a.occurred_at)                         AS last_seen_at,
  MIN(a.occurred_at)                         AS first_seen_at,
  -- Most-viewed town: the strongest single signal of where their head is at.
  (
    SELECT a2.town
    FROM lead_activity a2
    WHERE a2.lead_id = l.id AND a2.town IS NOT NULL
    GROUP BY a2.town
    ORDER BY COUNT(*) DESC, MAX(a2.occurred_at) DESC
    LIMIT 1
  )                                          AS top_town
FROM leads l
LEFT JOIN lead_activity a ON a.lead_id = l.id
GROUP BY l.id, l.email, l.name, l.status, l.lead_temperature;

-- -----------------------------------------------------------------------------
-- updated_at maintenance (function defined in 001)
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS update_behavior_triggers_updated_at ON behavior_triggers;
CREATE TRIGGER update_behavior_triggers_updated_at
  BEFORE UPDATE ON behavior_triggers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- Row Level Security — all three tables hold PII-adjacent behaviour, so they are
-- service-role only. No anon/authenticated read policy is granted deliberately.
-- -----------------------------------------------------------------------------
ALTER TABLE lead_activity     ENABLE ROW LEVEL SECURITY;
ALTER TABLE behavior_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE behavior_sends    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to lead_activity"
  ON lead_activity FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to behavior_triggers"
  ON behavior_triggers FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to behavior_sends"
  ON behavior_sends FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- Seed the trigger rules
-- -----------------------------------------------------------------------------
INSERT INTO behavior_triggers (slug, description, template_id, subject_template, cooldown_days, notify_agent_only)
VALUES
  (
    'town_repeat',
    'Viewed the same town 3+ times in the last 14 days.',
    'behavior-town-repeat',
    'Still watching {{town}}?',
    30,
    FALSE
  ),
  (
    'tool_completed',
    'Completed one of the calculators (proceeds, estimator, timing, affordability).',
    'behavior-tool-followup',
    'Your {{tool_name}} results',
    21,
    FALSE
  ),
  (
    'high_intent_return',
    '5+ page views in 48h, or any /home-value/ page view. Alerts the agent; no lead email.',
    'behavior-high-intent',
    'Hot lead activity: {{name}}',
    7,
    TRUE
  ),
  (
    'dormant_return',
    'Came back after 30+ days with no recorded activity.',
    'behavior-dormant-return',
    'What has changed in {{town}} since you last looked',
    60,
    FALSE
  )
ON CONFLICT (slug) DO NOTHING;
