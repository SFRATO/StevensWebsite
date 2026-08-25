-- =============================================================================
-- 006: Hardening + the CRM's operational RPCs
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Delete the two PII-leaking views.
--
-- lead_metrics (002) selects l.name, l.email, l.phone.
-- lead_activity_summary (003) selects l.email, l.name.
-- Both are plain CREATE VIEW on PG15, i.e. security_invoker = off, i.e. they
-- execute as their owner (postgres) and therefore IGNORE row level security on
-- leads entirely. Supabase's bootstrap ALTER DEFAULT PRIVILEGES granted SELECT
-- on both to `anon`, and neither migration revoked it. Net effect: the public
-- anon key, which ships in the browser bundle, could dump every lead's name,
-- email and phone number from
--     GET /rest/v1/lead_metrics?select=*
--
-- Dropped rather than rebuilt because neither has a consumer — grepping src/,
-- netlify/ and supabase/functions/ for either name returns only their own
-- definitions. The CRM queries the base tables under RLS.
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.lead_metrics;
DROP VIEW IF EXISTS public.lead_activity_summary;


-- -----------------------------------------------------------------------------
-- 2. Rebuild campaign_metrics: correct arithmetic + security_invoker.
--
-- TWO bugs in the 001 version.
--
-- (a) It reads scheduled_emails.status, which is a SINGLE OVERWRITING column,
--     not a state history. ses-webhook-handler walks one row through
--     'delivered' -> 'opened' -> 'clicked'. The old view counts "sent" as
--     status IN ('sent','delivered'), so the moment a message is opened it
--     LEAVES the denominator. Open rate is therefore opened / (sent-and-never-
--     opened), which is not a rate at all and can exceed 100%.
--
--     Fix: sends come from scheduled_emails.sent_at IS NOT NULL, which is
--     write-once and never cleared (the stale-'sending' recovery sweep resets
--     `status` only). Engagement comes from email_events, which is append-only.
--     Note there is no event_type='SEND' row anywhere in the codebase — the
--     webhook writes only BOUNCE/COMPLAINT/DELIVERY/OPEN/CLICK — which is why
--     sent_at is the denominator rather than an event count.
--
-- (b) The LEFT JOIN campaigns -> leads -> scheduled_emails fans out, so counts
--     at different grains were computed over a multiplied row set. Rebuilt as
--     independent CTEs so each rollup keeps its own grain.
--
-- security_invoker = on means the view evaluates with the CALLER's permissions,
-- so leads' RLS applies and anon sees nothing even if a grant slips through.
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.campaign_metrics;

