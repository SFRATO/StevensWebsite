-- =============================================================================
-- 004: CRM core — pipeline stages, unified interaction thread, tasks, tags, audit
-- =============================================================================
--
-- Scope note: there is deliberately NO deals/transactions table. Pipeline stage
-- on the lead is the single source of truth for where a relationship stands; a
-- second object would be a 1:1 shadow of `leads` needing a sync trigger, and the
-- first thing that goes wrong is stage and deal-status disagreeing.
--
-- Everything here is additive. Nothing changes the behaviour of the existing
-- edge functions, all of which connect as service_role (BYPASSRLS) and with
-- auth.uid() = NULL, since a service-role JWT carries no `sub` claim.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- pipeline_stage — sales progress. DELIBERATELY SEPARATE FROM leads.status.
--
-- leads.status (lead_status) answers exactly one question: "may we send this
-- person an automated email?" It is read as `=== 'active'` in three places:
--   supabase/functions/send-scheduled-emails/index.ts:2828   (fails the row)
--   supabase/functions/send-behavior-triggers/index.ts:504   (.eq status active)
--   netlify/functions/track-activity.ts:126                  (drops the beacon)
-- Overloading it with sales meaning would silently switch off the drip, the
-- behaviour triggers AND on-site activity capture the moment a lead was marked
-- "contacted". Hence a separate column.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pipeline_stage') THEN
    CREATE TYPE pipeline_stage AS ENUM (
      'new',              -- form submitted, never touched
      'attempted',        -- we reached out, no two-way contact yet
      'contacted',        -- actually spoke, or they replied
      'appointment_set',  -- listing presentation or buyer consult booked
      'agreement_signed', -- listing agreement or buyer agency executed
      'under_contract',
      'closed_won',
      'closed_lost'
    );
  END IF;
END$$;


-- -----------------------------------------------------------------------------
-- leads: CRM columns
-- -----------------------------------------------------------------------------
ALTER TABLE leads ADD COLUMN IF NOT EXISTS pipeline_stage      pipeline_stage NOT NULL DEFAULT 'new';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS stage_changed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_contacted_at   TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_interaction_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_follow_up_at   TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lost_reason         TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS admin_notes         TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_score_locked   BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS submission_type     TEXT;

COMMENT ON COLUMN leads.status IS
  'EMAIL ELIGIBILITY ONLY. Read as = ''active'' by send-scheduled-emails, '
  'send-behavior-triggers and netlify/functions/track-activity. Sales progress '
  'lives in pipeline_stage. The value ''converted'' is DEPRECATED and never '
  'written — use pipeline_stage = ''closed_won''.';
COMMENT ON COLUMN leads.pipeline_stage IS
  'Sales progress. Independent of leads.status, which governs email eligibility.';
COMMENT ON COLUMN leads.last_contacted_at IS
  'Last time WE reached out (outbound only). Drives the "gone cold" queue.';
COMMENT ON COLUMN leads.last_interaction_at IS
  'Last interaction in either direction, including inbound form messages.';
COMMENT ON COLUMN leads.lead_score_locked IS
  'When true, auto_calculate_lead_score() will not overwrite a hand-set score.';
COMMENT ON COLUMN leads.submission_type IS
  'Which form produced this lead: market-report | contact. Sent as submission_type '
  'by netlify/functions/handle-market-report.ts.';


-- -----------------------------------------------------------------------------
-- crm_interactions — ONE unified per-lead thread.
--
-- Contact-form messages land here with type='form', direction='inbound' rather
-- than in a separate lead_messages table. A separate table would make every
-- "what has happened with this person" query a UNION, and would put the
-- "who is waiting on a reply" queue in a different place from the reply itself.
--
-- Kept distinct from lead_activity, which is machine-generated, unbounded, and
-- documented in 003 as deliberately PII-free telemetry.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_interactions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id      UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,

  type         TEXT NOT NULL,
  direction    TEXT,
  outcome      TEXT,

  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_minutes INTEGER,

  subject      TEXT,
  body         TEXT,

  -- Page the inbound form message was submitted from.
  source_path  TEXT,

  -- Non-null once an inbound message has been answered. Powers the
  -- "needs a reply" queue. Only ever set on inbound rows.
  replied_at   TIMESTAMPTZ,

  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE crm_interactions DROP CONSTRAINT IF EXISTS crm_interactions_type_chk;
