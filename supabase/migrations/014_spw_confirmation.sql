-- Idempotency marker for the Single Property Website registration confirmation.
--
-- WHY NOT REUSE confirmation_sent_at (012)
-- ----------------------------------------
-- That column belongs to the cash-offer seller funnel, which reads and stamps it
-- in send-seller-lead. One shared column means the two funnels suppress each
-- other: a listing-gate confirmation would silently swallow a seller
-- confirmation sent minutes earlier, and vice versa. They are different emails
-- on different triggers, so they get different markers.
--
-- Nullable with no default: NULL means "never sent", which is what every
-- existing row should be.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS spw_confirmation_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.leads.spw_confirmation_sent_at IS
  'When the Single Property Website registration confirmation was last accepted '
  'by SES for this lead. Written by handle-form-submission; drives the resend '
  'suppression window. Distinct from confirmation_sent_at (cash-offer funnel).';
