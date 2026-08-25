/**
 * Ad + listing copy generator — templates, no LLM.
 *
 * Fills deterministic templates from listing facts and the market data already
 * in data/processed/zipcodes.json. No API key, no vendor account, no per-call
 * cost, no network. Runs anywhere.
 *
 * WHY TEMPLATES ARE A REASONABLE FIT HERE
 * ---------------------------------------
 * Real-estate ad copy is formulaic by nature: a hook, two or three concrete
 * verifiable facts, a call to action. The persuasive work is done by the facts
 * (price, beds, days-on-market), not by the prose. What a language model adds is
 * variety across many ads — which matters at scale and matters much less for a
 * solo agent running a handful a week.
 *
 * The honest limitation: run fifty of these and the family resemblance shows.
 * The rotation below mitigates it (structure is chosen from the input, so
 * different listings get different shapes) but does not eliminate it.
 *
 * FAIR HOUSING
 * ------------
 * Templates are written to be compliant by construction — they describe the
 * property, never the occupant. But `highlights` is free text typed by Steven,
 * and that is now the real risk vector: a model can be instructed, a human
 * typing "great for families" into a notes box cannot. Every generated field is
 * therefore still screened by src/lib/copy/../ai/fairHousing.ts. That screener
 * got *more* important when the model went away, not less.
 */
import { LICENSE_LINE, PHONE, EMAIL } from '../../data/contact';
import { screenFields, type FairHousingFinding } from '../ai/fairHousing';

export type AdFormat =
  | 'facebook-listing'
  | 'facebook-seller-lead'
  | 'open-house'
  | 'listing-description'
  | 'just-listed-postcard';

export interface ListingInput {
  address?: string;
  town: string;
  county?: string;
  zipcode?: string;
  price?: number;
  beds?: number;
  baths?: number;
  sqft?: number;
  /** Free text from Steven. Screened — see the Fair Housing note above. */
  highlights?: string;
}

export interface MarketInput {
  town: string;
  county?: string;
  medianSalePrice?: number | null;
  medianDom?: number | null;
  monthsOfSupply?: number | null;
  marketType?: 'seller' | 'buyer' | 'balanced';
}

export interface AdVariant {
  headline: string;
  body: string;
  callToAction: string;
  /** Attached here, unconditionally — never optional. */
  disclosure: string;
}

export interface GenerateResult {
  ok: boolean;
  variants: AdVariant[];
  /** Keyed `variant-<n>.<field>`. Non-empty means something needs a human edit. */
  fairHousingFindings: Record<string, FairHousingFinding[]>;
  /** Facts that were unavailable, so the caller can show "add these for better copy". */
  missingFacts: string[];
}

// --- formatting --------------------------------------------------------------

const money = (n?: number | null): string | undefined =>
  typeof n === 'number' && n > 0
    ? `$${Math.round(n).toLocaleString('en-US')}`
    : undefined;

const sqftFmt = (n?: number): string | undefined =>
  typeof n === 'number' && n > 0 ? `${n.toLocaleString('en-US')} sq ft` : undefined;

/** "3 bed, 2 bath" — omits either half cleanly when one is unknown. */
function bedBath(beds?: number, baths?: number): string | undefined {
  const parts: string[] = [];
  if (beds && beds > 0) parts.push(`${beds} bed`);
  if (baths && baths > 0) parts.push(`${baths} bath`);
  return parts.length ? parts.join(', ') : undefined;
}

/** Join with commas and a final "and", dropping blanks. */
function sentenceList(items: Array<string | undefined>): string {
  const xs = items.filter((x): x is string => Boolean(x));
  if (xs.length === 0) return '';
  if (xs.length === 1) return xs[0];
  if (xs.length === 2) return `${xs[0]} and ${xs[1]}`;
  return `${xs.slice(0, -1).join(', ')}, and ${xs[xs.length - 1]}`;
}

/**
 * Join complete sentences. Distinct from sentenceList, which joins PHRASES —
 * using the phrase joiner on sentences produces ".," seams and a capitalised
 * "and The ...". Ensures terminal punctuation, then separates with a space.
 */
function joinSentences(items: Array<string | undefined>): string {
  return items
    .filter((x): x is string => Boolean(x && x.trim()))
    .map((x) => {
      const t = x.trim();
      return /[.!?]$/.test(t) ? t : `${t}.`;
    })
    .join(' ');
}

