-- Lead Qualification System Migration
-- Adds fields to support multi-step qualification quiz and lead scoring

-- =============================================================================
-- ADD QUALIFICATION FIELDS TO LEADS TABLE
-- =============================================================================

-- Timeline: when are they looking to move
ALTER TABLE leads ADD COLUMN IF NOT EXISTS timeline VARCHAR(50);
COMMENT ON COLUMN leads.timeline IS 'When the lead is looking to move: within-30-days, 1-3-months, 3-6-months, 6-plus-months';

-- Property type
ALTER TABLE leads ADD COLUMN IF NOT EXISTS property_type VARCHAR(50);
COMMENT ON COLUMN leads.property_type IS 'Type of property: single-family, condo, townhouse, multi-family';

-- Value/Budget range
ALTER TABLE leads ADD COLUMN IF NOT EXISTS value_range VARCHAR(50);
COMMENT ON COLUMN leads.value_range IS 'Estimated property value range for sellers';

ALTER TABLE leads ADD COLUMN IF NOT EXISTS budget_range VARCHAR(50);
COMMENT ON COLUMN leads.budget_range IS 'Budget range for buyers';

-- Pre-approval status (for buyers)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS pre_approved BOOLEAN;
COMMENT ON COLUMN leads.pre_approved IS 'Whether buyer is pre-approved for mortgage';

-- Important factor (for sellers)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS important_factor VARCHAR(50);
COMMENT ON COLUMN leads.important_factor IS 'What matters most: speed, price, convenience';

-- Contact preference
ALTER TABLE leads ADD COLUMN IF NOT EXISTS contact_preference VARCHAR(50);
COMMENT ON COLUMN leads.contact_preference IS 'Best time to reach them: asap, morning, afternoon, evening';

-- Lead scoring fields
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT 0;
COMMENT ON COLUMN leads.lead_score IS 'Calculated lead score from 0-100 based on qualification';

-- Lead temperature enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_temperature') THEN
    CREATE TYPE lead_temperature AS ENUM ('hot', 'warm', 'nurture', 'cold');
  END IF;
END$$;

ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_temperature lead_temperature DEFAULT 'cold';
COMMENT ON COLUMN leads.lead_temperature IS 'Lead temperature based on score: hot (80+), warm (50-79), nurture (25-49), cold (0-24)';

-- Lead priority enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_priority') THEN
    CREATE TYPE lead_priority AS ENUM ('immediate', 'same-day', 'nurture', 'drip');
  END IF;
END$$;

ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_priority lead_priority DEFAULT 'drip';
COMMENT ON COLUMN leads.lead_priority IS 'Follow-up priority: immediate, same-day, nurture, drip';

-- =============================================================================
-- INDEXES FOR NEW FIELDS
-- =============================================================================

-- Index for filtering by lead temperature (for prioritization)
CREATE INDEX IF NOT EXISTS leads_temperature_idx ON leads (lead_temperature)
  WHERE status = 'active';

-- Index for filtering by lead score (for sorting)
CREATE INDEX IF NOT EXISTS leads_score_idx ON leads (lead_score DESC)
  WHERE status = 'active';

-- Index for filtering by timeline
CREATE INDEX IF NOT EXISTS leads_timeline_idx ON leads (timeline)
  WHERE status = 'active';

-- Composite index for hot lead queries
CREATE INDEX IF NOT EXISTS leads_hot_priority_idx ON leads (lead_temperature, lead_priority, created_at DESC)
  WHERE status = 'active' AND lead_temperature IN ('hot', 'warm');

-- =============================================================================
-- FUNCTION TO CALCULATE LEAD SCORE
-- =============================================================================

-- This function mirrors the TypeScript leadScoring logic
CREATE OR REPLACE FUNCTION calculate_lead_score(
  p_intent TEXT,
  p_timeline TEXT,
  p_property_type TEXT DEFAULT NULL,
  p_value_range TEXT DEFAULT NULL,
  p_budget_range TEXT DEFAULT NULL,
  p_important_factor TEXT DEFAULT NULL,
  p_pre_approved BOOLEAN DEFAULT NULL,
  p_contact_preference TEXT DEFAULT NULL
) RETURNS TABLE (
  score INTEGER,
  temperature lead_temperature,
  priority lead_priority
) AS $$
DECLARE
  v_score INTEGER := 0;
  v_timeline_score INTEGER := 0;
  v_intent_score INTEGER := 0;
  v_property_score INTEGER := 0;
  v_contact_score INTEGER := 0;
  v_temperature lead_temperature;
  v_priority lead_priority;
