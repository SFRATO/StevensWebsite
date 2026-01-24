/**
 * Generate AI Market Insights
 *
 * Uses Anthropic's Claude API to generate unique market commentary
 * for each county and zip code based on the processed data.
 */

import { readFile, writeFile } from "fs/promises";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";

const PROCESSED_DIR = path.join(process.cwd(), "data", "processed");

interface CountyData {
  region: string;
  slug: string;
  state: string;
  state_code: string;
  period_end: string;
  median_sale_price: number | null;
  median_sale_price_yoy: number | null;
  inventory: number | null;
  inventory_yoy: number | null;
  months_of_supply: number | null;
  median_dom: number | null;
  median_dom_yoy: number | null;
  sold_above_list_pct: number | null;
  price_drops_pct: number | null;
  market_type: string;
  trend_direction: string;
  ai_insight?: string;
}

interface ZipData {
  zipcode: string;
  city: string;
  county: string;
  median_sale_price: number | null;
  median_sale_price_yoy: number | null;
  inventory: number | null;
  months_of_supply: number | null;
  median_dom: number | null;
  sold_above_list_pct: number | null;
  market_type: string;
  trend_direction: string;
  ai_insight?: string;
}

const anthropic = new Anthropic();

function formatCurrency(value: number | null): string {
  if (value === null) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number | null): string {
  if (value === null) return "N/A";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

async function generateCountyInsight(data: CountyData): Promise<string> {
  const prompt = `You are a real estate market analyst writing for homeowners considering selling their property in ${data.region}, New Jersey.

Based on the following market data, write a 2-3 sentence insight that:
1. Highlights the most significant trend for sellers
2. Uses specific numbers from the data
3. Ends with an actionable takeaway

Market Data for ${data.region}, NJ (as of ${data.period_end}):
- Median Sale Price: ${formatCurrency(data.median_sale_price)} (${formatPercent(data.median_sale_price_yoy)} YoY)
- Active Inventory: ${data.inventory ?? "N/A"} homes (${formatPercent(data.inventory_yoy)} YoY)
- Months of Supply: ${data.months_of_supply?.toFixed(1) ?? "N/A"} months
- Median Days on Market: ${data.median_dom ?? "N/A"} days (${formatPercent(data.median_dom_yoy)} YoY)
- Homes Sold Above List: ${data.sold_above_list_pct?.toFixed(0) ?? "N/A"}%
- Price Drops: ${data.price_drops_pct?.toFixed(0) ?? "N/A"}%
- Market Type: ${data.market_type}'s market

Write the insight in second person ("you" language) directed at homeowners. Be specific with numbers but conversational in tone. Do not use quotes or markdown formatting.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 200,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock?.type === "text" ? textBlock.text.trim() : "";
}

async function generateZipInsight(data: ZipData): Promise<string> {
  const locationName = data.city ? `${data.zipcode} (${data.city})` : data.zipcode;

  const prompt = `You are a real estate market analyst writing for homeowners considering selling their property in zip code ${locationName}, ${data.county}, New Jersey.

Based on the following market data, write a 2-sentence insight that:
1. States the key market condition
2. Provides one specific, actionable observation for sellers

Market Data for ${locationName} (most recent data):
- Median Sale Price: ${formatCurrency(data.median_sale_price)} (${formatPercent(data.median_sale_price_yoy)} YoY)
- Active Inventory: ${data.inventory ?? "N/A"} homes
- Months of Supply: ${data.months_of_supply?.toFixed(1) ?? "N/A"} months
- Median Days on Market: ${data.median_dom ?? "N/A"} days
- Homes Sold Above List: ${data.sold_above_list_pct?.toFixed(0) ?? "N/A"}%
- Market Type: ${data.market_type}'s market

Write in second person directed at homeowners. Be concise and specific. Do not use quotes or markdown formatting.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 150,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock?.type === "text" ? textBlock.text.trim() : "";
}

async function main(): Promise<void> {
  console.log("=== Generating AI Market Insights ===\n");

  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Error: ANTHROPIC_API_KEY environment variable is not set");
    process.exit(1);
  }

  // Load processed data
  const countiesRaw = await readFile(
    path.join(PROCESSED_DIR, "counties.json"),
    "utf-8"
  );
  const zipcodesRaw = await readFile(
    path.join(PROCESSED_DIR, "zipcodes.json"),
    "utf-8"
  );

  const counties: CountyData[] = JSON.parse(countiesRaw);
  const zipcodes: ZipData[] = JSON.parse(zipcodesRaw);

  // Generate county insights
  console.log("Generating county insights...");
  for (const county of counties) {
    console.log(`  - ${county.region}`);
    county.ai_insight = await generateCountyInsight(county);
    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Generate zip code insights
  console.log("\nGenerating zip code insights...");
  for (let i = 0; i < zipcodes.length; i++) {
    const zip = zipcodes[i];
    console.log(`  - ${zip.zipcode} (${i + 1}/${zipcodes.length})`);
    zip.ai_insight = await generateZipInsight(zip);
    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Write updated data
  await writeFile(
    path.join(PROCESSED_DIR, "counties.json"),
    JSON.stringify(counties, null, 2)
  );
  console.log("\nWrote updated counties.json");

  await writeFile(
    path.join(PROCESSED_DIR, "zipcodes.json"),
    JSON.stringify(zipcodes, null, 2)
  );
  console.log("Wrote updated zipcodes.json");

  console.log("\n=== Insight Generation Complete ===");
}

main();
