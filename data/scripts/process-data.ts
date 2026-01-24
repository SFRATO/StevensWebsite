/**
 * Process Redfin Market Data for New Jersey
 *
 * Filters raw TSV data to NJ counties (Burlington, Mercer, Middlesex)
 * and their associated zip codes, then outputs as JSON.
 * Uses streaming to handle large files efficiently.
 */

import { createReadStream } from "fs";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { createInterface } from "readline";

const RAW_DIR = path.join(process.cwd(), "data", "raw");
const PROCESSED_DIR = path.join(process.cwd(), "data", "processed");

// Target NJ counties (region names include state suffix)
const TARGET_COUNTIES = new Set([
  "Burlington County, NJ",
  "Mercer County, NJ",
  "Middlesex County, NJ",
]);

// Zip codes for each target county
const COUNTY_ZIPS: Record<string, string[]> = {
  "Burlington County, NJ": [
    "08002", "08004", "08007", "08009", "08010", "08011", "08015", "08016",
    "08019", "08022", "08033", "08036", "08041", "08042", "08043", "08046",
    "08048", "08050", "08052", "08053", "08054", "08055", "08057", "08060",
    "08064", "08065", "08068", "08073", "08075", "08077", "08088", "08505",
    "08518", "08554", "08562", "08640", "08641", "08648",
  ],
  "Mercer County, NJ": [
    "08512", "08514", "08520", "08534", "08540", "08541", "08542", "08543",
    "08544", "08550", "08560", "08601", "08602", "08603", "08604", "08605",
    "08606", "08607", "08608", "08609", "08610", "08611", "08618", "08619",
    "08620", "08625", "08628", "08629", "08638", "08641", "08645", "08646",
    "08647", "08648", "08650", "08666", "08690", "08691",
  ],
  "Middlesex County, NJ": [
    "07001", "07064", "07067", "07077", "07080", "07095", "08512", "08520",
    "08536", "08810", "08812", "08816", "08817", "08818", "08820", "08824",
    "08828", "08830", "08831", "08832", "08837", "08840", "08846", "08850",
    "08852", "08854", "08855", "08857", "08859", "08861", "08862", "08863",
    "08871", "08872", "08873", "08875", "08876", "08879", "08882", "08884",
    "08899", "08901", "08902", "08903", "08904", "08905", "08906",
  ],
};

// All target zip codes flattened (with "Zip Code: " prefix for matching)
const ALL_TARGET_ZIPS = new Set(
  Object.values(COUNTY_ZIPS)
    .flat()
    .map((zip) => `Zip Code: ${zip}`)
);

export interface ProcessedCountyData {
  region: string;
  slug: string;
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
  sold_above_list_yoy: number | null;
  price_drops_pct: number | null;
  price_drops_yoy: number | null;
  market_type: "seller" | "buyer" | "balanced";
  trend_direction: "up" | "down" | "stable";
  ai_insight?: string;
}

export interface ProcessedZipData {
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
  market_type: "seller" | "buyer" | "balanced";
  trend_direction: "up" | "down" | "stable";
  nearby_zips: string[];
  ai_insight?: string;
}