CREATE VIEW public.campaign_metrics
WITH (security_invoker = on) AS
WITH lead_rollup AS (
  SELECT campaign_id,
         COUNT(*)                                                AS total_leads,
         COUNT(*) FILTER (WHERE status = 'active')               AS active_leads,
         COUNT(*) FILTER (WHERE status = 'paused')               AS paused_leads,
         COUNT(*) FILTER (WHERE status = 'unsubscribed')         AS unsubscribed_leads,
         COUNT(*) FILTER (WHERE status = 'bounced')              AS bounced_leads,
         COUNT(*) FILTER (WHERE pipeline_stage = 'closed_won')   AS closed_won_leads,
         COUNT(*) FILTER (WHERE pipeline_stage = 'closed_lost')  AS closed_lost_leads
    FROM public.leads
   GROUP BY campaign_id
),
email_rollup AS (
  SELECT l.campaign_id,
         -- 'cancelled' rows were pulled deliberately (close-out or manual
         -- cancel) and are not a deliverability signal.
         COUNT(*) FILTER (WHERE se.status <> 'cancelled')  AS total_scheduled,
         COUNT(*) FILTER (WHERE se.status =  'cancelled')  AS total_cancelled,
         COUNT(*) FILTER (WHERE se.sent_at IS NOT NULL)    AS emails_sent,
         COUNT(*) FILTER (WHERE se.status =  'failed')     AS emails_failed,
         COUNT(DISTINCT se.id) FILTER (WHERE ev.opened)    AS emails_opened,
         COUNT(DISTINCT se.id) FILTER (WHERE ev.clicked)   AS emails_clicked,
         COUNT(DISTINCT se.id) FILTER (WHERE ev.bounced)   AS emails_bounced
    FROM public.scheduled_emails se
    JOIN public.leads l ON l.id = se.lead_id
    LEFT JOIN LATERAL (
      -- One pass over the append-only event stream per message. SES emits
      -- multiple OPEN events per message (every image load, every forward), so
      -- this collapses them to a boolean before they are counted.
      SELECT bool_or(e.event_type = 'OPEN')   AS opened,
             bool_or(e.event_type = 'CLICK')  AS clicked,
             bool_or(e.event_type = 'BOUNCE') AS bounced
        FROM public.email_events e
       WHERE e.scheduled_email_id = se.id
    ) ev ON TRUE
   GROUP BY l.campaign_id
)
SELECT
  c.id                               AS campaign_id,
  c.name                             AS campaign_name,
  c.slug                             AS campaign_slug,
  COALESCE(lr.total_leads, 0)        AS total_leads,
  COALESCE(lr.active_leads, 0)       AS active_leads,
  COALESCE(lr.paused_leads, 0)       AS paused_leads,
  COALESCE(lr.unsubscribed_leads, 0) AS unsubscribed_leads,
  COALESCE(lr.bounced_leads, 0)      AS bounced_leads,
  COALESCE(lr.closed_won_leads, 0)   AS closed_won_leads,
  COALESCE(lr.closed_lost_leads, 0)  AS closed_lost_leads,
  COALESCE(er.total_scheduled, 0)    AS total_emails_scheduled,
  COALESCE(er.total_cancelled, 0)    AS total_emails_cancelled,
  COALESCE(er.emails_sent, 0)        AS emails_sent,
  COALESCE(er.emails_failed, 0)      AS emails_failed,
  COALESCE(er.emails_opened, 0)      AS emails_opened,
  COALESCE(er.emails_clicked, 0)     AS emails_clicked,
  COALESCE(er.emails_bounced, 0)     AS emails_bounced,
  -- Both rates are out of SENDS, the only denominator that does not shrink as
  -- engagement arrives.
  ROUND(100.0 * er.emails_opened  / NULLIF(er.emails_sent, 0), 2) AS open_rate,
  ROUND(100.0 * er.emails_clicked / NULLIF(er.emails_sent, 0), 2) AS click_rate,
  ROUND(100.0 * er.emails_bounced / NULLIF(er.emails_sent, 0), 2) AS bounce_rate
FROM public.campaigns c
LEFT JOIN lead_rollup  lr ON lr.campaign_id = c.id
LEFT JOIN email_rollup er ON er.campaign_id = c.id;

REVOKE ALL    ON public.campaign_metrics FROM PUBLIC, anon, authenticated;
GRANT  SELECT ON public.campaign_metrics TO authenticated, service_role;


-- -----------------------------------------------------------------------------
-- 3. Remove dead, publicly-executable crypto.
--
-- generate_unsubscribe_token(UUID) (001) is:
--   * dead — real tokens come from supabase/functions/_shared/tokens.ts
--     (createToken). Nothing in src/, netlify/ or supabase/functions/ calls it.
--   * EXECUTE-granted to PUBLIC, because that is Postgres' default for
--     functions and 001 never revoked it. So the anon key can call it.
--   * broken — current_setting('app.settings.secret_key', true) is never set on
--     a Supabase project, so hmac() gets a NULL key and the function returns
--     NULL. A public token generator that emits NULL is exactly the sort of
--     thing that gets treated as real by whoever wires it up next.
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.generate_unsubscribe_token(UUID);