ALTER TABLE crm_interactions ADD  CONSTRAINT crm_interactions_type_chk
  CHECK (type IN ('call','text','email','meeting','voicemail','note','form'));

ALTER TABLE crm_interactions DROP CONSTRAINT IF EXISTS crm_interactions_direction_chk;
ALTER TABLE crm_interactions ADD  CONSTRAINT crm_interactions_direction_chk
  CHECK (direction IS NULL OR direction IN ('inbound','outbound'));

ALTER TABLE crm_interactions DROP CONSTRAINT IF EXISTS crm_interactions_outcome_chk;
ALTER TABLE crm_interactions ADD  CONSTRAINT crm_interactions_outcome_chk
  CHECK (outcome IS NULL OR outcome IN
    ('connected','no_answer','left_voicemail','bad_number','not_interested'));

-- A note is a private observation, not a communication: no direction, no outcome.
-- Everything else IS a communication and must say which way it went.
ALTER TABLE crm_interactions DROP CONSTRAINT IF EXISTS crm_interactions_note_shape_chk;
ALTER TABLE crm_interactions ADD  CONSTRAINT crm_interactions_note_shape_chk
  CHECK (
    (type =  'note' AND direction IS NULL AND outcome IS NULL)
    OR
    (type <> 'note' AND direction IS NOT NULL)
  );

-- A form submission is by definition something they sent us.
ALTER TABLE crm_interactions DROP CONSTRAINT IF EXISTS crm_interactions_form_inbound_chk;
ALTER TABLE crm_interactions ADD  CONSTRAINT crm_interactions_form_inbound_chk
  CHECK (type <> 'form' OR direction = 'inbound');

-- replied_at is meaningless on something we sent.
ALTER TABLE crm_interactions DROP CONSTRAINT IF EXISTS crm_interactions_replied_chk;
ALTER TABLE crm_interactions ADD  CONSTRAINT crm_interactions_replied_chk
  CHECK (replied_at IS NULL OR direction = 'inbound');

COMMENT ON TABLE crm_interactions IS
  'Unified per-lead thread: human outreach AND inbound contact-form messages. '
  'Low volume, editable. Distinct from lead_activity (machine-generated web behaviour).';


-- -----------------------------------------------------------------------------
-- crm_tasks — to-dos and appointments in one table, discriminated by `kind`.
--
-- A separate appointments table would duplicate title/notes/status/completion
-- and force "what is on my plate" to be a UNION. The only real difference is
-- that an appointment occupies a time slot: one nullable column plus a CHECK.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id      UUID REFERENCES leads(id) ON DELETE CASCADE,

  kind         TEXT NOT NULL DEFAULT 'task',
  status       TEXT NOT NULL DEFAULT 'open',

  title        TEXT NOT NULL,
  notes        TEXT,

  due_at       TIMESTAMPTZ,   -- tasks
  starts_at    TIMESTAMPTZ,   -- appointments
  ends_at      TIMESTAMPTZ,
  location     TEXT,

  completed_at TIMESTAMPTZ,
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE crm_tasks DROP CONSTRAINT IF EXISTS crm_tasks_kind_chk;
ALTER TABLE crm_tasks ADD  CONSTRAINT crm_tasks_kind_chk
  CHECK (kind IN ('task','appointment'));

ALTER TABLE crm_tasks DROP CONSTRAINT IF EXISTS crm_tasks_status_chk;
ALTER TABLE crm_tasks ADD  CONSTRAINT crm_tasks_status_chk
  CHECK (status IN ('open','done','cancelled'));

ALTER TABLE crm_tasks DROP CONSTRAINT IF EXISTS crm_tasks_appointment_chk;
ALTER TABLE crm_tasks ADD  CONSTRAINT crm_tasks_appointment_chk
  CHECK (kind <> 'appointment' OR starts_at IS NOT NULL);

