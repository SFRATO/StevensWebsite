/**
 * Sync Zipcode Data to Supabase
 *
 * One-time (and post-data-refresh) function that upserts all 97 NJ zip records
 * from data/processed/zipcodes.json into the Supabase zipcode_data table.
 *
 * Usage (run once after deployment or after npm run data:all):
 *   curl -X POST https://stevenfrato.com/.netlify/functions/sync-zipcode-data \
 *        -H "X-Sync-Secret: $SYNC_SECRET"
 */

import type { Handler, HandlerEvent } from "@netlify/functions";
import zipcodesData from "../../data/processed/zipcodes.json";
import { serviceAreas } from "../../src/data/town-mappings";

// Build a reverse map: zipcode → first town name that maps to it
function buildZipToTownMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const towns of Object.values(serviceAreas)) {
    for (const { name, zipcode } of towns) {
      if (!map[zipcode]) {
        map[zipcode] = name;
      }
    }
  }
  return map;
}

interface ZipRecord {
  zipcode: string;
  city: string;
  county: string;
  state: string;
  period_end: string | null;
  median_sale_price: number | null;
  median_sale_price_yoy: number | null;
  median_list_price: number | null;
  inventory: number | null;
  inventory_yoy: number | null;
  months_of_supply: number | null;
  median_dom: number | null;
  median_dom_yoy: number | null;
  homes_sold: number | null;
  homes_sold_yoy: number | null;
  sold_above_list_pct: number | null;
  market_type: "seller" | "buyer" | "balanced";
  trend_direction: string;
  ai_insight?: string;
  nearby_zips: string[];
}

const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  // Secret header gate
  const secret = event.headers["x-sync-secret"];
  const expectedSecret = process.env.SYNC_SECRET;
  if (!expectedSecret || secret !== expectedSecret) {
    return { statusCode: 403, body: JSON.stringify({ error: "Forbidden" }) };
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Supabase credentials not configured" }),
    };
  }

  const zipToTown = buildZipToTownMap();
  const records = (zipcodesData as ZipRecord[]).map((zip) => ({
    zipcode: zip.zipcode,
    town: zipToTown[zip.zipcode] || zip.city || null,
    county: zip.county,
    state: zip.state,
    median_sale_price: zip.median_sale_price,
    median_sale_price_yoy: zip.median_sale_price_yoy,
    median_list_price: zip.median_list_price,
    inventory: zip.inventory,
    inventory_yoy: zip.inventory_yoy,
    months_of_supply: zip.months_of_supply,
    median_dom: zip.median_dom,
    median_dom_yoy: zip.median_dom_yoy,
    homes_sold: zip.homes_sold,
    homes_sold_yoy: zip.homes_sold_yoy,
    sold_above_list_pct: zip.sold_above_list_pct,
    market_type: zip.market_type,
    trend_direction: zip.trend_direction,
    ai_insight: zip.ai_insight || null,
    nearby_zips: zip.nearby_zips,
    period_end: zip.period_end,
    last_updated: new Date().toISOString(),
  }));

  // Upsert in batches of 20 to avoid payload limits
  const BATCH_SIZE = 20;
  let upserted = 0;
  const errors: string[] = [];

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/zipcode_data?on_conflict=zipcode`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify(batch),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error(`Batch ${i / BATCH_SIZE + 1} failed:`, err);
      errors.push(err);
    } else {
      upserted += batch.length;
    }
  }

  console.log(`[sync-zipcode-data] Upserted ${upserted}/${records.length} records`);

  return {
    statusCode: errors.length > 0 ? 207 : 200,
    body: JSON.stringify({
      success: errors.length === 0,
      upserted,
      total: records.length,
      errors: errors.length > 0 ? errors : undefined,
    }),
  };
};

export { handler };