-- calculate_lead_score is internal scoring logic, not an API.
REVOKE ALL ON FUNCTION public.calculate_lead_score(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calculate_lead_score(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT
) TO authenticated, service_role;


-- -----------------------------------------------------------------------------
-- 4. Fix the intent-scoring VOCABULARY MISMATCH.
--
-- THE BUG. There are three copies of the scoring rules:
--   src/utils/leadScoring.ts         (browser)
--   handle-form-submission/index.ts  (edge, its own copy)
--   calculate_lead_score()           (002, the trigger's copy)
--
-- The first two speak the *Intent* vocabulary —
--   selling | buying | both | home-value | browsing
-- The database column is interest_type, a DIFFERENT enum —
--   selling | buying | both | investment | consultation
-- and handle-form-submission maps between them (home-value -> selling,
-- browsing -> consultation).
--
-- auto_calculate_lead_score() then passes NEW.interest_type::TEXT into a CASE
-- written against the Intent vocabulary. The overlap is only selling/buying/both.
-- Consequence:
--   * interest_type='investment'   -> ELSE -> 0 points (should be ~22)
--   * interest_type='consultation' -> ELSE -> 0 points (should be ~8)
--   * the 'home-value' and 'browsing' branches are unreachable dead code
--
-- An investor who says "within 30 days" scores 40 instead of ~65, lands in
-- 'nurture' instead of 'warm', and gets lead_priority='nurture' instead of
-- 'same-day'. The single highest-value lead type in the system is
-- systematically under-triaged. And because the trigger is BEFORE INSERT, it
-- OVERWRITES the value handle-form-submission just computed — so the browser
-- and edge copies are silently discarded regardless.
--
-- Fix: one function accepting BOTH vocabularies, and it becomes canonical.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lead_intent_points(p_intent TEXT)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT CASE p_intent
    -- interest_type enum (what is actually stored on leads)
    WHEN 'selling'      THEN 20
    WHEN 'buying'       THEN 15
    WHEN 'both'         THEN 25   -- two transactions, two commissions
    WHEN 'investment'   THEN 22   -- repeat transactor; below 'both', above 'buying'
    WHEN 'consultation' THEN 8    -- a real question, but no stated transaction
    -- Intent vocabulary (src/utils/leadScoring.ts), accepted so the same
    -- function scores a pre-mapping payload identically.
    WHEN 'home-value'   THEN 10
    WHEN 'browsing'     THEN 0
    ELSE 0
  END;
$fn$;

REVOKE ALL ON FUNCTION public.lead_intent_points(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lead_intent_points(TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.calculate_lead_score(
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
  -- Timeline (max 40)
  v_timeline_score := CASE p_timeline
    WHEN 'within-30-days' THEN 40
    WHEN '1-3-months'     THEN 25
    WHEN '3-6-months'     THEN 15
    WHEN '6-plus-months'  THEN 5
    ELSE 0
  END;

  -- Intent (max 25) — now vocabulary-correct. See lead_intent_points().
  v_intent_score := public.lead_intent_points(p_intent);

  -- Property details (max 25)
  IF p_property_type IS NOT NULL THEN
    v_property_score := v_property_score + CASE p_property_type
      WHEN 'single-family' THEN 10
      WHEN 'townhouse'     THEN 10
      WHEN 'condo'         THEN 8
      WHEN 'multi-family'  THEN 12
      ELSE 0
    END;
  END IF;

  IF p_important_factor IS NOT NULL THEN
    v_property_score := v_property_score + CASE p_important_factor
      WHEN 'speed'       THEN 8
      WHEN 'price'       THEN 5
      WHEN 'convenience' THEN 3
      ELSE 0
    END;
  END IF;

  -- Pre-approval. 'investment' joins buying/both: a financed investor is as
  -- qualified as a pre-approved owner-occupant.
  IF p_intent IN ('buying', 'both', 'investment') AND p_pre_approved IS NOT NULL THEN
    IF p_pre_approved THEN
      v_property_score := v_property_score + 15;
    ELSE
      v_property_score := v_property_score + 5;
    END IF;
  END IF;

  IF p_value_range IS NOT NULL OR p_budget_range IS NOT NULL THEN
    v_property_score := v_property_score + 5;
  END IF;

  -- Contact preference (max 10)
  v_contact_score := CASE p_contact_preference
    WHEN 'asap'      THEN 10
    WHEN 'morning'   THEN 5
    WHEN 'afternoon' THEN 5
    WHEN 'evening'   THEN 3
    ELSE 0
  END;

  v_score := v_timeline_score + v_intent_score + v_property_score + v_contact_score;
  v_score := LEAST(100, GREATEST(0, v_score));

  v_temperature := CASE
    WHEN v_score >= 80 THEN 'hot'::lead_temperature
    WHEN v_score >= 50 THEN 'warm'::lead_temperature
    WHEN v_score >= 25 THEN 'nurture'::lead_temperature
    ELSE 'cold'::lead_temperature
  END;

  v_priority := CASE v_temperature
    WHEN 'hot'     THEN 'immediate'::lead_priority
    WHEN 'warm'    THEN 'same-day'::lead_priority
    WHEN 'nurture' THEN 'nurture'::lead_priority
    ELSE 'drip'::lead_priority
  END;

  RETURN QUERY SELECT v_score, v_temperature, v_priority;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- -----------------------------------------------------------------------------
-- 5. Honour lead_score_locked.
--
-- THE BUG THIS FIXES, precisely. The trigger recomputes whenever ANY
-- qualification column changes, and handle-form-submission writes exactly those
-- columns on a returning-lead submission. So:
--
--   1. Steven speaks to a lead, learns they are ready to list next week, and
--      hand-sets lead_score = 95 / lead_temperature = 'hot' in the CRM.
--   2. Days later the same person fills in a market-report form for another
--      town. handle-form-submission updates their `timeline` column.
--   3. This trigger fires, sees timeline IS DISTINCT FROM, recomputes from the
--      form data alone, and silently overwrites 95 with e.g. 45 / 'nurture'.
--      PostgREST returns 200. No error, anywhere.
--   4. The lead vanishes from the hot list. Nobody knows why.
--
-- lead_score_locked makes the human judgement sticky. Honoured only on UPDATE:
-- on INSERT there is no prior judgement to protect.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_calculate_lead_score()
RETURNS TRIGGER AS $$
DECLARE
  v_result RECORD;
BEGIN
  IF TG_OP = 'UPDATE' AND COALESCE(NEW.lead_score_locked, FALSE) THEN
    -- Preserve stored values verbatim, including against a client that
    -- resubmits stale score columns in the same UPDATE.
    NEW.lead_score       := OLD.lead_score;
    NEW.lead_temperature := OLD.lead_temperature;
    NEW.lead_priority    := OLD.lead_priority;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' OR
     OLD.interest_type      IS DISTINCT FROM NEW.interest_type      OR
     OLD.timeline           IS DISTINCT FROM NEW.timeline           OR
     OLD.property_type      IS DISTINCT FROM NEW.property_type      OR
     OLD.value_range        IS DISTINCT FROM NEW.value_range        OR
     OLD.budget_range       IS DISTINCT FROM NEW.budget_range       OR
     OLD.important_factor   IS DISTINCT FROM NEW.important_factor   OR
     OLD.pre_approved       IS DISTINCT FROM NEW.pre_approved       OR
     OLD.contact_preference IS DISTINCT FROM NEW.contact_preference THEN

    SELECT * INTO v_result FROM public.calculate_lead_score(
      NEW.interest_type::TEXT,
      NEW.timeline,
      NEW.property_type,
      NEW.value_range,
      NEW.budget_range,
      NEW.important_factor,
      NEW.pre_approved,
      NEW.contact_preference
    );

    NEW.lead_score       := v_result.score;
    NEW.lead_temperature := v_result.temperature;
    NEW.lead_priority    := v_result.priority;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- =============================================================================
-- 6. CRM operational RPCs
--
-- All SECURITY DEFINER + is_admin()-gated + SET search_path = ''. Each exists
-- because it enforces a MULTI-STATEMENT INVARIANT that a client-side UPDATE
-- cannot uphold: rescheduling a step must resync leads.next_email_at in the same
-- transaction, or the cron and the CRM disagree about what happens next.
--
-- Deliberately NOT wrapped in RPCs: logging an outbound email and marking a
-- message replied. Those are single statements that RLS + crm_set_created_by
-- already make safe and unspoofable. A SECURITY DEFINER wrapper around a single
-- governed statement is ceremony plus one more search_path to get wrong.
-- =============================================================================

-- Internal: recompute leads.next_email_at from the queue. Not gated itself; it
-- is only reachable from a gated caller, and the grant below closes it off.
CREATE OR REPLACE FUNCTION public.crm_resync_next_email(p_lead_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $fn$
  UPDATE public.leads l
     SET next_email_at = (
           SELECT MIN(se.scheduled_for)
             FROM public.scheduled_emails se
            WHERE se.lead_id = l.id
              AND se.status  = 'pending'
         )
   WHERE l.id = p_lead_id
     AND l.status = 'active';   -- a paused lead has no next email, by definition
$fn$;

REVOKE ALL ON FUNCTION public.crm_resync_next_email(UUID) FROM PUBLIC, anon, authenticated;


-- ---------------------------------------------------------------------------
-- Manual drip control: pause / resume.
--
-- Resume recomputes next_email_at from the queue rather than trusting a stale
-- timestamp, so a lead paused for six weeks does not resume by firing six
-- overdue emails at once.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crm_set_drip(p_lead_id UUID, p_enabled BOOLEAN)
RETURNS public.lead_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE v_status public.lead_status;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT status INTO v_status FROM public.leads WHERE id = p_lead_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'lead % not found', p_lead_id USING ERRCODE = 'P0002';
  END IF;

  IF p_enabled THEN
    IF v_status IN ('unsubscribed','bounced') THEN
      RAISE EXCEPTION
        'lead % is %; drip cannot be resumed. Only a fresh opt-in through the public form may re-subscribe them.',
        p_lead_id, v_status USING ERRCODE = '42501';
    END IF;
    UPDATE public.leads SET status = 'active' WHERE id = p_lead_id;
    PERFORM public.crm_resync_next_email(p_lead_id);
  ELSE
    UPDATE public.leads SET status = 'paused', next_email_at = NULL WHERE id = p_lead_id;
  END IF;

  SELECT status INTO v_status FROM public.leads WHERE id = p_lead_id;
  RETURN v_status;
END;
$fn$;


-- ---------------------------------------------------------------------------
-- Manual drip control: reschedule / cancel one queued step.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crm_reschedule_email(
  p_scheduled_email_id UUID,
  p_scheduled_for      TIMESTAMPTZ
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE v_lead uuid; v_status public.email_status;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT lead_id, status INTO v_lead, v_status
    FROM public.scheduled_emails WHERE id = p_scheduled_email_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'scheduled email % not found', p_scheduled_email_id USING ERRCODE='P0002';
  END IF;

  -- Only a queued step can be moved. 'sending' is mid-flight at SES and
  -- everything else has already left.
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'scheduled email % is %; only pending steps can be rescheduled',
      p_scheduled_email_id, v_status USING ERRCODE = '22023';
  END IF;

  UPDATE public.scheduled_emails
     SET scheduled_for = p_scheduled_for
   WHERE id = p_scheduled_email_id;

  PERFORM public.crm_resync_next_email(v_lead);
  RETURN p_scheduled_for;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.crm_cancel_email(
  p_scheduled_email_id UUID,
  p_reason             TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE v_lead uuid; v_status public.email_status;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT lead_id, status INTO v_lead, v_status
    FROM public.scheduled_emails WHERE id = p_scheduled_email_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'scheduled email % not found', p_scheduled_email_id USING ERRCODE='P0002';
  END IF;
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'scheduled email % is %; only pending steps can be cancelled',
      p_scheduled_email_id, v_status USING ERRCODE = '22023';
  END IF;

  -- 'cancelled', not 'failed'. A cancelled step is a decision, not a
  -- deliverability problem, and campaign_metrics excludes it from the rollups.
  UPDATE public.scheduled_emails
     SET status = 'cancelled',
         error_message = COALESCE(p_reason, 'Cancelled from CRM')
   WHERE id = p_scheduled_email_id;

  PERFORM public.crm_resync_next_email(v_lead);
END;
$fn$;


-- ---------------------------------------------------------------------------
-- Manual drip control: (re-)enroll a lead in a campaign.
--
-- This is why scheduled_emails carries enrollment_seq. Under the original
-- UNIQUE(lead_id, campaign_step_id), a second pass through the same campaign
-- was a hard constraint violation. Bumping the sequence makes the second pass a
-- distinct set of rows, so pass 1's history stays intact and legible.
--
-- CAN-SPAM: refuses unsubscribed and bounced leads outright. The same rule is
-- enforced at the table by crm_guard_resubscribe (004), so it holds even
-- against a direct UPDATE from the client.
--
-- Send times are computed in America/New_York so campaign_steps.send_hour keeps
-- meaning "10am local" across a DST boundary.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crm_enroll_lead(
  p_lead_id     UUID,
  p_campaign_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_status public.lead_status;
  v_seq    integer;
  v_n      integer := 0;
  v_actor  uuid := auth.uid();
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT status INTO v_status FROM public.leads WHERE id = p_lead_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'lead % not found', p_lead_id USING ERRCODE = 'P0002';
  END IF;

  IF v_status IN ('unsubscribed','bounced') THEN
    RAISE EXCEPTION
      'lead % is %; enrolling them would mail someone who opted out or hard-bounced (CAN-SPAM / SES reputation).',
      p_lead_id, v_status USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.campaigns WHERE id = p_campaign_id AND is_active) THEN
    RAISE EXCEPTION 'campaign % not found or inactive', p_campaign_id USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(MAX(enrollment_seq), 0) + 1 INTO v_seq
    FROM public.scheduled_emails WHERE lead_id = p_lead_id;

  -- Retire whatever is still queued from the previous pass.
  UPDATE public.scheduled_emails
     SET status = 'cancelled', error_message = 'Superseded by re-enrollment'
   WHERE lead_id = p_lead_id AND status = 'pending';

  INSERT INTO public.scheduled_emails
    (lead_id, campaign_step_id, scheduled_for, status, enrollment_seq)
  SELECT
    p_lead_id,
    cs.id,
    (   date_trunc('day', NOW() AT TIME ZONE 'America/New_York')
      + make_interval(days => cs.delay_days, hours => cs.send_hour)
    ) AT TIME ZONE 'America/New_York',
    'pending',
    v_seq
  FROM public.campaign_steps cs
  WHERE cs.campaign_id = p_campaign_id
  ORDER BY cs.step_number;

  GET DIAGNOSTICS v_n = ROW_COUNT;

  UPDATE public.leads
     SET campaign_id  = p_campaign_id,
         current_step = 0,
         status       = CASE WHEN status = 'paused' THEN 'active'::public.lead_status
                             ELSE status END
   WHERE id = p_lead_id;

  PERFORM public.crm_resync_next_email(p_lead_id);

  INSERT INTO public.crm_audit_log (actor_id, table_name, action, record_id, lead_id, delta)
  VALUES (v_actor, 'leads', 'crm_enroll_lead', p_lead_id, p_lead_id,
          jsonb_build_object('campaign_id', p_campaign_id,
                             'enrollment_seq', v_seq,
                             'steps_queued', v_n));

  RETURN v_n;
END;
$fn$;


-- ---------------------------------------------------------------------------
-- Unified timeline.
--
-- Three sources, one chronology. The LIMIT is pushed into each branch before
-- the UNION so Postgres can use crm_interactions_lead_time_idx,
-- lead_activity_lead_time_idx (003) and scheduled_emails' lead FK rather than
-- materialising a lead's entire history and sorting it. On a lead with 4,000
-- page views that is the whole difference.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crm_lead_timeline(
  p_lead_id UUID,
  p_limit   INTEGER DEFAULT 50
)
RETURNS TABLE (
  source      TEXT,
  ref_id      UUID,
  occurred_at TIMESTAMPTZ,
  kind        TEXT,
  direction   TEXT,
  title       TEXT,
  body        TEXT,
  meta        JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  WITH lim AS (SELECT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 500) AS n),
  interactions AS (
    SELECT 'interaction'::text, i.id, i.occurred_at, i.type, i.direction,
           COALESCE(i.subject, initcap(i.type)), i.body,
           jsonb_build_object('outcome', i.outcome,
                              'duration_minutes', i.duration_minutes,
                              'source_path', i.source_path,
                              'replied_at', i.replied_at,
                              'created_by', i.created_by)
      FROM public.crm_interactions i, lim
     WHERE i.lead_id = p_lead_id
     ORDER BY i.occurred_at DESC
     LIMIT (SELECT n FROM lim)
  ),
  activity AS (
    SELECT 'activity'::text, a.id, a.occurred_at, a.event_type, NULL::text,
           a.path, NULL::text,
           jsonb_build_object('town', a.town, 'zipcode', a.zipcode,
                              'county', a.county, 'metadata', a.metadata)
      FROM public.lead_activity a, lim
     WHERE a.lead_id = p_lead_id
     ORDER BY a.occurred_at DESC
     LIMIT (SELECT n FROM lim)
  ),
  emails AS (
    SELECT 'campaign_email'::text, se.id,
           COALESCE(se.sent_at, se.scheduled_for),
           se.status::text, 'outbound'::text,
           cs.subject_template, NULL::text,
           jsonb_build_object('step_number', cs.step_number,
                              'template_id', cs.template_id,
                              'enrollment_seq', se.enrollment_seq,
                              'scheduled_for', se.scheduled_for,
                              'sent_at', se.sent_at,
                              'opened_at', se.opened_at,
                              'clicked_at', se.clicked_at,
                              'error_message', se.error_message)
      FROM public.scheduled_emails se
      JOIN public.campaign_steps cs ON cs.id = se.campaign_step_id, lim
     WHERE se.lead_id = p_lead_id
     ORDER BY COALESCE(se.sent_at, se.scheduled_for) DESC
     LIMIT (SELECT n FROM lim)
  )
  SELECT * FROM (
    SELECT * FROM interactions
    UNION ALL SELECT * FROM activity
    UNION ALL SELECT * FROM emails
  ) t (source, ref_id, occurred_at, kind, direction, title, body, meta)
  WHERE (SELECT public.is_admin())
  ORDER BY occurred_at DESC
  LIMIT (SELECT n FROM lim);
$fn$;


-- ---------------------------------------------------------------------------
-- Audited deletion.
--
-- leads has no DELETE grant (005) because leads.id is the parent of several
-- ON DELETE CASCADE foreign keys. A stray DELETE from a dashboard is silent and
-- unrecoverable. This is the one supported route, and it writes a full snapshot
-- to the audit log first so the record survives the cascade.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crm_purge_lead(p_lead_id UUID, p_reason TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_row   jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(btrim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'a reason is required to purge a lead' USING ERRCODE = '22023';
  END IF;

  SELECT to_jsonb(l) INTO v_row FROM public.leads l WHERE l.id = p_lead_id;
  IF v_row IS NULL THEN
    RAISE EXCEPTION 'lead % not found', p_lead_id USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.crm_audit_log (actor_id, table_name, action, record_id, lead_id, delta)
  VALUES (v_actor, 'leads', 'crm_purge_lead', p_lead_id, p_lead_id,
          jsonb_build_object(
            'reason', p_reason,
            'snapshot', v_row,
            'cascade_counts', jsonb_build_object(
              'scheduled_emails', (SELECT count(*) FROM public.scheduled_emails WHERE lead_id = p_lead_id),
              'lead_activity',    (SELECT count(*) FROM public.lead_activity    WHERE lead_id = p_lead_id),
              'behavior_sends',   (SELECT count(*) FROM public.behavior_sends   WHERE lead_id = p_lead_id),
              'crm_interactions', (SELECT count(*) FROM public.crm_interactions WHERE lead_id = p_lead_id),
              'crm_tasks',        (SELECT count(*) FROM public.crm_tasks        WHERE lead_id = p_lead_id)
            )));

  DELETE FROM public.leads WHERE id = p_lead_id;
END;
$fn$;


-- ---------------------------------------------------------------------------
-- Function grants. Postgres grants EXECUTE to PUBLIC by default, so each must
-- be revoked before being re-granted, or `anon` can call it.
-- ---------------------------------------------------------------------------
DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.crm_set_drip(uuid, boolean)',
    'public.crm_reschedule_email(uuid, timestamptz)',
    'public.crm_cancel_email(uuid, text)',
    'public.crm_enroll_lead(uuid, uuid)',
    'public.crm_lead_timeline(uuid, integer)',
    'public.crm_purge_lead(uuid, text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', fn);
  END LOOP;
END$$;
