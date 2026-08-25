-- =============================================================================
-- 010: Did Steven actually get told about this lead?
-- =============================================================================
-- The visitor gets a 200 whether or not the agent alert sends — correctly, the
-- lead IS saved, and failing their submit because our alerting broke would be
-- strictly worse. But that means a silent SES failure produces a lead nobody
-- ever calls, with no trace anywhere.
--
-- These two columns make it answerable after the fact:
--   select * from leads where agent_notified_at is null order by created_at desc;
-- =============================================================================

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS agent_notified_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS agent_notify_error TEXT;

COMMENT ON COLUMN public.leads.agent_notified_at IS
  'When the agent alert email was accepted by SES. NULL means nobody was told — '
  'either the send failed after 3 attempts, or this row predates migration 010.';

COMMENT ON COLUMN public.leads.agent_notify_error IS
  'Last SES error for the agent alert, truncated to 500 chars. Cleared on success.';

-- Partial index: the only query that matters here is "which leads slipped
-- through", and that set should normally be empty. A partial index keeps it
-- O(matches) instead of scanning every lead ever captured.
CREATE INDEX IF NOT EXISTS leads_agent_not_notified_idx
  ON public.leads (created_at DESC)
  WHERE agent_notified_at IS NULL;
