/**
 * The shape the builder collects and the shape Claude is asked to return when
 * reading an MLS screenshot.
 *
 * Deliberately mirrors what the detailed SPWs already render — the `listings`
 * columns plus ListingDetails in src/lib/listings.ts. Nothing here is new
 * vocabulary; if a field is not rendered by src/pages/listings/[slug].astro it
 * does not belong in this file.
 *
 * AGENT-ONLY CONTENT IS ABSENT BY CONSTRUCTION. There is no field for private
 * remarks, showing instructions, ShowingTime details, lockbox codes, offer
 * submission rules, showing contacts or owner names, so there is no path from a
 * screenshot to a public page for any of it — the extraction prompt refuses
 * them and the form has nowhere to put them even if it didn't.
 */

export interface MlsExtract {
  // --- core, drives the listings columns ---
  street?: string;
  town?: string;
  state?: string;
  zipcode?: string;
  county?: string;
  price?: number;
  beds?: number;
  baths?: number;
  sqft?: number;
  yearBuilt?: number;
  propertyType?: 'single-family' | 'condo' | 'townhouse' | 'multi-family' | 'land';
  mlsNumber?: string;
  lotSize?: string;

  // --- attribution ---
  listingAgent?: string;
  listingAgentPhone?: string;
  listingBrokerage?: string;

  // --- consumer-facing narrative ---
  publicRemarks?: string;

  // --- everything that lands in details.factGroups ---
  style?: string;
  levels?: string;
  structureType?: string;
  ownership?: string;
  basement?: string;
  garage?: string;
  parking?: string;
  heating?: string;
  cooling?: string;
  waterSource?: string;
  sewer?: string;
  hotWater?: string;
  schoolDistrict?: string;
  subdivision?: string;
  municipality?: string;
  crossStreet?: string;
  zoning?: string;
  taxAnnual?: string;
  taxYear?: string;
  assessedValue?: string;
  improvementsValue?: string;
  landValue?: string;
  taxId?: string;
  blockLot?: string;
  acceptableFinancing?: string;
  possession?: string;
  pricePerSqFt?: string;
  status?: string;

  // --- lists ---
  interiorFeatures?: string[];
  exteriorFeatures?: string[];
  accessibilityFeatures?: string[];
  rooms?: Array<{ level: string; name: string; size?: string }>;
}

/** JSON Schema handed to the model. Kept in lockstep with MlsExtract above. */
export const MLS_EXTRACT_SCHEMA = {
  type: 'object',
  properties: {
    street: { type: 'string' }, town: { type: 'string' }, state: { type: 'string' },
    zipcode: { type: 'string' }, county: { type: 'string' },
    price: { type: 'number' }, beds: { type: 'number' }, baths: { type: 'number' },
    sqft: { type: 'number' }, yearBuilt: { type: 'number' },
    propertyType: { type: 'string', enum: ['single-family', 'condo', 'townhouse', 'multi-family', 'land'] },
    mlsNumber: { type: 'string' }, lotSize: { type: 'string' },
    listingAgent: { type: 'string' }, listingAgentPhone: { type: 'string' },
    listingBrokerage: { type: 'string' }, publicRemarks: { type: 'string' },
    style: { type: 'string' }, levels: { type: 'string' }, structureType: { type: 'string' },
    ownership: { type: 'string' }, basement: { type: 'string' }, garage: { type: 'string' },
    parking: { type: 'string' }, heating: { type: 'string' }, cooling: { type: 'string' },
    waterSource: { type: 'string' }, sewer: { type: 'string' }, hotWater: { type: 'string' },
    schoolDistrict: { type: 'string' }, subdivision: { type: 'string' },
    municipality: { type: 'string' }, crossStreet: { type: 'string' }, zoning: { type: 'string' },
    taxAnnual: { type: 'string' }, taxYear: { type: 'string' }, assessedValue: { type: 'string' },
    improvementsValue: { type: 'string' }, landValue: { type: 'string' },
    taxId: { type: 'string' }, blockLot: { type: 'string' },
    acceptableFinancing: { type: 'string' }, possession: { type: 'string' },
    pricePerSqFt: { type: 'string' }, status: { type: 'string' },
    interiorFeatures: { type: 'array', items: { type: 'string' } },
    exteriorFeatures: { type: 'array', items: { type: 'string' } },
    accessibilityFeatures: { type: 'array', items: { type: 'string' } },
    rooms: {
      type: 'array',
      items: {
        type: 'object',
        properties: { level: { type: 'string' }, name: { type: 'string' }, size: { type: 'string' } },
        required: ['level', 'name'],
      },
    },
  },
} as const;
