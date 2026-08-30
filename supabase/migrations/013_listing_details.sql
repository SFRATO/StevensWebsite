-- Rich, consumer-facing MLS detail for a listing page.
--
-- WHY JSONB AND NOT ~25 COLUMNS
-- -----------------------------
-- Everything in here is display-only: it is rendered on the listing page and is
-- never filtered, sorted, joined or aggregated. It is also genuinely sparse and
-- property-shaped — a condo has no basement, a lot with no survey has no
-- dimensions, an older listing may have none of it at all. Twenty-five nullable
-- columns would be permanent schema churn in exchange for query capability
-- nothing asks for.
--
-- The SHAPE is not free-form despite the type. src/lib/listings.ts declares
-- ListingDetails and the page renders exactly four optional keys:
--
--   factGroups   [{ title, rows: [[label, value], ...] }]  grouped MLS fact rows
--   rooms        [{ level, name, size? }]                  room dimensions
--   featureGroups[{ title, items: [string] }]              interior/exterior/etc
--   disclosures  [string]                                  material as-is facts
--
-- Anything not matching that shape simply does not render. Keep the two in sync.
--
-- NULL for every existing row, which is deliberate: 37 Wesley and 10 Edinburgh
-- must keep rendering the original flat Details list, untouched.
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS details JSONB;

COMMENT ON COLUMN public.listings.details IS
  'Optional rich listing detail rendered by src/pages/listings/[slug].astro. '
  'Shape is declared by ListingDetails in src/lib/listings.ts — keep in sync.';
