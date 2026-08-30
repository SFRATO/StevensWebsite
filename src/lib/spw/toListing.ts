/**
 * Turn what the builder collected into the exact row shape the SPW template
 * already renders.
 *
 * This file is the ONLY place that knows how builder fields map onto
 * `listings` columns and `ListingDetails`. The template
 * (src/pages/listings/[slug].astro) is unchanged and remains the source of
 * truth for how any of it looks — this just fills the same structure the eight
 * hand-built records use, so a generated SPW and a hand-built one are
 * indistinguishable downstream.
 */
import type { ListingDetails } from '../listings';
import type { MlsExtract } from './schema';
import { deriveSlug } from './address';

export interface BuilderPayload extends MlsExtract {
  slug?: string;
  description?: string;
  highlights?: string[];
  images?: string[];
  disclosures?: string[];
  isOwnListing?: boolean;
  publish?: boolean;
}

/**
 * A row is worth rendering if it has a value. Numbers count: beds, baths and
 * year built arrive as numbers, and an earlier string-only version of this
 * check silently dropped every one of them, which cost the whole Interior
 * group. Zero is treated as absent — a 0-bed listing is a data error, not a
 * fact worth printing.
 */
const has = (v: unknown): boolean =>
  typeof v === 'number' ? Number.isFinite(v) && v !== 0 : typeof v === 'string' && v.trim().length > 0;

/** Drop empty rows so a sparse MLS sheet does not render half-empty groups. */
const group = (title: string, rows: Array<[string, unknown]>) => {
  const kept = rows.filter(([, v]) => has(v)).map(([k, v]) => [k, String(v).trim()] as [string, string]);
  return kept.length ? { title, rows: kept } : null;
};

const featureGroup = (title: string, items?: string[]) => {
  const kept = (items ?? []).map((s) => s.trim()).filter(Boolean);
  return kept.length ? { title, items: kept } : null;
};

export function buildDetails(p: BuilderPayload): ListingDetails | null {
  const factGroups = [
    group('Structure', [
      ['Property type', p.propertyType?.replace('-', ' ')],
      ['Style', p.style],
      ['Structure', p.structureType],
      ['Levels', p.levels],
      ['Year built', p.yearBuilt],
      ['Above-grade finished', p.sqft ? `${p.sqft.toLocaleString('en-US')} sq ft` : ''],
      ['Ownership', p.ownership],
    ]),
    group('Interior', [
      ['Bedrooms', p.beds],
      ['Bathrooms', p.baths],
      ['Basement', p.basement],
    ]),
    group('Systems & utilities', [
      ['Heating', p.heating],
      ['Cooling', p.cooling],
      ['Hot water', p.hotWater],
      ['Water', p.waterSource],
      ['Sewer', p.sewer],
    ]),
    group('Parking', [
      ['Garage', p.garage],
      ['Features', p.parking],
    ]),
    group('Lot', [
      ['Lot size', p.lotSize],
      ['Zoning', p.zoning],
    ]),
    group('Location & schools', [
      ['Municipality', p.municipality],
      ['County', p.county],
      ['Subdivision', p.subdivision],
      ['Cross street', p.crossStreet],
      ['School district', p.schoolDistrict],
    ]),
    group('Taxes & assessment', [
      ['Annual taxes', p.taxAnnual && p.taxYear ? `${p.taxAnnual} (${p.taxYear})` : p.taxAnnual],
      ['Assessed value', p.assessedValue],
      ['Improvements', p.improvementsValue],
      ['Land', p.landValue],
      ['Tax ID', p.taxId],
      ['Block/Lot', p.blockLot],
    ]),
    group('Listing', [
      ['MLS #', p.mlsNumber],
      ['Status', p.status],
      ['Price per sq ft', p.pricePerSqFt],
      ['Acceptable financing', p.acceptableFinancing],
      ['Possession', p.possession],
    ]),
  ].filter(Boolean) as NonNullable<ListingDetails['factGroups']>;

  const featureGroups = [
    featureGroup('Interior features', p.interiorFeatures),
    featureGroup('Exterior features', p.exteriorFeatures),
    featureGroup('Accessibility', p.accessibilityFeatures),
  ].filter(Boolean) as NonNullable<ListingDetails['featureGroups']>;

  const rooms = (p.rooms ?? []).filter((r) => has(r.level) && has(r.name));
  const disclosures = (p.disclosures ?? []).map((s) => s.trim()).filter(Boolean);

  const details: ListingDetails = {};
  if (factGroups.length) details.factGroups = factGroups;
  if (featureGroups.length) details.featureGroups = featureGroups;
  if (rooms.length) details.rooms = rooms;
  if (disclosures.length) details.disclosures = disclosures;

  return Object.keys(details).length ? details : null;
}

/** The `listings` row itself. Column names match 008/009/013 exactly. */
export function buildRow(p: BuilderPayload) {
  const slug = p.slug?.trim() || deriveSlug(p.street ?? '', p.town ?? '');
  return {
    slug,
    address: (p.street ?? '').trim(),
    town: (p.town ?? '').trim(),
    county: p.county?.trim() || null,
    zipcode: p.zipcode?.trim() || null,
    state: 'NJ',
    price: p.price ?? null,
    beds: p.beds ?? null,
    baths: p.baths ?? null,
    sqft: p.sqft ?? null,
    lot_size: p.lotSize?.trim() || null,
    year_built: p.yearBuilt ?? null,
    property_type: p.propertyType ?? null,
    mls_number: p.mlsNumber?.trim() || null,
    description: p.description?.trim() || null,
    highlights: (p.highlights ?? []).map((s) => s.trim()).filter(Boolean),
    images: p.images ?? [],
    is_own_listing: p.isOwnListing === true,
    listing_brokerage: p.listingBrokerage?.trim() || null,
    list_agent_name: p.listingAgent?.trim() || null,
    list_agent_phone: p.listingAgentPhone?.trim() || null,
    // Active = published, Inactive = draft. The enum already has both, and
    // `published` is what getPublishedListings(), the confirmation email's card
    // query and listings_public_read all filter on — so flipping this one value
    // removes the SPW from the site AND from the email with nothing else aware.
    status: p.publish ? 'published' : 'draft',
    permission_confirmed: p.isOwnListing === true ? false : true,
    details: buildDetails(p),
  };
}