ALTER TABLE crm_tasks DROP CONSTRAINT IF EXISTS crm_tasks_span_chk;
ALTER TABLE crm_tasks ADD  CONSTRAINT crm_tasks_span_chk
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at);

ALTER TABLE crm_tasks DROP CONSTRAINT IF EXISTS crm_tasks_done_chk;
ALTER TABLE crm_tasks ADD  CONSTRAINT crm_tasks_done_chk
  CHECK (status <> 'done' OR completed_at IS NOT NULL);


-- -----------------------------------------------------------------------------
-- Tags
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_tags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT NOT NULL UNIQUE,
  label      TEXT NOT NULL,
  color      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_lead_tags (
  lead_id    UUID NOT NULL REFERENCES leads(id)    ON DELETE CASCADE,
  tag_id     UUID NOT NULL REFERENCES crm_tags(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (lead_id, tag_id)
);

-- Reverse lookup ("all leads tagged X"); the PK only serves lead_id-first.
CREATE INDEX IF NOT EXISTS crm_lead_tags_tag_idx ON crm_lead_tags (tag_id, lead_id);

INSERT INTO crm_tags (slug, label, color) VALUES
  ('past-client', 'Past Client', '#4ADE80'),
  ('referral',    'Referral',    '#3D8BFF'),
  ('sphere',      'Sphere',      '#6FB2FF'),
  ('do-not-call', 'Do Not Call', '#FF6B6B'),
  ('relocation',  'Relocation',  '#A2AAB5')
ON CONFLICT (slug) DO NOTHING;


-- -----------------------------------------------------------------------------
-- crm_audit_log — HUMAN ACTIONS ONLY. This is the whole design constraint.
--
-- send-scheduled-emails UPDATEs leads.current_step and leads.next_email_at on
-- EVERY send (index.ts ~:2868 and ~:2890), and ses-webhook-handler UPDATEs
-- scheduled_emails on every delivery/open/click. A naive row-level audit trigger
-- would write tens of thousands of machine rows a month and bury the handful
-- that matter.
--
-- The gate is `auth.uid() IS NULL -> RETURN`. Every edge function connects with
-- a service-role credential whose JWT carries no `sub` claim, so auth.uid() is
-- NULL and nothing is logged. A browser request from the admin carries a user
-- JWT with `sub`, so it is.
--
-- Scoped to leads + scheduled_emails only. The crm_* tables are append-mostly
-- and already carry created_by/created_at/updated_at — a row in them IS the
-- audit record, so auditing them produces a log of the log.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_audit_log (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_id    UUID,
  table_name  TEXT NOT NULL,
  action      TEXT NOT NULL,          -- INSERT | UPDATE | DELETE | <rpc name>
  record_id   UUID,
  lead_id     UUID,
  delta       JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS crm_audit_log_time_idx ON crm_audit_log (occurred_at DESC);
CREATE INDEX IF NOT EXISTS crm_audit_log_lead_idx ON crm_audit_log (lead_id, occurred_at DESC)
  WHERE lead_id IS NOT NULL;

COMMENT ON COLUMN crm_audit_log.delta IS
  'UPDATE: {col: {old, new}} for changed columns only, minus updated_at. '
  'INSERT: the new row minus updated_at. DELETE: the old row.';

CREATE OR REPLACE FUNCTION public.crm_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER          -- writes crm_audit_log, which is SELECT-only to the admin
SET search_path = ''
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_old   jsonb;
  v_new   jsonb;
  v_delta jsonb;
  v_rec   uuid;
  v_lead  uuid;
  -- updated_at is stamped by update_updated_at_column() on every UPDATE and
  -- would make every delta non-empty, defeating "only log real changes".
  v_skip  text[] := ARRAY['updated_at'];
BEGIN
  IF v_actor IS NULL THEN
    RETURN NULL;  -- machine write (service_role). Not audited, by design.
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_delta := v_old;
  ELSIF TG_OP = 'INSERT' THEN
    v_new := to_jsonb(NEW);
    v_delta := v_new - v_skip;
  ELSE
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    SELECT jsonb_object_agg(k, jsonb_build_object('old', v_old -> k, 'new', v_new -> k))
      INTO v_delta
      FROM jsonb_object_keys(v_new) AS t(k)
     WHERE NOT (k = ANY (v_skip))
       AND (v_old -> k) IS DISTINCT FROM (v_new -> k);

    IF v_delta IS NULL THEN
      RETURN NULL;  -- nothing changed but updated_at
    END IF;
  END IF;

  v_rec  := NULLIF(COALESCE(v_new ->> 'id', v_old ->> 'id'), '')::uuid;
  v_lead := CASE
              WHEN TG_TABLE_NAME = 'leads' THEN v_rec
              ELSE NULLIF(COALESCE(v_new ->> 'lead_id', v_old ->> 'lead_id'), '')::uuid
            END;

  INSERT INTO public.crm_audit_log (actor_id, table_name, action, record_id, lead_id, delta)
  VALUES (v_actor, TG_TABLE_NAME, TG_OP, v_rec, v_lead, v_delta);

  RETURN NULL;  -- AFTER trigger; return value ignored
END;
$fn$;

DROP TRIGGER IF EXISTS crm_audit_leads ON leads;
CREATE TRIGGER crm_audit_leads
  AFTER INSERT OR UPDATE OR DELETE ON leads
  FOR EACH ROW EXECUTE FUNCTION public.crm_audit();

-- Audited because manual drip control (reschedule / cancel a queued step) is a
-- human decision worth a paper trail. The machine churn on this table — cron
-- status transitions and SES webhook updates — is filtered by the uid gate.
DROP TRIGGER IF EXISTS crm_audit_scheduled_emails ON scheduled_emails;
CREATE TRIGGER crm_audit_scheduled_emails
  AFTER INSERT OR UPDATE OR DELETE ON scheduled_emails
  FOR EACH ROW EXECUTE FUNCTION public.crm_audit();


-- -----------------------------------------------------------------------------
-- updated_at on the new tables (function defined in 001)
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS update_crm_interactions_updated_at ON crm_interactions;
CREATE TRIGGER update_crm_interactions_updated_at
  BEFORE UPDATE ON crm_interactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_crm_tasks_updated_at ON crm_tasks;
CREATE TRIGGER update_crm_tasks_updated_at
  BEFORE UPDATE ON crm_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- -----------------------------------------------------------------------------
-- Stage transition bookkeeping.
--
-- ⚠️ MUST REMAIN A **BEFORE** TRIGGER. It mutates NEW in place and never issues
-- a statement, which is what keeps it non-recursive. Rewritten as AFTER with an
-- `UPDATE leads`, it recurses infinitely on the close path.
--
-- TRIGGER NAME IS LOAD-BEARING. Postgres fires same-timing row triggers in
-- alphabetical order. On leads that gives:
--   BEFORE INSERT: assign_campaign_on_lead_insert (001)
--                > crm_lead_stage_transition      (here)
--                > trigger_auto_calculate_lead_score (002)
--   BEFORE UPDATE: crm_guard_resubscribe          (here)
--                > crm_lead_stage_transition      (here)
--                > trigger_auto_calculate_lead_score (002)
--                > update_leads_updated_at        (001)
-- Safe: the three touch disjoint columns. If you ever add a BEFORE INSERT
-- trigger that must precede campaign assignment, it needs a name sorting
-- before 'assign_'.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crm_lead_stage_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.stage_changed_at := COALESCE(NEW.stage_changed_at, NOW());
    RETURN NEW;
  END IF;

  IF NEW.pipeline_stage IS NOT DISTINCT FROM OLD.pipeline_stage THEN
    RETURN NEW;
  END IF;

  NEW.stage_changed_at := NOW();

  IF NEW.pipeline_stage = 'closed_won' THEN
    NEW.converted_at := COALESCE(NEW.converted_at, NOW());
  END IF;

  IF NEW.pipeline_stage IN ('closed_won', 'closed_lost') THEN
    -- Stop the drip. 'paused' rather than the deprecated 'converted' because
    -- nothing in the codebase reads 'converted', whereas all three eligibility
    -- checks are `status = 'active'` — so 'paused' is the value that actually
    -- works, and it is reversible if a deal falls through.
    --
    -- GUARD: only downgrade FROM 'active'. Blindly writing 'paused' over
    -- 'unsubscribed' or 'bounced' would RE-ENABLE email for someone who opted
    -- out or hard-bounced — a CAN-SPAM violation and an SES reputation hit.
    IF OLD.status = 'active' THEN
      NEW.status := 'paused';
    END IF;
    NEW.next_email_at := NULL;
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS crm_lead_stage_transition ON leads;
CREATE TRIGGER crm_lead_stage_transition
  BEFORE INSERT OR UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION public.crm_lead_stage_transition();


-- -----------------------------------------------------------------------------
-- Re-subscribe guard.
--
-- 005 grants the admin plain UPDATE on leads, which means the CRM UI could set
-- status='active' on an unsubscribed or bounced lead directly and bypass the
-- CAN-SPAM check inside crm_enroll_lead(). Without this, that check is
-- decorative. Machine writes (auth.uid() IS NULL) are exempt: a genuine
-- re-opt-in arrives through handle-form-submission as service_role.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crm_guard_resubscribe()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $fn$
BEGIN
  IF auth.uid() IS NOT NULL
     AND OLD.status IN ('unsubscribed', 'bounced')
     AND NEW.status = 'active' THEN
    RAISE EXCEPTION
      'lead % is %; it cannot be reactivated from the CRM. Only a fresh opt-in through the public form may do this.',
      OLD.id, OLD.status
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS crm_guard_resubscribe ON leads;
CREATE TRIGGER crm_guard_resubscribe
  BEFORE UPDATE OF status ON leads
  FOR EACH ROW EXECUTE FUNCTION public.crm_guard_resubscribe();


-- -----------------------------------------------------------------------------
-- Close-out: retire the queued drip.
--
-- Marks pending rows 'cancelled', not 'failed'. The existing path for a
-- non-active lead (send-scheduled-emails/index.ts:2832) writes status='failed',
-- error_message='Lead is paused' — which makes every closed deal look like a
-- delivery failure in the health rollups. 006's campaign_metrics excludes
-- 'cancelled' from those rollups.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crm_cancel_queued_on_close()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $fn$
BEGIN
  UPDATE scheduled_emails
     SET status = 'cancelled',
         error_message = 'Cancelled: lead moved to ' || NEW.pipeline_stage::text
   WHERE lead_id = NEW.id
     AND status = 'pending';
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS crm_cancel_queued_on_close ON leads;
CREATE TRIGGER crm_cancel_queued_on_close
  AFTER UPDATE OF pipeline_stage ON leads
  FOR EACH ROW
  WHEN (NEW.pipeline_stage IN ('closed_won','closed_lost')
        AND OLD.pipeline_stage IS DISTINCT FROM NEW.pipeline_stage)
  EXECUTE FUNCTION public.crm_cancel_queued_on_close();


-- -----------------------------------------------------------------------------
-- Logging an interaction touches the lead.
--
-- Stage advancement rules:
--   * a genuinely two-way contact moves new/attempted -> contacted
--   * an unanswered outbound attempt moves new -> attempted (without this rule
--     the 'attempted' stage is unreachable except by hand)
--   * type='form' NEVER advances the stage. A form submission is how the lead
--     came into existence; treating it as "contacted" would empty the New
--     column of the pipeline board on day one.
--   * nothing ever moves a lead backwards or out of a closed stage.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crm_touch_lead_on_interaction()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_connected boolean;
  v_attempted boolean;
BEGIN
  v_connected :=
        NEW.type NOT IN ('note','form','voicemail')
    AND (NEW.outcome = 'connected' OR NEW.direction = 'inbound');

  v_attempted :=
        NEW.direction = 'outbound'
    AND NEW.type IN ('call','text','voicemail')
    AND COALESCE(NEW.outcome, '') IN ('no_answer','left_voicemail');

  UPDATE leads l
     SET last_interaction_at = GREATEST(COALESCE(l.last_interaction_at, NEW.occurred_at), NEW.occurred_at),
         last_contacted_at   = CASE
                                 WHEN NEW.direction = 'outbound'
                                   THEN GREATEST(COALESCE(l.last_contacted_at, NEW.occurred_at), NEW.occurred_at)
                                 ELSE l.last_contacted_at
                               END,
         pipeline_stage      = CASE
                                 WHEN v_connected AND l.pipeline_stage IN ('new','attempted')
                                   THEN 'contacted'::pipeline_stage
                                 WHEN v_attempted AND l.pipeline_stage = 'new'
                                   THEN 'attempted'::pipeline_stage
                                 ELSE l.pipeline_stage
                               END
   WHERE l.id = NEW.lead_id;

  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS crm_touch_lead_on_interaction ON crm_interactions;
CREATE TRIGGER crm_touch_lead_on_interaction
  AFTER INSERT ON crm_interactions
  FOR EACH ROW EXECUTE FUNCTION public.crm_touch_lead_on_interaction();


-- -----------------------------------------------------------------------------
-- Indexes. Each exists because a specific dashboard query needs it.
-- -----------------------------------------------------------------------------

-- Pipeline board. The partial predicate keeps closed deals — eventually most
-- rows — entirely out of the index.
CREATE INDEX IF NOT EXISTS leads_pipeline_board_idx
  ON leads (pipeline_stage, stage_changed_at DESC)
  WHERE pipeline_stage NOT IN ('closed_won','closed_lost');

-- "What's due" — the hottest query in the app.
CREATE INDEX IF NOT EXISTS crm_tasks_open_due_idx
  ON crm_tasks (due_at)
  WHERE status = 'open' AND due_at IS NOT NULL;

-- Calendar: appointments in a date window.
CREATE INDEX IF NOT EXISTS crm_tasks_calendar_idx
  ON crm_tasks (starts_at)
  WHERE kind = 'appointment' AND status <> 'cancelled';

-- Lead detail: the thread, newest first.
CREATE INDEX IF NOT EXISTS crm_interactions_lead_time_idx
  ON crm_interactions (lead_id, occurred_at DESC);

-- "Needs a reply" inbox. The predicate collapses it to a handful of rows.
CREATE INDEX IF NOT EXISTS crm_interactions_unreplied_idx
  ON crm_interactions (occurred_at DESC)
  WHERE direction = 'inbound' AND replied_at IS NULL;

-- "New leads" list. 001 has no plain created_at index; every existing index on
-- leads is partial on status='active', so an unfiltered recency sort seq-scans.
CREATE INDEX IF NOT EXISTS leads_created_at_idx
  ON leads (created_at DESC);

-- Global "recent site activity" feed. 003's indexes are lead-scoped or
-- (event_type, occurred_at); a cross-lead recency scan has no index today.
CREATE INDEX IF NOT EXISTS lead_activity_recent_idx
  ON lead_activity (occurred_at DESC);


-- -----------------------------------------------------------------------------
-- Retention. lead_activity is the only table here that grows without bound
-- (one row per page view per consented lead, forever). 18 months is well past
-- any behaviour-trigger lookback (longest: dormant_return, 60-day cooldown).
--
-- Not scheduled here — pg_cron is not enabled on a new project. To wire it up:
--   SELECT cron.schedule('prune-lead-activity','17 4 * * 0',
--                        $$SELECT public.prune_lead_activity()$$);
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prune_lead_activity()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE v_n integer;
BEGIN
  DELETE FROM public.lead_activity WHERE occurred_at < NOW() - INTERVAL '18 months';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$fn$;

REVOKE ALL ON FUNCTION public.prune_lead_activity() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_lead_activity() TO service_role;
