/**
 * Listings — build-time data source for /listings/<slug>/.
 *
 * The site is statically generated, so this runs during `npm run build`, not in
 * the browser. It reads published listings with the ANON key: a published
 * listing is public information by definition, and migration 008 gives anon a
 * SELECT policy scoped to `status = 'published'` only. Drafts and withdrawn
 * listings are never fetched, so they cannot leak into the built output.
 *
 * NEVER switch this to the service-role key. It would work, and it would mean a
 * draft could be rendered into a public page by a one-word mistake in a filter.
 */
import {
  AGENT_NAME,
  PHONE,
  BROKERAGE_NAME,
  BROKERAGE_DESCRIPTOR,
  LICENSE_TYPE,
} from '../data/contact';


export interface Listing {
  id: string;
  slug: string;
  status: 'published' | 'sold';
  address: string;
  town: string;
  county: string | null;
  zipcode: string | null;
  state: string;
  price: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lot_size: string | null;
  year_built: number | null;
  property_type: string | null;
  mls_number: string | null;
  description: string | null;
  highlights: string[];
  images: string[];
  is_own_listing: boolean;
  listing_brokerage: string | null;
  list_agent_name: string | null;
  list_agent_phone: string | null;
  sold_price: number | null;
  sold_date: string | null;
  published_at: string | null;
}

const SELECT_COLUMNS = [
  'id', 'slug', 'status', 'address', 'town', 'county', 'zipcode', 'state',
  'price', 'beds', 'baths', 'sqft', 'lot_size', 'year_built', 'property_type',
  'mls_number', 'description', 'highlights', 'images',
  'is_own_listing', 'listing_brokerage', 'list_agent_name', 'list_agent_phone',
  'sold_price', 'sold_date', 'published_at',
].join(',');

/**
 * Fetch every publicly visible listing.
 *
 * Returns [] rather than throwing when Supabase is unreachable or unconfigured.
 * That is deliberate: this runs inside `getStaticPaths`, and a throw here would
 * fail the entire 358-page build over a feature that may legitimately have no
 * rows yet. A missing listing page is recoverable; a broken marketing site is not.
 * The warning is loud so a misconfiguration doesn't pass silently.
 */
export async function getPublishedListings(): Promise<Listing[]> {
  const url = import.meta.env.SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.warn(
      '[listings] SUPABASE_URL / SUPABASE_ANON_KEY not set — building with zero ' +
        'listings. Set both to render /listings/<slug>/ pages.',
    );
    return [];
  }

  // `status=in.(published,sold)` — sold listings keep their page as social proof
  // and to preserve inbound links; the template renders them differently.
  const endpoint =
    `${url}/rest/v1/listings` +
    `?select=${SELECT_COLUMNS}` +
    `&status=in.(published,sold)` +
    `&order=published_at.desc`;

  try {
    const res = await fetch(endpoint, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    });

    if (!res.ok) {
      console.warn(`[listings] fetch failed (${res.status}) — building with zero listings.`);
      return [];
    }

    const rows = (await res.json()) as Listing[];
    console.log(`[listings] ${rows.length} listing(s) fetched for the build.`);
    return rows;
  } catch (err) {
    console.warn('[listings] fetch threw — building with zero listings.', err);
    return [];
  }
}

/**
 * The attribution line required when advertising another broker's listing.
 * Migration 008 guarantees `listing_brokerage` is present on any published
 * borrowed listing, so this cannot silently render an empty credit.
 */
export function attributionLine(l: Listing): string | null {
  // Steven's OWN listings are listed by his brokerage, so they need a credit
  // too — this used to return null for them, which was correct only while the
  // site named no broker at all. N.J.A.C. 11:5-6.1(b) requires the broker's
  // business name in every advertisement, and a listing page is advertising.
  if (l.is_own_listing) {
    return `Listed by ${AGENT_NAME}, ${LICENSE_TYPE}, ${BROKERAGE_NAME} — ${BROKERAGE_DESCRIPTOR}.`;
  }
  return (
    `Listing courtesy of ${l.listing_brokerage}. ` +
    `Marketed by ${AGENT_NAME}, ${LICENSE_TYPE}, ${BROKERAGE_NAME}, ` +
    `with the listing broker's permission.`
  );
}

/**
 * Who to contact about THIS property.
 *
 * Bright and NJ REC both require the listing agent be identified on a listing
 * detail page. For Steven's own listings that agent IS Steven, so fall back to
 * the canonical contact constants rather than rendering a blank credit.
 */
export function agentCredit(l: Listing): { name: string; phone: string | null; isOwn: boolean } {
  if (l.is_own_listing) return { name: AGENT_NAME, phone: PHONE, isOwn: true };
  return { name: l.list_agent_name ?? 'the listing agent', phone: l.list_agent_phone, isOwn: false };
}

const fmtMoney = (n: number | null): string | null =>
  typeof n === 'number' && n > 0 ? `$${Math.round(n).toLocaleString('en-US')}` : null;

/** Headline price: the sold price once sold, otherwise the list price. */
export function displayPrice(l: Listing): string | null {
  return l.status === 'sold' ? fmtMoney(l.sold_price) ?? fmtMoney(l.price) : fmtMoney(l.price);
}

/** "4 bed · 2 bath · 1,850 sq ft" — omits whatever is unknown. */
export function factLine(l: Listing): string {
  const parts: string[] = [];
  if (l.beds) parts.push(`${l.beds} bed`);
  if (l.baths) parts.push(`${l.baths} bath`);
  if (l.sqft) parts.push(`${l.sqft.toLocaleString('en-US')} sq ft`);
  return parts.join(' · ');
}
