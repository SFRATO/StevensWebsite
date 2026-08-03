/**
 * Page Location Resolver
 *
 * Resolves the geographic context of a page from its pathname alone, at build
 * time. Global components mounted in BaseLayout (the exit-intent popup, the
 * consent banner, activity tracking) render on all ~357 pages and have no page
 * props, so threading location through every page template is not viable —
 * every route pattern encodes its town/zip/county in the URL instead.
 *
 * Pure and synchronous: safe to call from any `.astro` frontmatter.
 */

import {
  getAllTowns,
  getTownSlug,
  getTownsByZipcode,
  getTownsByCountySlug,
  getCountyNameFromSlug,
} from '../data/town-mappings';
import { formatCurrency, formatPercent, type ZipData } from './market-analysis';
import zipcodesData from '../../data/processed/zipcodes.json';
import countiesData from '../../data/processed/counties.json';

const allZipcodes = zipcodesData as ZipData[];

interface CountyRecord {
  region: string;
  slug: string;
  median_sale_price: number | null;
  median_sale_price_yoy: number | null;
  median_dom: number | null;
  market_type: 'seller' | 'buyer' | 'balanced';
}

const allCounties = countiesData as CountyRecord[];

/** How specific the resolved location is — drives popup copy. */
export type LocationScope = 'town' | 'zipcode' | 'county';

export interface PageLocation {
  scope: LocationScope;
  /** Human-readable place name used in copy, e.g. "Brick" or "Ocean County". */
  label: string;
  town?: string;
  townSlug?: string;
  zipcode?: string;
  county?: string;
  countySlug?: string;
  medianPrice: number | null;
  priceYoY: number | null;
  medianDom: number | null;
  marketType: 'seller' | 'buyer' | 'balanced' | null;
}

/** Lazily-built slug -> town index. Covers /home-value/ and /moving-to/, whose URLs carry no county. */
let townsBySlug: Map<string, { name: string; zipcode: string; county: string }> | null = null;

function getTownBySlug(slug: string) {
  if (!townsBySlug) {
    townsBySlug = new Map();
    for (const town of getAllTowns()) {
      const key = getTownSlug(town.name);
      // First mapping wins — matches getTownsByCountySlug()/getFirstZipcodeForTown(),
      // which also keep the first zipcode for multi-zip towns.
      if (!townsBySlug.has(key)) {
        townsBySlug.set(key, { name: town.name, zipcode: town.zipcode, county: town.county });
      }
    }
  }
  return townsBySlug.get(slug) ?? null;
}

function findZip(zipcode: string): ZipData | null {
  return allZipcodes.find((z) => z.zipcode === zipcode) ?? null;
}

function findCounty(countySlug: string): CountyRecord | null {
  return allCounties.find((c) => c.slug === countySlug) ?? null;
}

/** Build a county-scoped location from a county slug. */
function countyLocation(countySlug: string): PageLocation | null {
  const countyName = getCountyNameFromSlug(countySlug);
  if (!countyName) return null;

  const record = findCounty(countySlug);
  return {
    scope: 'county',
    label: countyName,
    county: countyName,
    countySlug,
    medianPrice: record?.median_sale_price ?? null,
    priceYoY: record?.median_sale_price_yoy ?? null,
    medianDom: record?.median_dom ?? null,
    marketType: record?.market_type ?? null,
  };
}

/** Build a town-scoped location, falling back to its county when the zip has no market data. */
function townLocation(
  town: { name: string; zipcode: string; county: string },
  countySlug: string
): PageLocation {
  const zip = findZip(town.zipcode);
  return {
    scope: 'town',
    label: town.name,
    town: town.name,
    townSlug: getTownSlug(town.name),
    zipcode: town.zipcode,
    county: town.county,
    countySlug,
    medianPrice: zip?.median_sale_price ?? null,
    priceYoY: zip?.median_sale_price_yoy ?? null,
    medianDom: zip?.median_dom ?? null,
    marketType: zip?.market_type ?? null,
  };
}

function slugifyCounty(countyName: string): string {
  return countyName.toLowerCase().replace(/\s+/g, '-');
}

/**
 * Resolve the geographic context of a pathname.
 *
 * Recognised routes:
 *   /market/[county]/[townSlug]/          -> town
 *   /market/[county]/price/[range]/       -> county
 *   /market/[county]/compare/[pair]/      -> county
 *   /market/[county]/                     -> county
 *   /market/[zipcode]/                    -> town (via zip) or zipcode
 *   /home-value/[townSlug]/               -> town
 *   /moving-to/[townSlug]/                -> town
 *
 * Returns null for pages with no geographic context (home, about, tools, contact,
 * and the various index/hub pages).
 */
export function resolveLocationFromPath(pathname: string): PageLocation | null {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return null;

  const [first, second, third] = segments;

  if (first === 'market' && second) {
    // /market/[zipcode]/
    if (/^\d{5}$/.test(second)) {
      // Prefer the named town when the zip maps to one — "Brick" reads better
      // than "08723" in popup copy.
      const named = getTownsByZipcode(second);
      if (named.length > 0) {
        const town = getAllTowns().find(
          (t) => t.name === named[0].name && t.zipcode === second
        );
        if (town) return townLocation(town, slugifyCounty(town.county));
      }

      const zip = findZip(second);
      if (!zip) return null;
      return {
        scope: 'zipcode',
        label: second,
        zipcode: second,
        county: zip.county,
        countySlug: slugifyCounty(zip.county),
        medianPrice: zip.median_sale_price,
        priceYoY: zip.median_sale_price_yoy,
        medianDom: zip.median_dom,
        marketType: zip.market_type,
      };
    }

    // /market/[county]/price/* and /market/[county]/compare/* stay county-scoped:
    // they span many towns, so a single town's stat would misrepresent the page.
    if (third && third !== 'price' && third !== 'compare' && second.endsWith('-county')) {
      // Resolve within the county the URL names, not the global slug index — two
      // counties can carry the same town name, and the URL is authoritative.
      const countyName = getCountyNameFromSlug(second);
      const inCounty = countyName
        ? getTownsByCountySlug(second).find((t) => t.slug === third)
        : null;

      if (inCounty && countyName) {
        return townLocation(
          { name: inCounty.name, zipcode: inCounty.zipcode, county: countyName },
          second
        );
      }
    }

    return countyLocation(second);
  }

  if ((first === 'home-value' || first === 'moving-to') && second) {
    const town = getTownBySlug(second);
    if (town) return townLocation(town, slugifyCounty(town.county));
    return null;
  }

  return null;
}

/**
 * One-line market stat for the resolved location, e.g.
 * "Median $512,000 · +6.2% YoY · 18 days on market".
 *
 * Returns null when no metric is available, so callers can fall back to generic
 * copy rather than rendering an empty stat bar.
 */
export function formatLocationStat(location: PageLocation): string | null {
  const parts: string[] = [];

  if (location.medianPrice !== null) {
    parts.push(`Median ${formatCurrency(location.medianPrice)}`);
  }

  const yoy = formatPercent(location.priceYoY);
  if (yoy !== 'N/A') {
    parts.push(`${yoy} YoY`);
  }

  if (location.medianDom !== null && location.medianDom > 0) {
    parts.push(`${Math.round(location.medianDom)} days on market`);
  }

  return parts.length > 0 ? parts.join(' · ') : null;
}
