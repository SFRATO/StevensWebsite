-- =============================================================================
-- 005: Supabase Auth, one admin, RLS everywhere
-- =============================================================================
--
-- Threat model this file exists to defeat:
--
--  1. The anon key ships in the browser bundle. It is public. Anything readable
--     by `anon` is readable by the internet.
--  2. Supabase email signup is ON by default on a hosted project. Anyone can
--     POST /auth/v1/signup and receive a valid `authenticated` JWT. So
--     `TO authenticated` is NOT an authorization boundary — it means "any
--     stranger who filled in a signup form".
--  3. Supabase's bootstrap runs
--       ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES
--         TO anon, authenticated, service_role;
--     so every table and view created in 001-004 was ALREADY handed to anon and
--     authenticated. Enabling RLS alone is not enough for VIEWS, which run as
--     their owner on PG15 — the grants must be revoked explicitly.
--
-- Belt and braces therefore: REVOKE the default grants, re-GRANT only what the
-- admin needs, and gate every policy on membership of an allow-list table that
-- cannot be written from the client at all.
--
-- ALSO DO THIS IN THE DASHBOARD — it is not expressible in SQL:
--   Authentication > Sign In / Providers > Email > "Allow new users to sign up" OFF
-- supabase/config.toml sets enable_signup = false, but that governs the LOCAL
-- stack only. Everything below is written to hold even if the toggle is on.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- admin_users — the allow-list.
--
-- There is deliberately NO INSERT POLICY and no INSERT grant. A row can only be
-- created with the service-role key or from the SQL editor. Self-elevation from
-- a browser session is therefore impossible, not merely discouraged: even a
-- logged-in admin cannot add a second admin.
--
-- BOOTSTRAP: create the auth user in the dashboard, then
--   INSERT INTO admin_users (user_id, email, full_name)
--   VALUES ('<uuid from auth.users>', 'sf@stevenfrato.com', 'Steven Frato');
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  full_name  TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;


-- -----------------------------------------------------------------------------
-- is_admin()
--
-- SECURITY DEFINER so it can read admin_users regardless of the caller's RLS,
-- which is what breaks the "policy on table X reads table Y whose policy reads
-- table X" recursion that bites every allow-list design.
--
-- SET search_path = '' pins resolution: a SECURITY DEFINER function without it
-- can be hijacked by a caller who puts a malicious `admin_users` earlier in
-- their search_path. Every reference is schema-qualified as a consequence.
--
-- STABLE, and written at every call site as `(SELECT public.is_admin())` so the
-- planner hoists it into an InitPlan: ONE evaluation per statement, not one per
-- candidate row. On a large leads table that is the difference between a 3 ms
-- and a 900 ms list view.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  SELECT EXISTS (
    SELECT 1
      FROM public.admin_users
     WHERE user_id = (SELECT auth.uid())
       AND is_active
  );
$fn$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- The admin may read their own row (so the app can render "signed in as").
-- Nothing else, for anyone.
DROP POLICY IF EXISTS admin_users_self_select ON public.admin_users;
CREATE POLICY admin_users_self_select
  ON public.admin_users FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

REVOKE ALL    ON TABLE public.admin_users FROM PUBLIC, anon, authenticated;
GRANT  SELECT ON TABLE public.admin_users TO authenticated;


-- -----------------------------------------------------------------------------
-- Authorship cannot be spoofed.
--
-- created_by is FORCED to auth.uid() whenever there is a human on the other end.
-- When there isn't (auth.uid() IS NULL — a service-role edge function, e.g. the
-- send-one-off-email function writing back a crm_interactions row on the admin's
-- behalf), the supplied value is honoured; that path already holds the service
-- key and is trusted.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crm_set_created_by()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $fn$
BEGIN
  NEW.created_by := COALESCE(auth.uid(), NEW.created_by);
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS crm_set_created_by ON public.crm_interactions;
CREATE TRIGGER crm_set_created_by
  BEFORE INSERT ON public.crm_interactions
  FOR EACH ROW EXECUTE FUNCTION public.crm_set_created_by();

