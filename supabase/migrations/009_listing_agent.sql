-- =============================================================================
-- 009: Listing agent identification + the sold-listing RLS fix
-- =============================================================================
-- Two unrelated things, both scoped to the `listings` table from 008.
--
-- 1. Bright MLS and NJ REC both require a listing-detail page to identify the
--    LISTING agent and how to reach them. Migration 008 captured the brokerage
--    only, which is half the requirement.
--
-- 2. A bug in 008: src/lib/listings.ts queries `status=in.(published,sold)` but
--    the anon policy only permitted `published`. Sold listings were silently
--    filtered out by RLS and have never built, despite the code and its comments
--    assuming they do.
-- =============================================================================

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS list_agent_name  TEXT,
  ADD COLUMN IF NOT EXISTS list_agent_phone TEXT;

COMMENT ON COLUMN public.listings.list_agent_name IS
  'ListAgentName from the Bright/Matrix export. Required on a published borrowed '
  'listing — the listing agent must be identifiable on the detail page.';

COMMENT ON COLUMN public.listings.list_agent_phone IS
  'ListAgentPhone. NOT required: feeds legitimately omit it, and the brokerage '
  'attribution line already carries contactability.';

-- Structural, same doctrine as listings_borrowed_attribution_chk: a borrowed
-- listing cannot reach 'published' without the listing agent named.
--
-- NOT VALID so applying this cannot retro-reject rows that are already
-- published. New inserts and updates ARE checked. Backfill, then:
--   ALTER TABLE public.listings VALIDATE CONSTRAINT listings_borrowed_agent_chk;
ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_borrowed_agent_chk;

ALTER TABLE public.listings
  ADD CONSTRAINT listings_borrowed_agent_chk
  CHECK (
    status <> 'published'
    OR is_own_listing
    OR (list_agent_name IS NOT NULL AND btrim(list_agent_name) <> '')
  ) NOT VALID;

-- --- the 008 bug -------------------------------------------------------------
-- Widen the anon read policy to match what the build actually asks for. A sold
-- listing is public information for exactly the same reason a published one is —
-- it was openly advertised — and its page is kept as social proof and to
-- preserve inbound links.
DROP POLICY IF EXISTS listings_public_read ON public.listings;

CREATE POLICY listings_public_read ON public.listings
  FOR SELECT TO anon
  USING (status IN ('published', 'sold'));