/**
 * Stable index from a string, so a given listing always produces the same
 * variant shapes (reproducible, reviewable) while different listings get
 * different ones. Deterministic on purpose — random output would mean the copy
 * changed every time Steven reloaded the page.
 */
function seedIndex(seed: string, modulo: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % modulo;
}

/** Rotate a template pool so the three variants are always distinct. */
function pick<T>(pool: T[], seed: string, offset: number): T {
  return pool[(seedIndex(seed, pool.length) + offset) % pool.length];
}

// --- market phrasing ---------------------------------------------------------

/**
 * Turn market numbers into a clause. Deliberately factual: no "hot market", no
 * "act now", no prediction — those invite both a misrepresentation claim and
 * (for the seller-lead format) an unrealistic expectation.
 */
function marketClause(m?: MarketInput): string | undefined {
  if (!m) return undefined;
  const bits: string[] = [];

  const median = money(m.medianSalePrice);
  if (median) bits.push(`the median sale price in ${m.town} is ${median}`);

  if (typeof m.medianDom === 'number' && m.medianDom > 0) {
    bits.push(`homes are going under contract in a median of ${m.medianDom} days`);
  }

  if (typeof m.monthsOfSupply === 'number' && m.monthsOfSupply > 0) {
    bits.push(`there's ${m.monthsOfSupply.toFixed(1)} months of supply on the market`);
  }

  if (!bits.length) return undefined;
  const clause = sentenceList(bits);
  return clause.charAt(0).toUpperCase() + clause.slice(1) + '.';
}

// --- templates ---------------------------------------------------------------
// Each pool holds structurally different openings, not reworded ones — the
// point of the rotation is that two ads don't read as the same sentence.

const LISTING_HEADLINES = [
  (t: string, bb?: string) => (bb ? `${bb} in ${t}` : `New in ${t}`),
  (t: string, bb?: string, p?: string) =>
    p ? `${t} — ${p}` : `Now available in ${t}`,
  (t: string) => `Just listed in ${t}`,
  (t: string, bb?: string) => (bb ? `Take a look: ${bb}, ${t}` : `Take a look in ${t}`),
];

const SELLER_HEADLINES = [
  (t: string) => `What's your ${t} home worth right now?`,
  (t: string) => `Thinking about selling in ${t}?`,
  (t: string) => `${t} homeowners: here's where the market stands`,
  (t: string) => `Curious what ${t} buyers are paying?`,
];

const LISTING_CTAS = [
  `Message me for the full details and photos.`,
  `Call or text ${PHONE} to set up a walkthrough.`,
  `Reach out at ${PHONE} — I'll send over everything I have.`,
  `Email ${EMAIL} and I'll get you the disclosures and comps.`,
];

const SELLER_CTAS = [
  `Request a free, no-obligation valuation and I'll send it over.`,
  `Call or text ${PHONE} for a straight answer on your home's value.`,
  `Get a free home valuation — no pressure, no obligation.`,
  `Message me and I'll put together a valuation for your address.`,
];

const POSTCARD_HOOKS = [
  `Wondering what that means for your own value? I'll tell you straight.`,
  `If you've been curious what your place would sell for, I can tell you.`,
  `Want to know where that leaves your home? Happy to run the numbers.`,
];

const POSTCARD_CTAS = [
  `Free valuation — call or text ${PHONE}.`,
  `No-obligation valuation: ${PHONE}.`,
  `Reach me at ${PHONE} for a free valuation.`,
];

// --- generator ---------------------------------------------------------------

interface BuildContext {
  listing?: ListingInput;
  market?: MarketInput;
  town: string;
  bb?: string;
  price?: string;
  sqft?: string;
  facts: string;
  market_clause?: string;
  highlights?: string;
  seed: string;
}