function parseNumber(value: string): number | null {
  if (!value || value === "" || value === "NA") return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

function parsePercent(value: string): number | null {
  if (!value || value === "" || value === "NA") return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num * 100;
}

function determineMarketType(
  monthsOfSupply: number | null
): "seller" | "buyer" | "balanced" {
  if (monthsOfSupply === null) return "balanced";
  if (monthsOfSupply < 4) return "seller";
  if (monthsOfSupply > 6) return "buyer";
  return "balanced";
}

function determineTrendDirection(
  priceYoY: number | null
): "up" | "down" | "stable" {
  if (priceYoY === null) return "stable";
  if (priceYoY > 2) return "up";
  if (priceYoY < -2) return "down";
  return "stable";
}

function createSlug(countyName: string): string {
  return countyName
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function extractZipCode(region: string): string {
  // Extract zip from "Zip Code: 08054" format
  const match = region.match(/Zip Code: (\d+)/);
  return match ? match[1] : region;
}

function findCountyForZip(zipcode: string): string | null {
  const cleanZip = extractZipCode(zipcode);
  for (const [county, zips] of Object.entries(COUNTY_ZIPS)) {
    if (zips.includes(cleanZip)) {
      return county;
    }
  }
  return null;
}

function findNearbyZips(zipcode: string, allZips: string[]): string[] {
  const zipNum = parseInt(zipcode);
  return allZips
    .filter((z) => {
      if (z === zipcode) return false;
      const diff = Math.abs(parseInt(z) - zipNum);
      return diff <= 10;
    })
    .slice(0, 4);
}

function stripQuotes(value: string): string {
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  return value;
}

function normalizeHeader(header: string): string {
  return stripQuotes(header).toLowerCase();
}

async function processCountyData(): Promise<ProcessedCountyData[]> {
  console.log("Processing county data (streaming)...");

  const filePath = path.join(RAW_DIR, "county_market_tracker.tsv");
  const fileStream = createReadStream(filePath);
  const rl = createInterface({ input: fileStream, crlfDelay: Infinity });

  let headers: string[] = [];
  let lineCount = 0;
  const countyMap = new Map<string, Record<string, string>>();

  for await (const line of rl) {
    if (lineCount === 0) {
      headers = line.split("\t").map(normalizeHeader);
      lineCount++;
      continue;
    }

    const values = line.split("\t").map(stripQuotes);
    const record: Record<string, string> = {};
    headers.forEach((header, i) => {
      record[header] = values[i] || "";
    });

    // Filter for NJ target counties, All Residential
    if (
      record.state_code === "NJ" &&
      TARGET_COUNTIES.has(record.region) &&
      record.property_type === "All Residential"
    ) {
      const existing = countyMap.get(record.region);
      if (!existing || record.period_end > existing.period_end) {
        countyMap.set(record.region, record);
      }
    }

    lineCount++;
    if (lineCount % 500000 === 0) {
      console.log(`  Processed ${lineCount.toLocaleString()} lines...`);
    }
  }

  console.log(`  Total lines processed: ${lineCount.toLocaleString()}`);

  const processed: ProcessedCountyData[] = [];

  for (const [region, data] of countyMap) {
    const monthsOfSupply = parseNumber(data.months_of_supply);
    const priceYoY = parsePercent(data.median_sale_price_yoy);
    // Clean region name (remove ", NJ" suffix for display)
    const cleanRegion = region.replace(/, NJ$/, "");

    processed.push({
      region: cleanRegion,
      slug: createSlug(cleanRegion),
      state: data.state,
      state_code: data.state_code,
      period_end: data.period_end,
      last_updated: data.last_updated,
      median_sale_price: parseNumber(data.median_sale_price),
      median_sale_price_yoy: priceYoY,
      median_list_price: parseNumber(data.median_list_price),
      median_list_price_yoy: parsePercent(data.median_list_price_yoy),
      inventory: parseNumber(data.inventory),
      inventory_yoy: parsePercent(data.inventory_yoy),
      months_of_supply: monthsOfSupply,
      months_of_supply_yoy: parsePercent(data.months_of_supply_yoy),
      median_dom: parseNumber(data.median_dom),
      median_dom_yoy: parsePercent(data.median_dom_yoy),
      homes_sold: parseNumber(data.homes_sold),
      homes_sold_yoy: parsePercent(data.homes_sold_yoy),
      sold_above_list_pct: parsePercent(data.sold_above_list),
      sold_above_list_yoy: parsePercent(data.sold_above_list_yoy),
      price_drops_pct: parsePercent(data.price_drops),
      price_drops_yoy: parsePercent(data.price_drops_yoy),
      market_type: determineMarketType(monthsOfSupply),
      trend_direction: determineTrendDirection(priceYoY),
    });
  }

  console.log(`  Found ${processed.length} counties`);
  return processed;
}

async function processZipData(): Promise<ProcessedZipData[]> {
  console.log("Processing zip code data (streaming)...");

  const filePath = path.join(RAW_DIR, "zip_code_market_tracker.tsv");
  const fileStream = createReadStream(filePath);
  const rl = createInterface({ input: fileStream, crlfDelay: Infinity });

  let headers: string[] = [];
  let lineCount = 0;
  const zipMap = new Map<string, Record<string, string>>();

  for await (const line of rl) {
    if (lineCount === 0) {
      headers = line.split("\t").map(normalizeHeader);
      lineCount++;
      continue;
    }

    const values = line.split("\t").map(stripQuotes);
    const record: Record<string, string> = {};
    headers.forEach((header, i) => {
      record[header] = values[i] || "";
    });

    // Filter for NJ target zips, All Residential
    if (
      record.state_code === "NJ" &&
      ALL_TARGET_ZIPS.has(record.region) &&
      record.property_type === "All Residential"
    ) {
      const existing = zipMap.get(record.region);
      if (!existing || record.period_end > existing.period_end) {
        zipMap.set(record.region, record);
      }
    }

    lineCount++;
    if (lineCount % 1000000 === 0) {
      console.log(`  Processed ${lineCount.toLocaleString()} lines...`);
    }
  }

  console.log(`  Total lines processed: ${lineCount.toLocaleString()}`);

  // Extract clean zip codes for nearby zip calculation
  const allCleanZipCodes = Array.from(zipMap.keys()).map(extractZipCode);
  const processed: ProcessedZipData[] = [];

  for (const [regionKey, data] of zipMap) {
    const cleanZipcode = extractZipCode(regionKey);
    const monthsOfSupply = parseNumber(data.months_of_supply);
    const priceYoY = parsePercent(data.median_sale_price_yoy);
    const county = findCountyForZip(cleanZipcode);

    if (!county) continue;

    // Clean county name (remove ", NJ" suffix for display)
    const cleanCounty = county.replace(/, NJ$/, "");

    processed.push({
      zipcode: cleanZipcode,
      region: cleanZipcode,
      city: data.city || "",
      county: cleanCounty,
      state: data.state,
      state_code: data.state_code,
      period_end: data.period_end,
      last_updated: data.last_updated,
      median_sale_price: parseNumber(data.median_sale_price),
      median_sale_price_yoy: priceYoY,
      median_list_price: parseNumber(data.median_list_price),
      median_list_price_yoy: parsePercent(data.median_list_price_yoy),
      inventory: parseNumber(data.inventory),
      inventory_yoy: parsePercent(data.inventory_yoy),
      months_of_supply: monthsOfSupply,
      months_of_supply_yoy: parsePercent(data.months_of_supply_yoy),
      median_dom: parseNumber(data.median_dom),
      median_dom_yoy: parsePercent(data.median_dom_yoy),
      homes_sold: parseNumber(data.homes_sold),
      homes_sold_yoy: parsePercent(data.homes_sold_yoy),
      sold_above_list_pct: parsePercent(data.sold_above_list),
      price_drops_pct: parsePercent(data.price_drops),
      market_type: determineMarketType(monthsOfSupply),
      trend_direction: determineTrendDirection(priceYoY),
      nearby_zips: findNearbyZips(cleanZipcode, allCleanZipCodes),
    });
  }

  console.log(`  Found ${processed.length} zip codes`);
  return processed;
}

async function ensureDirectory(dir: string): Promise<void> {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
}

async function main(): Promise<void> {
  console.log("=== Processing NJ Market Data ===\n");

  await ensureDirectory(PROCESSED_DIR);

  const counties = await processCountyData();
  const zipcodes = await processZipData();

  // Write processed data
  await writeFile(
    path.join(PROCESSED_DIR, "counties.json"),
    JSON.stringify(counties, null, 2)
  );
  console.log(`\nWrote counties.json`);

  await writeFile(
    path.join(PROCESSED_DIR, "zipcodes.json"),
    JSON.stringify(zipcodes, null, 2)
  );
  console.log(`Wrote zipcodes.json`);

  console.log("\n=== Processing Complete ===");
  console.log(`Counties: ${counties.length}`);
  console.log(`Zip codes: ${zipcodes.length}`);
}

main();