DROP TRIGGER IF EXISTS crm_set_created_by ON public.crm_tasks;
CREATE TRIGGER crm_set_created_by
  BEFORE INSERT ON public.crm_tasks
  FOR EACH ROW EXECUTE FUNCTION public.crm_set_created_by();

DROP TRIGGER IF EXISTS crm_set_created_by ON public.crm_lead_tags;
CREATE TRIGGER crm_set_created_by
  BEFORE INSERT ON public.crm_lead_tags
  FOR EACH ROW EXECUTE FUNCTION public.crm_set_created_by();


-- -----------------------------------------------------------------------------
-- RLS on the new tables
-- -----------------------------------------------------------------------------
ALTER TABLE public.crm_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_tasks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_tags         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_lead_tags    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_audit_log    ENABLE ROW LEVEL SECURITY;

-- PG15 has no CREATE POLICY IF NOT EXISTS, so every policy below is
-- DROP-then-CREATE. That is what makes this file re-runnable.

DROP POLICY IF EXISTS crm_interactions_admin ON public.crm_interactions;
CREATE POLICY crm_interactions_admin ON public.crm_interactions
  FOR ALL TO authenticated
  USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

DROP POLICY IF EXISTS crm_tasks_admin ON public.crm_tasks;
CREATE POLICY crm_tasks_admin ON public.crm_tasks
  FOR ALL TO authenticated
  USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

DROP POLICY IF EXISTS crm_tags_admin ON public.crm_tags;
CREATE POLICY crm_tags_admin ON public.crm_tags
  FOR ALL TO authenticated
  USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

DROP POLICY IF EXISTS crm_lead_tags_admin ON public.crm_lead_tags;
CREATE POLICY crm_lead_tags_admin ON public.crm_lead_tags
  FOR ALL TO authenticated
  USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

-- The audit log is evidence. Read-only even to the admin; only the SECURITY
-- DEFINER trigger and the SECURITY DEFINER RPCs may append to it.
DROP POLICY IF EXISTS crm_audit_log_admin_read ON public.crm_audit_log;
CREATE POLICY crm_audit_log_admin_read ON public.crm_audit_log
  FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));


-- -----------------------------------------------------------------------------
-- leads: SELECT / INSERT / UPDATE, and explicitly NO DELETE.
--
-- leads.id is the parent of several ON DELETE CASCADE foreign keys —
-- scheduled_emails (and email_events beneath it), lead_activity, behavior_sends,
-- crm_interactions, crm_tasks, crm_lead_tags. A misdirected DELETE from a
-- dashboard is silent and unrecoverable. Deletion goes through crm_purge_lead()
-- in 006, which snapshots to the audit log first.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS leads_admin_select ON public.leads;
CREATE POLICY leads_admin_select ON public.leads
  FOR SELECT TO authenticated USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS leads_admin_insert ON public.leads;
CREATE POLICY leads_admin_insert ON public.leads
  FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_admin()));

DROP POLICY IF EXISTS leads_admin_update ON public.leads;
CREATE POLICY leads_admin_update ON public.leads
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
-- (no leads delete policy, and no DELETE grant, on purpose)


-- -----------------------------------------------------------------------------
-- Read-only operational tables. The CRM displays these; it never authors them.
-- The exception is scheduled_emails, which manual drip control mutates — and
-- that goes through the SECURITY DEFINER RPCs in 006, not a direct UPDATE, so
-- "reschedule" always resyncs leads.next_email_at atomically.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS scheduled_emails_admin_read ON public.scheduled_emails;
CREATE POLICY scheduled_emails_admin_read ON public.scheduled_emails
  FOR SELECT TO authenticated USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS email_events_admin_read ON public.email_events;
CREATE POLICY email_events_admin_read ON public.email_events
  FOR SELECT TO authenticated USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS lead_activity_admin_read ON public.lead_activity;