function buildVariant(format: AdFormat, ctx: BuildContext, offset: number): AdVariant {
  const { town, bb, price, seed } = ctx;

  let headline: string;
  let body: string;
  let callToAction: string;

  switch (format) {
    case 'facebook-seller-lead': {
      headline = pick(SELLER_HEADLINES, seed, offset)(town);
      body = joinSentences([
        ctx.market_clause,
        `If you've wondered what that means for your own address, I can put together a valuation based on what's actually selling nearby — not an automated estimate.`,
      ]);
      callToAction = pick(SELLER_CTAS, seed, offset);
      break;
    }

    case 'open-house': {
      headline = bb ? `Open house: ${bb} in ${town}` : `Open house in ${town}`;
      body =
        joinSentences([ctx.facts, ctx.highlights]) ||
        `Come walk through and see the space in person.`;
      callToAction = `Message me for the time and address, or just stop by.`;
      break;
    }

    case 'listing-description': {
      headline = ctx.listing?.address ?? `${town} listing`;
      body = joinSentences([ctx.facts, ctx.highlights, ctx.market_clause]);
      callToAction = `Contact ${PHONE} to schedule a showing.`;
      break;
    }

    case 'just-listed-postcard': {
      headline = `Just listed in your neighborhood`;
      body = joinSentences([
        bb
          ? `${bb}${price ? `, listed at ${price}` : ''} just came on the market near you`
          : `A home just came on the market near you`,
        pick(POSTCARD_HOOKS, seed, offset),
      ]);
      callToAction = pick(POSTCARD_CTAS, seed, offset);
      break;
    }

    case 'facebook-listing':
    default: {
      headline = pick(LISTING_HEADLINES, seed, offset)(town, bb, price);
      body = joinSentences([ctx.facts, ctx.highlights, ctx.market_clause]);
      callToAction = pick(LISTING_CTAS, seed, offset);
      break;
    }
  }

  return {
    headline,
    body: body.trim(),
    callToAction,
    // Unconditional. NJ requires the licence disclosure in advertising, and
    // src/data/contact.ts marks it "do not drop".
    disclosure: LICENSE_LINE,
  };
}

export function generateAdCopy(opts: {
  format: AdFormat;
  listing?: ListingInput;
  market?: MarketInput;
}): GenerateResult {
  const { format, listing, market } = opts;
  if (!listing && !market) {
    throw new Error('generateAdCopy needs at least one of `listing` or `market`.');
  }

  const town = listing?.town ?? market?.town ?? '';
  const bb = bedBath(listing?.beds, listing?.baths);
  const price = money(listing?.price);
  const sqft = sqftFmt(listing?.sqft);

  // Only verifiable, supplied facts. Nothing is inferred or estimated — an
  // invented square footage in an ad is a misrepresentation problem.
  const facts = sentenceList([bb, sqft, price ? `listed at ${price}` : undefined]);

  const highlights = listing?.highlights?.trim()
    ? listing.highlights.trim().replace(/\s+/g, ' ')
    : undefined;

  const ctx: BuildContext = {
    listing,
    market,
    town,
    bb,
    price,
    sqft,
    facts: facts ? `${facts.charAt(0).toUpperCase()}${facts.slice(1)}.` : '',
    market_clause: marketClause(market),
    highlights: highlights
      ? highlights.endsWith('.')
        ? highlights
        : `${highlights}.`
      : undefined,
    seed: `${format}|${town}|${listing?.address ?? ''}|${listing?.price ?? ''}`,
  };

  const variants = [0, 1, 2].map((i) => buildVariant(format, ctx, i));

  // Tell the caller what would improve the copy, rather than silently producing
  // something thin. This is the template equivalent of a model asking for detail.
  const missingFacts: string[] = [];
  const needsListing = format !== 'facebook-seller-lead';
  const needsMarket = format === 'facebook-seller-lead' || format === 'facebook-listing';

  if (needsListing) {
    if (!listing?.beds) missingFacts.push('bedrooms');
    if (!listing?.baths) missingFacts.push('bathrooms');
    if (!listing?.sqft) missingFacts.push('square footage');
    if (!listing?.price) missingFacts.push('price');
    if (!highlights) missingFacts.push('what stands out about this home');
  }
  if (needsMarket && !ctx.market_clause) {
    missingFacts.push('local market data for this town');
  }

  // Screen every field. The templates are clean by construction, so in practice
  // this catches Steven's own `highlights` text — which is exactly the point.
  const fairHousingFindings: Record<string, FairHousingFinding[]> = {};
  variants.forEach((v, i) => {
    const byField = screenFields({
      headline: v.headline,
      body: v.body,
      callToAction: v.callToAction,
    });
    for (const [field, findings] of Object.entries(byField)) {
      fairHousingFindings[`variant-${i + 1}.${field}`] = findings;
    }
  });

  return {
    ok: Object.keys(fairHousingFindings).length === 0,
    variants,
    fairHousingFindings,
    missingFacts,
  };
}
