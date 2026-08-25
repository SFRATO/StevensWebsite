/**
 * Import listings from a Bright MLS (Matrix) CSV export.
 *
 *   npm run listing:import -- ~/Downloads/export.csv
 *   npm run listing:import -- ~/Downloads/export.csv --dry-run
 *
 * Bright runs on Matrix (CoreLogic). Export via My Matrix > Settings >
 * Custom Exports, choosing field NAMES rather than labels — names are
 * standardized and never change, labels are display text that can be reworded.
 * This importer accepts both, plus common aliases, so a label-based export still
 * works; it just isn't guaranteed to keep working.
 *
 * TWO DELIBERATE SAFETY DEFAULTS
 * ------------------------------
 * 1. Everything imports as a DRAFT. MLS data is someone else's listing until
 *    proven otherwise, and a bulk import that auto-published would be the single
 *    most dangerous command in this repo.
 *
 * 2. Every row is treated as a BORROWED listing (is_own_listing = false) unless
 *    --own is passed. Steven is an independent agent and the site publishes no
 *    brokerage affiliation, so there is nothing to reliably match ListOfficeName
 *    against. Guessing wrong in the permissive direction means advertising
 *    another broker's listing without attribution; guessing wrong in the
 *    conservative direction just means confirming a checkbox.
 *
 * FAIR HOUSING WARNING
 * --------------------
 * PublicRemarks are written by the LISTING agent, not by you, and are not
 * guaranteed compliant. Republishing them on your own site makes them your
 * advertising. Every row is screened, and offending rows are reported and
 * skipped rather than imported.
 */
import { readFileSync } from 'node:fs';
import { parse } from 'csv-parse/sync';
import { screenFairHousing } from '../../src/lib/ai/fairHousing';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Matrix/RESO field name -> our column. Multiple aliases per target because
 * exports vary by MLS, by template, and by whether names or labels were chosen.
 * Matching is case- and separator-insensitive (see `norm`).
 */
const FIELD_ALIASES: Record<string, string[]> = {
  mls_number: ['ListingId', 'ListingID', 'MLSNumber', 'MLS #', 'ListingKey'],
  address: ['UnparsedAddress', 'FullStreetAddress', 'Address', 'StreetAddress'],
  street_number: ['StreetNumber', 'StreetNumberNumeric'],
  street_name: ['StreetName'],
  street_suffix: ['StreetSuffix', 'StreetDirSuffix'],
  town: ['City', 'MunicipalityName', 'Municipality'],
  state: ['StateOrProvince', 'State'],
  zipcode: ['PostalCode', 'ZipCode', 'Zip'],
  county: ['CountyOrParish', 'County'],
  list_agent_name: [
    'ListAgentName', 'ListAgentFullName', 'ListingAgentName', 'ListAgent',
  ],
  list_agent_phone: [
    'ListAgentPhone', 'ListAgentPreferredPhone', 'ListAgentDirectPhone',
    'ListAgentOfficePhone', 'ListingAgentPhone',
  ],
  price: ['ListPrice', 'CurrentPrice', 'ListingPrice'],
  sold_price: ['ClosePrice', 'SoldPrice'],
  sold_date: ['CloseDate', 'SoldDate', 'SettledDate'],
  beds: ['BedroomsTotal', 'Beds', 'Bedrooms', 'BedroomsCount'],
  baths_full: ['BathroomsFull', 'FullBaths', 'BathsFull'],
  baths_half: ['BathroomsHalf', 'HalfBaths', 'PartialBaths'],
  baths_total: ['BathroomsTotalInteger', 'BathroomsTotal', 'TotalBaths', 'Baths'],
  sqft: ['LivingArea', 'AboveGradeFinishedArea', 'SquareFeet', 'TotalFinishedSQFT',
        'PR_TotalLivingArea', 'TotalLivingArea'],
  lot_acres: ['LotSizeAcres', 'Acres'],
  lot_sqft: ['LotSizeSquareFeet', 'LotSquareFeet'],
  year_built: ['YearBuilt', 'PR_YearBuilt', 'Age'],
  property_type: ['PropertySubType', 'PropertyType', 'StructureType', 'Category',
                  'PR_PropertyClass'],
  description: ['PublicRemarks', 'Remarks', 'MarketingRemarks'],
  brokerage: ['ListOfficeName', 'ListingOfficeName', 'ListOffice'],
  status: ['MlsStatus', 'StandardStatus', 'Status'],
};

