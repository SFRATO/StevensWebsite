/**
 * Market Analysis Utilities
 * Functions for enriching town data with market metrics and computing
 * "Movers and Shakers" featured market categories.
 */

import { serviceAreas, getAllTowns, type TownMapping } from '../data/town-mappings';
import zipcodesData from '../../data/processed/zipcodes.json';

// Types from the zipcode data
export interface ZipData {
  zipcode: string;
  region: string;
  city: string;
  county: string;
  state: string;
  state_code: string;
  period_end: string;
  last_updated: string;
  median_sale_price: number | null;
  median_sale_price_yoy: number | null;
  median_list_price: number | null;
  median_list_price_yoy: number | null;
  inventory: number | null;
  inventory_yoy: number | null;
  months_of_supply: number | null;
  months_of_supply_yoy: number | null;
  median_dom: number | null;
  median_dom_yoy: number | null;
  homes_sold: number | null;
  homes_sold_yoy: number | null;
  sold_above_list_pct: number | null;
  price_drops_pct: number | null;
  market_type: 'seller' | 'buyer' | 'balanced';
  trend_direction: 'up' | 'down' | 'stable';
  nearby_zips: string[];
  ai_insight?: string;
}

// Enriched town data combining our curated names with market metrics
export interface EnrichedTown {
  name: string;
  zipcode: string;
  county: string;
  medianPrice: number | null;
  priceYoY: number | null;
  medianDom: number | null;
  domYoY: number | null;
  inventory: number | null;
  inventoryYoY: number | null;
  marketType: 'seller' | 'buyer' | 'balanced';
  trendDirection: 'up' | 'down' | 'stable';
  periodEnd: string;
}

// Movers and Shakers categories
export interface MoversAndShakers {
  hotMarkets: EnrichedTown[];      // Highest price appreciation
  fastMarkets: EnrichedTown[];     // Lowest days on market
  competitiveMarkets: EnrichedTown[]; // Biggest inventory decrease
}

// Get all zipcodes as typed array
const allZipcodes = zipcodesData as ZipData[];

/**
 * Get enriched town data by merging curated town names with market metrics
 * Returns all towns with available market data
 */
export function getEnrichedTowns(): EnrichedTown[] {
  const towns = getAllTowns();
  const enriched: EnrichedTown[] = [];

  // Track which zipcodes we've already processed to avoid duplicates
  // (multiple towns may share a zipcode)
  const processedZips = new Set<string>();

  for (const town of towns) {
    // Find matching zipcode data
    const zipData = allZipcodes.find((z) => z.zipcode === town.zipcode);

    if (zipData && !processedZips.has(town.zipcode)) {
      enriched.push({
        name: town.name,
        zipcode: town.zipcode,
        county: town.county,
        medianPrice: zipData.median_sale_price,
        priceYoY: zipData.median_sale_price_yoy,
        medianDom: zipData.median_dom,
        domYoY: zipData.median_dom_yoy,
        inventory: zipData.inventory,
        inventoryYoY: zipData.inventory_yoy,
        marketType: zipData.market_type,
        trendDirection: zipData.trend_direction,
        periodEnd: zipData.period_end,
      });
      processedZips.add(town.zipcode);
    } else if (zipData && processedZips.has(town.zipcode)) {
      // For duplicate zipcodes, still add the town (different name, same data)
      const existingData = enriched.find((e) => e.zipcode === town.zipcode);
      if (existingData) {
        enriched.push({
          ...existingData,
          name: town.name,
        });
      }
    }
  }

  return enriched;
}

/**
 * Get enriched towns grouped by county
 */
export function getEnrichedTownsByCounty(): Record<string, EnrichedTown[]> {
  const enrichedTowns = getEnrichedTowns();
  const byCounty: Record<string, EnrichedTown[]> = {};

  for (const county of Object.keys(serviceAreas)) {
    byCounty[county] = enrichedTowns
      .filter((t) => t.county === county)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  return byCounty;
}

/**
 * Compute "Movers and Shakers" - featured markets by category
 *
 * - Hot Markets: Highest YoY price appreciation (>5%)
 * - Fast Markets: Lowest days on market (<45 days)
 * - Competitive Markets: Biggest inventory decrease (<-10% YoY)
 */
export function computeMoversAndShakers(limit: number = 6): MoversAndShakers {
  const enrichedTowns = getEnrichedTowns();

  // Filter for towns with valid data for each category

  // Hottest Markets - sorted by price appreciation (descending)
  const hotMarkets = enrichedTowns
    .filter((t) => t.priceYoY !== null && t.priceYoY > 5)
    .sort((a, b) => (b.priceYoY ?? 0) - (a.priceYoY ?? 0))
    .slice(0, limit);

  // Selling Fastest - sorted by days on market (ascending)
  const fastMarkets = enrichedTowns
    .filter((t) => t.medianDom !== null && t.medianDom < 45)
    .sort((a, b) => (a.medianDom ?? 999) - (b.medianDom ?? 999))
    .slice(0, limit);

  // Most Competitive - sorted by inventory decrease (most negative first)
  const competitiveMarkets = enrichedTowns
    .filter((t) => t.inventoryYoY !== null && t.inventoryYoY < -10)
    .sort((a, b) => (a.inventoryYoY ?? 0) - (b.inventoryYoY ?? 0))
    .slice(0, limit);

  return {
    hotMarkets,
    fastMarkets,
    competitiveMarkets,
  };
}

/**
 * Format currency for display
 */
export function formatCurrency(value: number | null): string {
  if (value === null) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format percentage with sign
 */
export function formatPercent(value: number | null, includeSign: boolean = true): string {
  if (value === null) return 'N/A';
  const sign = includeSign && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

/**
 * Get market context line for lead forms based on conditions
 */
export function getMarketContextLine(town: EnrichedTown): string | null {
  if (town.marketType === 'seller' && town.medianDom !== null && town.medianDom < 30) {
    return `Homes here are selling in just ${Math.round(town.medianDom)} days on average`;
  }
  if (town.priceYoY !== null && town.priceYoY > 5) {
    return `Prices are up ${town.priceYoY.toFixed(1)}% from last year`;
  }
  if (town.marketType === 'seller') {
    return `Currently a seller's market with strong demand`;
  }
  return null;
}

/**
 * Get data for town search component
 * Returns simplified town data optimized for search/autocomplete
 */
export function getTownSearchData(): Array<{
  name: string;
  zipcode: string;
  county: string;
  medianPrice: number | null;
  priceYoY: number | null;
  marketType: 'seller' | 'buyer' | 'balanced';
}> {
  return getEnrichedTowns().map((t) => ({
    name: t.name,
    zipcode: t.zipcode,
    county: t.county,
    medianPrice: t.medianPrice,
    priceYoY: t.priceYoY,
    marketType: t.marketType,
  }));
}
