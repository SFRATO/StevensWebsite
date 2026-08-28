-- =============================================================================
-- 012: Homeowner confirmation email — idempotency
-- =============================================================================
-- The /cash-offer funnel sends a short confirmation to the homeowner alongside
-- the internal lead notification. A double-clicked submit button, a client
-- retry, a replayed request after a network timeout, or a refreshed success
-- screen must not send it twice.
--
-- This has to live in the database. An in-memory guard would not survive across
-- Netlify and Supabase function instances, which are short-lived and not shared,
-- so two near-simultaneous requests could each believe they were the first.
--
-- leads.email is UNIQUE, so a repeat submitter is an UPDATE of one row rather
-- than a second row — which is exactly what makes this column a reliable key.
-- =============================================================================

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS confirmation_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.leads.confirmation_sent_at IS
'When the homeowner confirmation email was last accepted by SES. NULL means one
was never sent (including every lead created before this funnel existed).

The sender re-sends only if this is NULL or older than one hour. The window is
deliberate: it suppresses double-clicks and retries, while still acknowledging a
genuine second enquiry weeks later, which would otherwise appear to the
homeowner as a form that silently did nothing.';