/** Strip case, spaces, underscores and hyphens so "List Price" == "ListPrice". */
const norm = (s: string) => s.toLowerCase().replace(/[\s_\-#]/g, '');

function buildHeaderMap(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [target, aliases] of Object.entries(FIELD_ALIASES)) {
    const wanted = aliases.map(norm);
    const hit = headers.find((h) => wanted.includes(norm(h)));
    if (hit) map[target] = hit;
  }
  return map;
}

/**
 * Bright/Matrix exports carry HTML entities in free-text fields — PublicRemarks
 * comes through with `you&#x2019;re` rather than a real apostrophe. Astro escapes
 * `&` on output, so storing them raw renders the entity literally on the page.
 * Decode once, at the boundary, so the database holds real characters.
 *
 * Deliberately NOT a general HTML unescape: only numeric entities and the five
 * named ones a spreadsheet actually produces. Anything wider would start
 * decoding markup out of a field we are about to render as text.
 */
const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
};

function decodeEntities(v: string): string {
  return v
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/gi, (_, name) => NAMED[name.toLowerCase()]);
}

const val = (row: Record<string, string>, map: Record<string, string>, key: string) => {
  const col = map[key];
  const v = col ? decodeEntities(row[col] ?? '').trim() : '';
  return v && v !== 'N/A' ? v : undefined;
};

