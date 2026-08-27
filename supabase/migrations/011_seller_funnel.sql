-- =============================================================================
-- 011: Seller funnel (/cash-offer) — richer attribution + the questionnaire
-- =============================================================================
-- The /cash-offer landing page takes paid Meta traffic and asks nine questions.
-- Two gaps in the existing schema:
--
--   1. `leads` carries only utm_source / utm_medium / utm_campaign. Meta sends
--      `fbclid`, and campaigns routinely use utm_content and utm_term to split
--      ad sets and creatives. Without these, "which ad produced this lead?" is
--      unanswerable — which is the whole point of paying for the traffic.
--
--   2. Five of the nine answers (condition, reason for selling, authorised
--      owner, currently listed, lead status) have no column. Formatting them
--      into `admin_notes` would make them unqueryable prose. A jsonb column
--      keeps them structured without inventing five more columns that only one
--      funnel will ever use.
-- =============================================================================

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS utm_content   VARCHAR(150),
  ADD COLUMN IF NOT EXISTS utm_term      VARCHAR(150),
  ADD COLUMN IF NOT EXISTS fbclid        VARCHAR(255),
  ADD COLUMN IF NOT EXISTS seller_funnel JSONB;

COMMENT ON COLUMN public.leads.fbclid IS
  'Facebook click identifier from the landing page URL. Needed for Meta '
  'attribution and for Conversions API deduplication if server-side events are '
  'ever added.';

COMMENT ON COLUMN public.leads.seller_funnel IS
'The /cash-offer questionnaire, verbatim: property_type, authorized_owner, timeline,
condition, reason_for_selling, currently_listed, lead_status, disqualification_reason.
Written by the send-seller-lead edge function.

FAIR HOUSING: reason_for_selling can contain divorce, financial hardship or inherited
property - familial status and financial circumstance. It exists to inform the
conversation with the seller and MUST NOT be used to decide who is served, or fed into
any automated scoring or targeting.';

-- Paid traffic is measured by campaign, so make that the indexed access path.
-- Partial: organic leads have no utm_source and would otherwise bloat it.
CREATE INDEX IF NOT EXISTS leads_utm_campaign_idx
  ON public.leads (utm_campaign, created_at DESC)
  WHERE utm_source IS NOT NULL;
