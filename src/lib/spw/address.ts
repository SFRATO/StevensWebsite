/**
 * Address validation and slug derivation for the SPW builder.
 *
 * WHY THERE IS NO ADDRESS API
 * ---------------------------
 * The obvious move is Google Places or Mapbox. Neither is used, for a concrete
 * reason: the project already carries the data that actually matters, and the
 * MLS sheet is the authoritative source for the address anyway — the builder
 * cross-checks one against the other rather than trusting a geocoder.
 *
 * What the local data can and cannot do:
 *   data/processed/zipcodes.json covers 97 ZIPs across Burlington, Mercer and
 *   Middlesex only. Four of the eight listings already published — Cherry Hill,
 *   Egg Harbor Township, Bridgeton, Pennsauken — are OUTSIDE it.
 *
 * So the dataset SUGGESTS and never GATES. Gating on it would have rejected half
 * the existing portfolio. Validation below is format-level plus the New Jersey
 * ZIP range, which is the same rule the seller funnel already enforces in
 * netlify/functions/cash-offer-lead.ts.
 */

export interface AddressInput {
  street: string;
  town: string;
  zipcode: string;
  county?: string;
}

export interface AddressCheck {
  ok: boolean;
  errors: Partial<Record<'street' | 'town' | 'zipcode', string>>;
}

/** New Jersey is 07000–08999 — the whole state, not just the service area. */
export function isNjZip(zip: string): boolean {
  const n = Number.parseInt(zip.slice(0, 5), 10);
  return Number.isFinite(n) && n >= 7000 && n <= 8999;
}

export function validateAddress(a: AddressInput): AddressCheck {
  const errors: AddressCheck['errors'] = {};

  const street = a.street?.trim() ?? '';
  // Same test as the seller funnel: an address with no number cannot be located,
  // and a listing whose address cannot be located is not publishable.
  if (street.length < 5 || !/\d/.test(street)) {
    errors.street = 'Include the street number and name.';
  }

  const town = a.town?.trim() ?? '';
  if (town.length < 2 || !/^[A-Za-z][A-Za-z\s'\-.]*$/.test(town)) {
    errors.town = 'Enter the town or municipality.';
  }

  const zip = a.zipcode?.trim() ?? '';
  if (!/^\d{5}$/.test(zip)) errors.zipcode = 'Enter a 5-digit ZIP code.';
  else if (!isNjZip(zip)) errors.zipcode = 'That ZIP code is outside New Jersey.';

  return { ok: Object.keys(errors).length === 0, errors };
}

/**
 * `10 Edinburgh Ln` + `Mount Laurel` -> `10-edinburgh-ln-mount-laurel`.
 *
 * Identical to the rule the existing records were created under (slugify in
 * data/scripts/import-mls.ts), and constrained by listings_slug_shape_chk:
 * ^[a-z0-9]+(-[a-z0-9]+)*$
 */
export function deriveSlug(street: string, town: string): string {
  return `${street} ${town}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
}

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