const num = (v?: string): number | undefined => {
  if (!v) return undefined;
  const n = Number(v.replace(/[$,]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/** "14 Oak Street, Bordentown" -> "14-oak-street-bordentown" */
function slugify(address: string, town: string): string {
  return `${address} ${town}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Matrix property types are free-ish text; map to our enum, else leave unset. */
function mapPropertyType(v?: string): string | undefined {
  if (!v) return undefined;
  const s = v.toLowerCase();
  // Bright's PropertySubType vocabulary, not generic guesses:
  // "Detached", "Interior Row/Townhouse", "End of Row/Townhouse",
  // "Twin/Semi-Detached", "Unit/Flat/Apartment", "Penthouse Unit/Flat/Apartment",
  // "Garden 1 - 4 Floors", "Manufactured", "Land".
  // Order matters — "Interior Row/Townhouse" must match townhouse before the
  // "unit" test, and "Twin/Semi-Detached" must not fall through to single-family.
  if (s.includes('town') || s.includes('row')) return 'townhouse';
  if (s.includes('twin') || s.includes('semi-detached') || s.includes('duplex'))
    return 'multi-family';
  if (s.includes('condo') || s.includes('unit') || s.includes('flat') ||
      s.includes('apartment') || s.includes('garden') || s.includes('penthouse'))
    return 'condo';
  if (s.includes('multi') || /\b(triplex|fourplex|quadplex)\b/.test(s)) return 'multi-family';
  if (s.includes('land') || s.includes('lot') || s.includes('acreage')) return 'land';
  if (s.includes('detached') || s.includes('single') || s.includes('manufactured'))
    return 'single-family';
  return undefined;
}

function fail(msg: string): never {
  console.error(`\n  ✗ ${msg}\n`);
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const markOwn = args.includes('--own');
  const file = args.find((a) => !a.startsWith('--'));

  if (!file) fail('Usage: npm run listing:import -- export.csv [--dry-run] [--own]');
  if (!dryRun && (!SUPABASE_URL || !SERVICE_KEY)) {
    fail('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  }

  let rows: Array<Record<string, string>>;
  try {
    rows = parse(readFileSync(file!, 'utf-8'), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true, // Matrix exports frequently carry a UTF-8 BOM
    });
  } catch (e) {
    fail(`Could not parse CSV: ${(e as Error).message}`);
  }

  if (!rows.length) fail('That CSV has no data rows.');

  const headers = Object.keys(rows[0]);
  const map = buildHeaderMap(headers);

  console.log(`\n  ${rows.length} row(s), ${headers.length} column(s)`);
  console.log(`  Recognised ${Object.keys(map).length} field(s).`);

  const missingCritical = ['town', 'address', 'street_name'].every((k) => !map[k]);
  if (missingCritical) {
    console.error('\n  Columns found:', headers.join(', '));
    fail(
      'No address or city column recognised. Re-export including UnparsedAddress ' +
        '(or StreetNumber + StreetName) and City, choosing field NAMES not labels.',
    );
  }
  if (!map.brokerage && !markOwn) {
    console.warn(
      '\n  ! No ListOfficeName column. These import as borrowed listings and cannot\n' +
        '    be published until you supply the listing brokerage.',
    );
  }
  // Same blocking effect as the brokerage: migration 009 refuses to publish a
  // borrowed listing whose listing agent is not named.
  if (!map.list_agent_name && !markOwn) {
    console.warn(
      '\n  ! No ListAgentName column. Bright and NJ REC both require the listing\n' +
        '    agent be identified on the detail page, so these cannot be published\n' +
        '    until you supply it.',
    );
  }

  const prepared: Array<Record<string, unknown>> = [];
  const skipped: string[] = [];
  const warnings: string[] = [];

  for (const [i, row] of rows.entries()) {
    const line = i + 2; // +1 for header, +1 for 1-indexing

    const address =
      val(row, map, 'address') ??
      [val(row, map, 'street_number'), val(row, map, 'street_name'), val(row, map, 'street_suffix')]
        .filter(Boolean)
        .join(' ');
    const town = val(row, map, 'town');

    if (!address || !town) {
      skipped.push(`line ${line}: missing address or city`);
      continue;
    }

    // Property Report exports truncate the street suffix ("37 Wesley" for
    // "37 Wesley Ln"). Never substitute PR_OwnerAddress — for an absentee owner
    // that is a different property. Flag it for a human instead.
    if (!/\b(st|street|ave|avenue|rd|road|ln|lane|dr|drive|ct|court|pl|place|blvd|way|ter|terrace|cir|circle|pkwy|hwy|trl|run|row)\b\.?$/i
          .test(address.replace(/\s+(unit|apt|#).*$/i, '').trim())) {
      warnings.push(
        `line ${line}: "${address}" has no street suffix — check the address before publishing.`,
      );
    }

    const description = val(row, map, 'description');

    // MLS remarks are the previous agent's words. Republishing them makes them
    // your advertising, so they get the same screening as anything typed here.
    if (description) {
      const { findings } = screenFairHousing(description);
      if (findings.length) {
        skipped.push(
          `line ${line}: ${address} — PublicRemarks flagged [` +
            findings.map((f) => `"${f.matched}"`).join(', ') +
            ']',
        );
        continue;
      }
    }

    const bathsFull = num(val(row, map, 'baths_full')) ?? 0;
    const bathsHalf = num(val(row, map, 'baths_half')) ?? 0;
    const baths =
      bathsFull + bathsHalf > 0
        ? bathsFull + bathsHalf * 0.5
        : num(val(row, map, 'baths_total'));

    const acres = num(val(row, map, 'lot_acres'));
    const lotSqft = num(val(row, map, 'lot_sqft'));
    const lot_size = acres
      ? `${acres} acres`
      : lotSqft
        ? `${lotSqft.toLocaleString('en-US')} sq ft`
        : undefined;

    const soldDate = val(row, map, 'sold_date');
    const rawStatus = (val(row, map, 'status') ?? '').toLowerCase();
    const isSold = /clos|sold|settled/.test(rawStatus);

    prepared.push({
      slug: slugify(address, town),
      status: 'draft', // never auto-publish MLS data
      address,
      town,
      county: (() => {
        const c = val(row, map, 'county');
        if (!c) return undefined;
        const bare = c.replace(/,\s*[A-Z]{2}$/, '').trim(); // "Burlington, NJ" -> "Burlington"
        return /county$/i.test(bare) ? bare : `${bare} County`;
      })(),
      zipcode: val(row, map, 'zipcode'),
      state: val(row, map, 'state') ?? 'NJ',
      price: num(val(row, map, 'price')),
      beds: num(val(row, map, 'beds')),
      baths,
      sqft: num(val(row, map, 'sqft')),
      lot_size,
      year_built: num(val(row, map, 'year_built')),
      property_type: mapPropertyType(val(row, map, 'property_type')),
      mls_number: val(row, map, 'mls_number'),
      description,
      highlights: [],
      images: [], // Matrix CSV exports carry no photos — add URLs separately
      is_own_listing: markOwn,
      listing_brokerage: markOwn ? undefined : val(row, map, 'brokerage'),
      list_agent_name: markOwn ? undefined : val(row, map, 'list_agent_name'),
      list_agent_phone: markOwn ? undefined : val(row, map, 'list_agent_phone'),
      permission_confirmed: false, // always an explicit human step
      sold_price: isSold ? num(val(row, map, 'sold_price')) : undefined,
      sold_date: isSold ? soldDate : undefined,
    });
  }

  // PostgREST requires every object in a batch INSERT to carry an identical key
  // set ("All object keys must match"). Deleting empty fields per row breaks that
  // as soon as one listing has, say, no lot size. Normalise to the union of keys
  // instead, with explicit nulls — which is also what we want in the database:
  // a missing MLS field is genuinely null, not absent.
  const allKeys = [...new Set(prepared.flatMap((p) => Object.keys(p)))];
  for (const p of prepared) {
    for (const k of allKeys) if (p[k] === undefined) p[k] = null;
  }

  console.log(`\n  Ready to import: ${prepared.length}`);
  if (warnings.length) {
    console.log(`  Needs review: ${warnings.length}`);
    for (const w of warnings) console.log(`    ! ${w}`);
  }
  if (skipped.length) {
    console.log(`  Skipped: ${skipped.length}`);
    for (const s of skipped) console.log(`    - ${s}`);
  }
  for (const p of prepared.slice(0, 5)) {
    console.log(
      `    ${String(p.address).slice(0, 34).padEnd(34)} ${p.town}  ` +
        `${p.price ? '$' + Number(p.price).toLocaleString('en-US') : '—'}  /listings/${p.slug}/`,
    );
  }
  if (prepared.length > 5) console.log(`    ... and ${prepared.length - 5} more`);

  if (dryRun) {
    console.log('\n  Dry run — nothing written.\n');
    return;
  }
  if (!prepared.length) {
    console.log('\n  Nothing to import.\n');
    return;
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/listings?on_conflict=slug`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY!,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(prepared),
  });

  if (!res.ok) fail(`Supabase rejected the import (${res.status}): ${(await res.text()).slice(0, 300)}`);

  const saved = (await res.json()) as Array<{ slug: string }>;
  console.log(`\n  ✓ Imported ${saved.length} listing(s) as DRAFTS.\n`);
  console.log('  Nothing is public yet. For each one you want live:');
  console.log('    1. Confirm the listing broker has agreed to you marketing it.');
  console.log('    2. Set permission_confirmed = true (and add photo URLs).');
  console.log('    3. Publish, then run:  npm run listing:publish\n');
}

main().catch((e) => fail(e.message));
