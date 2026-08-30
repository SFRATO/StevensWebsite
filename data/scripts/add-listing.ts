/**
 * Add or update a listing.
 *
 *   npm run listing:add -- path/to/listing.json
 *   npm run listing:add -- path/to/listing.json --publish
 *
 * Interim tooling until the /admin CRM form exists. Writes with the service-role
 * key, so it runs only on your machine and never in the browser.
 *
 * It does three things before touching the database:
 *
 *   1. Validates required fields, so a half-filled listing fails here with a
 *      readable message rather than as a Postgres constraint error.
 *   2. Screens the description and highlights for Fair Housing problems. This is
 *      the same screener the ad generator uses, and it matters more here — this
 *      text is typed by a human and ends up on a public page.
 *   3. Refuses to publish a borrowed listing without brokerage + permission. The
 *      database enforces this too (migration 008); catching it here just gives a
 *      better error than a constraint violation.
 *
 * Defaults to status='draft'. Pass --publish to go live.
 */
import { readFileSync } from 'node:fs';
import { screenFairHousing } from '../../src/lib/ai/fairHousing';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

interface ListingFile {
  slug: string;
  address: string;
  town: string;
  county?: string;
  zipcode?: string;
  state?: string;
  price?: number;
  beds?: number;
  baths?: number;
  sqft?: number;
  lot_size?: string;
  year_built?: number;
  property_type?: 'single-family' | 'condo' | 'townhouse' | 'multi-family' | 'land';
  mls_number?: string;
  description?: string;
  highlights?: string[];
  images?: string[];
  is_own_listing?: boolean;
  listing_brokerage?: string;
  /** Added by 009_listing_agent.sql. Required to publish a borrowed listing —
   *  see listings_borrowed_agent_chk. */
  list_agent_name?: string;
  list_agent_phone?: string;
  permission_confirmed?: boolean;
  sold_price?: number;
  sold_date?: string;
  /** Rich MLS-style detail. Shape: ListingDetails in src/lib/listings.ts. */
  details?: unknown;
}

function fail(msg: string): never {
  console.error(`\n  ✗ ${msg}\n`);
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  const publish = args.includes('--publish');
  const file = args.find((a) => !a.startsWith('--'));

  if (!file) fail('Usage: npm run listing:add -- path/to/listing.json [--publish]');
  if (!SUPABASE_URL || !SERVICE_KEY) {
    fail('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  }

  let listing: ListingFile;
  try {
    listing = JSON.parse(readFileSync(file!, 'utf-8'));
  } catch (e) {
    fail(`Could not read or parse ${file}: ${(e as Error).message}`);
  }

  // --- 1. required fields ---------------------------------------------------
  for (const k of ['slug', 'address', 'town'] as const) {
    if (!listing[k]) fail(`Missing required field: ${k}`);
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(listing.slug)) {
    fail(
      `slug "${listing.slug}" must be lowercase words separated by hyphens ` +
        `(e.g. "14-oak-street"). It becomes the public URL.`,
    );
  }

  // --- 2. Fair Housing ------------------------------------------------------
  // Checked BEFORE the write. A violation that reaches the database is a
  // violation that can be published by a later edit somewhere else.
  const toScreen: Record<string, string | undefined> = {
    description: listing.description,
    ...Object.fromEntries((listing.highlights ?? []).map((h, i) => [`highlights[${i}]`, h])),
  };

  let blocked = false;
  for (const [field, text] of Object.entries(toScreen)) {
    if (!text) continue;
    const { findings } = screenFairHousing(text);
    for (const f of findings) {
      if (!blocked) console.error('\n  FAIR HOUSING — this text cannot be published:\n');
      blocked = true;
      console.error(`    ${field}: "${f.matched}"  [${f.category}]`);
      console.error(`      ${f.why}\n`);
    }
  }
  if (blocked) {
    fail('Fix the wording above and re-run. Nothing was written to the database.');
  }

  // --- 3. borrowed-listing attribution --------------------------------------
  const isOwn = listing.is_own_listing !== false;
  if (publish && !isOwn) {
    if (!listing.listing_brokerage?.trim()) {
      fail(
        'This is another broker\'s listing, so publishing requires "listing_brokerage" — ' +
          'NJ requires the listing broker be identified in advertising.',
      );
    }
    if (!listing.permission_confirmed) {
      fail(
        'Set "permission_confirmed": true only once the listing broker has actually ' +
          'agreed. Advertising their listing without permission is a licence-board matter.',
      );
    }
    // listings_borrowed_agent_chk enforces this in the database too. Checking it
    // here turns an opaque constraint error into an instruction.
    if (!listing.list_agent_name?.trim()) {
      fail(
        'This is another broker\'s listing, so publishing requires "list_agent_name" — ' +
          'the page credits the listing agent by name, and the database rejects the row without it.',
      );
    }
  }

  // --- write ----------------------------------------------------------------
  // Strip `_comment_*` keys. The example file documents itself inline, which is
  // far more useful than a separate README nobody opens — but Postgres rejects
  // unknown columns, so they have to come out here.
  const cleaned = Object.fromEntries(
    Object.entries(listing).filter(([k]) => !k.startsWith('_')),
  ) as ListingFile;

  const row = {
    ...cleaned,
    state: listing.state ?? 'NJ',
    is_own_listing: isOwn,
    highlights: listing.highlights ?? [],
    images: listing.images ?? [],
    status: publish ? 'published' : 'draft',
  };
  for (const [k, v] of Object.entries(row)) {
    if (v === null || v === undefined) delete (row as Record<string, unknown>)[k];
  }

  // on_conflict=slug so re-running the same file edits the listing instead of
  // erroring — editing a listing is far more common than creating one.
  const res = await fetch(`${SUPABASE_URL}/rest/v1/listings?on_conflict=slug`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY!,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify([row]),
  });

  if (!res.ok) {
    const body = await res.text();
    if (body.includes('listings_borrowed_attribution_chk')) {
      fail('Database rejected it: a borrowed listing needs brokerage + permission to publish.');
    }
    if (body.includes('listings_borrowed_agent_chk')) {
      fail('Database rejected it: a borrowed listing needs "list_agent_name" to publish.');
    }
    fail(`Supabase rejected the write (${res.status}): ${body.slice(0, 300)}`);
  }

  const [saved] = (await res.json()) as Array<{ slug: string; status: string }>;

  console.log(`\n  ✓ ${saved.status === 'published' ? 'Published' : 'Saved as draft'}: ${saved.slug}`);
  if (saved.status === 'published') {
    console.log(`    URL: https://www.stevenfrato.com/listings/${saved.slug}/`);
    console.log(`\n    The site is statically generated, so this page appears on the`);
    console.log(`    next build. Trigger one with:  npm run listing:publish`);
  } else {
    console.log(`    Not public yet. Re-run with --publish when you're ready.`);
  }
  console.log('');
}

main().catch((e) => fail(e.message));