BEGIN
  -- Timeline scoring (max 40 points)
  v_timeline_score := CASE p_timeline
    WHEN 'within-30-days' THEN 40
    WHEN '1-3-months' THEN 25
    WHEN '3-6-months' THEN 15
    WHEN '6-plus-months' THEN 5
    ELSE 0
  END;

  -- Intent scoring (max 25 points)
  v_intent_score := CASE p_intent
    WHEN 'selling' THEN 20
    WHEN 'buying' THEN 15
    WHEN 'both' THEN 25
    WHEN 'home-value' THEN 10
    WHEN 'browsing' THEN 0
    ELSE 0
  END;

  -- Property details scoring (max 25 points)
  IF p_property_type IS NOT NULL THEN
    v_property_score := v_property_score + CASE p_property_type
      WHEN 'single-family' THEN 10
      WHEN 'townhouse' THEN 10
      WHEN 'condo' THEN 8
      WHEN 'multi-family' THEN 12
      ELSE 0
    END;
  END IF;

  IF p_important_factor IS NOT NULL THEN
    v_property_score := v_property_score + CASE p_important_factor
      WHEN 'speed' THEN 8
      WHEN 'price' THEN 5
      WHEN 'convenience' THEN 3
      ELSE 0
    END;
  END IF;

  -- Pre-approval for buyers
  IF p_intent IN ('buying', 'both') AND p_pre_approved IS NOT NULL THEN
    IF p_pre_approved THEN
      v_property_score := v_property_score + 15;
    ELSE
      v_property_score := v_property_score + 5;
    END IF;
  END IF;

  -- Value/budget range bonus
  IF p_value_range IS NOT NULL OR p_budget_range IS NOT NULL THEN
    v_property_score := v_property_score + 5;
  END IF;

  -- Contact preference scoring (max 10 points)
  v_contact_score := CASE p_contact_preference
    WHEN 'asap' THEN 10
    WHEN 'morning' THEN 5
    WHEN 'afternoon' THEN 5
    WHEN 'evening' THEN 3
    ELSE 0
  END;

  -- Calculate total score
  v_score := v_timeline_score + v_intent_score + v_property_score + v_contact_score;
  v_score := LEAST(100, GREATEST(0, v_score));

  -- Determine temperature
  v_temperature := CASE
    WHEN v_score >= 80 THEN 'hot'::lead_temperature
    WHEN v_score >= 50 THEN 'warm'::lead_temperature
    WHEN v_score >= 25 THEN 'nurture'::lead_temperature
    ELSE 'cold'::lead_temperature
  END;

  -- Determine priority
  v_priority := CASE v_temperature
    WHEN 'hot' THEN 'immediate'::lead_priority
    WHEN 'warm' THEN 'same-day'::lead_priority
    WHEN 'nurture' THEN 'nurture'::lead_priority
    ELSE 'drip'::lead_priority
  END;

  RETURN QUERY SELECT v_score, v_temperature, v_priority;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- TRIGGER TO AUTO-CALCULATE LEAD SCORE ON INSERT/UPDATE
-- =============================================================================

CREATE OR REPLACE FUNCTION auto_calculate_lead_score()
RETURNS TRIGGER AS $$
DECLARE
  v_result RECORD;
BEGIN
  -- Only recalculate if qualification fields changed or it's a new record
  IF TG_OP = 'INSERT' OR
     OLD.interest_type IS DISTINCT FROM NEW.interest_type OR
     OLD.timeline IS DISTINCT FROM NEW.timeline OR
     OLD.property_type IS DISTINCT FROM NEW.property_type OR
     OLD.value_range IS DISTINCT FROM NEW.value_range OR
     OLD.budget_range IS DISTINCT FROM NEW.budget_range OR
     OLD.important_factor IS DISTINCT FROM NEW.important_factor OR
     OLD.pre_approved IS DISTINCT FROM NEW.pre_approved OR
     OLD.contact_preference IS DISTINCT FROM NEW.contact_preference THEN

    -- Calculate the score
    SELECT * INTO v_result FROM calculate_lead_score(
      NEW.interest_type::TEXT,
      NEW.timeline,
      NEW.property_type,
      NEW.value_range,
      NEW.budget_range,
      NEW.important_factor,
      NEW.pre_approved,
      NEW.contact_preference
    );

    NEW.lead_score := v_result.score;
    NEW.lead_temperature := v_result.temperature;
    NEW.lead_priority := v_result.priority;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_auto_calculate_lead_score ON leads;

-- Create the trigger
CREATE TRIGGER trigger_auto_calculate_lead_score
  BEFORE INSERT OR UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION auto_calculate_lead_score();

-- =============================================================================
-- UPDATE VIEW FOR LEAD METRICS
-- =============================================================================

-- Drop and recreate the view to include new fields
DROP VIEW IF EXISTS lead_metrics;

CREATE VIEW lead_metrics AS
SELECT
  l.id,
  l.name,
  l.email,
  l.phone,
  l.town,
  l.zipcode,
  l.interest_type,
  l.timeline,
  l.lead_score,
  l.lead_temperature,
  l.lead_priority,
  l.status,
  l.created_at,
  c.name as campaign_name,
  c.slug as campaign_slug,
  CASE
    WHEN l.lead_temperature = 'hot' THEN '🔥 HOT - CALL NOW'
    WHEN l.lead_temperature = 'warm' THEN '🟠 Warm - Follow Up Today'
    WHEN l.lead_temperature = 'nurture' THEN '🟡 Nurture - Add to Drip'
    ELSE '⚪ Cold - Auto-Nurture'
  END as temperature_label,
  COUNT(se.id) FILTER (WHERE se.status IN ('sent', 'delivered')) as emails_sent,
  COUNT(se.id) FILTER (WHERE se.status IN ('opened', 'clicked')) as emails_opened
FROM leads l
LEFT JOIN campaigns c ON l.campaign_id = c.id
LEFT JOIN scheduled_emails se ON se.lead_id = l.id
GROUP BY l.id, c.id;

-- Grant access to service role
GRANT SELECT ON lead_metrics TO service_role;

-- =============================================================================
-- SEED DATA UPDATE (if needed)
-- =============================================================================

-- No seed data changes needed - existing leads will get default values
-- and new leads will have scores calculated automatically
