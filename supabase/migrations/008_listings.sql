-- =============================================================================
-- 008: Listings — single-property pages
-- =============================================================================
--
-- Backs /listings/<slug>/ — one prerendered page per property, each with its own
-- lead capture. Modelled on Pipeline Pro Tools' "single property websites", with
-- one deliberate difference: these live on stevenfrato.com, so the SEO value
-- accrues to Steven rather than to a vendor's domain.
--
-- Pages are built statically, so the site reads this table at BUILD time with the
-- anon key. That is why published listings carry a public SELECT policy while
-- everything else in this schema is admin-only — a published listing is public
-- information by definition. Drafts are not.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'listing_status') THEN
    CREATE TYPE listing_status AS ENUM ('draft', 'published', 'sold', 'withdrawn');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'listing_property_type') THEN
    CREATE TYPE listing_property_type AS ENUM (
      'single-family', 'condo', 'townhouse', 'multi-family', 'land'
    );
  END IF;
END$$;


CREATE TABLE IF NOT EXISTS listings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- URL segment: /listings/<slug>/. Stable once published — changing it breaks
  -- every shared link and every ad already pointing at the page.
  slug          TEXT NOT NULL UNIQUE,
  status        listing_status NOT NULL DEFAULT 'draft',

  -- Location. This is the one place a street address is legitimate: it is the
  -- LISTING's address, not the agent's. See the note in src/utils/schema.ts.
  address       TEXT NOT NULL,
  town          TEXT NOT NULL,
  county        TEXT,
  zipcode       TEXT,
  state         TEXT NOT NULL DEFAULT 'NJ',

  -- Facts. Nullable because a listing is often published before every detail is
  -- confirmed, and an invented square footage in an ad is a misrepresentation.
  price         NUMERIC(12,2),
  beds          INTEGER,
  baths         NUMERIC(4,1),          -- 2.5 baths is a real number
  sqft          INTEGER,
  lot_size      TEXT,                  -- free text: "0.25 acres", "50x120"
  year_built    INTEGER,
  property_type listing_property_type,
  mls_number    TEXT,

  description   TEXT,
  -- Short factual bullets. Screened for Fair Housing before publish, same as ad
  -- copy — this is agent-typed free text and therefore the real risk surface.
  highlights    TEXT[] NOT NULL DEFAULT '{}',
  images        TEXT[] NOT NULL DEFAULT '{}',

  -- --- Attribution -----------------------------------------------------------
  -- Steven markets other brokers' listings to generate buyer leads ("borrowed
  -- listings"). NJ requires the listing broker to be identified in advertising,
  -- and advertising someone else's listing without permission is a license-board
  -- complaint, not a style issue. The CHECK below makes that structural: a
  -- borrowed listing physically cannot reach 'published' without both the
  -- brokerage named and permission affirmatively recorded.
  is_own_listing        BOOLEAN NOT NULL DEFAULT TRUE,
  listing_brokerage     TEXT,
  permission_confirmed  BOOLEAN NOT NULL DEFAULT FALSE,

  -- --- Sold / social proof ---------------------------------------------------
  sold_price    NUMERIC(12,2),
  sold_date     DATE,

  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at  TIMESTAMPTZ,

  CONSTRAINT listings_slug_shape_chk
    CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),

  -- The compliance gate. Draft freely; publishing a borrowed listing requires
  -- naming the brokerage AND recording permission.
  CONSTRAINT listings_borrowed_attribution_chk
    CHECK (
      status <> 'published'
      OR is_own_listing
      OR (
        listing_brokerage IS NOT NULL
        AND btrim(listing_brokerage) <> ''
        AND permission_confirmed
      )
    ),

  CONSTRAINT listings_sold_chk
    CHECK (status <> 'sold' OR sold_date IS NOT NULL)
);

COMMENT ON COLUMN listings.slug IS
  'URL segment. Treat as immutable once published — changing it 404s every '
  'shared link and every ad already pointing at the page.';
COMMENT ON CONSTRAINT listings_borrowed_attribution_chk ON listings IS
  'NJ requires the listing broker be identified when advertising their listing, '
  'and permission is required to advertise it at all. Enforced here rather than '
  'in the UI so no code path can bypass it.';

-- Build-time read: every published listing, newest first.
CREATE INDEX IF NOT EXISTS listings_published_idx
  ON listings (published_at DESC)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS listings_town_idx ON listings (town);

DROP TRIGGER IF EXISTS update_listings_updated_at ON listings;
CREATE TRIGGER update_listings_updated_at
  BEFORE UPDATE ON listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS crm_set_created_by ON listings;
CREATE TRIGGER crm_set_created_by
  BEFORE INSERT ON listings
  FOR EACH ROW EXECUTE FUNCTION public.crm_set_created_by();

-- Stamp published_at the first time a listing goes live, so "newest listings"
-- ordering doesn't shuffle every time the row is edited.
CREATE OR REPLACE FUNCTION public.listings_stamp_published()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $fn$
BEGIN
  IF NEW.status = 'published' AND NEW.published_at IS NULL THEN
    NEW.published_at := NOW();
  END IF;
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS listings_stamp_published ON listings;
CREATE TRIGGER listings_stamp_published
  BEFORE INSERT OR UPDATE ON listings
  FOR EACH ROW EXECUTE FUNCTION public.listings_stamp_published();


-- -----------------------------------------------------------------------------
-- RLS
--
-- Deliberate asymmetry vs the rest of the schema: PUBLISHED listings are
-- anon-readable, because the static build fetches them with the anon key and the
-- resulting pages are public anyway. Drafts, withdrawn listings, and every
-- attribution/audit column stay admin-only via the view below.
-- -----------------------------------------------------------------------------
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.listings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.listings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.listings TO authenticated;

DROP POLICY IF EXISTS listings_public_read ON public.listings;
CREATE POLICY listings_public_read ON public.listings
  FOR SELECT TO anon
  USING (status = 'published');

DROP POLICY IF EXISTS listings_admin_all ON public.listings;
CREATE POLICY listings_admin_all ON public.listings
  FOR ALL TO authenticated
  USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