CREATE POLICY lead_activity_admin_read ON public.lead_activity
  FOR SELECT TO authenticated USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS behavior_triggers_admin_read ON public.behavior_triggers;
CREATE POLICY behavior_triggers_admin_read ON public.behavior_triggers
  FOR SELECT TO authenticated USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS behavior_sends_admin_read ON public.behavior_sends;
CREATE POLICY behavior_sends_admin_read ON public.behavior_sends
  FOR SELECT TO authenticated USING ((SELECT public.is_admin()));

-- campaigns / campaign_steps carry a "viewable by everyone" SELECT policy from
-- 001. That is wrong now: campaign structure and subject lines are not public,
-- and no anon-facing feature reads them (handle-form-submission and
-- send-scheduled-emails both use service_role).
DROP POLICY IF EXISTS "Campaigns are viewable by everyone"      ON public.campaigns;
DROP POLICY IF EXISTS "Campaign steps are viewable by everyone" ON public.campaign_steps;

DROP POLICY IF EXISTS campaigns_admin_read ON public.campaigns;
CREATE POLICY campaigns_admin_read ON public.campaigns
  FOR SELECT TO authenticated USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS campaign_steps_admin_read ON public.campaign_steps;
CREATE POLICY campaign_steps_admin_read ON public.campaign_steps
  FOR SELECT TO authenticated USING ((SELECT public.is_admin()));

-- zipcode_data IS genuinely public — every /market/<zip>/ page is built from it
-- and TownSearchIsland reads it live. Its 001 policy stays.


-- -----------------------------------------------------------------------------
-- GRANTS.
--
-- This is the half that actually matters. RLS is a row filter; a GRANT is the
-- door. Both are needed, because a VIEW on PG15 is not covered by the base
-- table's RLS at all — only by grants.
--
-- Note the deliberate omission of service_role from every REVOKE. service_role
-- holds direct grants from Supabase's default privileges and has BYPASSRLS, so
-- every existing edge function is untouched by this file. Revoking from PUBLIC
-- as well as the two named roles closes the case where a privilege was granted
-- to PUBLIC rather than to a role.
-- -----------------------------------------------------------------------------
REVOKE ALL ON TABLE public.leads             FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.scheduled_emails  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.email_events      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.campaigns         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.campaign_steps    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.lead_activity     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.behavior_triggers FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.behavior_sends    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.crm_interactions  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.crm_tasks         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.crm_tags          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.crm_lead_tags     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.crm_audit_log     FROM PUBLIC, anon, authenticated;

-- zipcode_data: anon keeps SELECT (public market pages), loses everything else.
REVOKE ALL    ON TABLE public.zipcode_data FROM PUBLIC, anon, authenticated;
GRANT  SELECT ON TABLE public.zipcode_data TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.leads TO authenticated;  -- no DELETE

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.crm_interactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.crm_tasks        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.crm_tags         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.crm_lead_tags    TO authenticated;

GRANT SELECT ON TABLE public.scheduled_emails  TO authenticated;
GRANT SELECT ON TABLE public.email_events      TO authenticated;
GRANT SELECT ON TABLE public.campaigns         TO authenticated;
GRANT SELECT ON TABLE public.campaign_steps    TO authenticated;
GRANT SELECT ON TABLE public.lead_activity     TO authenticated;
GRANT SELECT ON TABLE public.behavior_triggers TO authenticated;
GRANT SELECT ON TABLE public.behavior_sends    TO authenticated;
GRANT SELECT ON TABLE public.crm_audit_log     TO authenticated;

-- Anything created in public from here on is closed by default rather than open
-- by default. This flips Supabase's bootstrap ALTER DEFAULT PRIVILEGES so a
-- future migration cannot accidentally ship another anon-readable PII view.
--
-- Caveat, stated plainly: ALTER DEFAULT PRIVILEGES without FOR ROLE applies to
-- objects created by the CURRENT role. `supabase db push` and the dashboard SQL
-- editor both run as `postgres`, so this covers both. It does NOT cover objects
-- created by any other role.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon;
