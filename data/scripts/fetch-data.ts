/**
 * Fetch Market Data from Redfin Data Center
 *
 * Downloads weekly market tracker TSV files for county and zip code levels.
 * Source: https://www.redfin.com/news/data-center/
 */

import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data", "raw");

// Redfin Data Center URLs
const REDFIN_URLS = {
  county:
    "https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_market_tracker/county_market_tracker.tsv000.gz",
  zipcode:
    "https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_market_tracker/zip_code_market_tracker.tsv000.gz",
};

async function ensureDirectory(dir: string): Promise<void> {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
}

async function fetchAndDecompress(
  url: string,
  filename: string
): Promise<void> {
  console.log(`Fetching ${filename}...`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();

  // Decompress gzip data
  const { gunzipSync } = await import("zlib");
  const decompressed = gunzipSync(Buffer.from(buffer));

  const outputPath = path.join(DATA_DIR, filename);
  await writeFile(outputPath, decompressed);

  console.log(`Saved ${filename} (${(decompressed.length / 1024 / 1024).toFixed(2)} MB)`);
}

async function main(): Promise<void> {
  console.log("=== Redfin Market Data Fetch ===\n");

  await ensureDirectory(DATA_DIR);

  try {
    // Fetch county data
    await fetchAndDecompress(
      REDFIN_URLS.county,
      "county_market_tracker.tsv"
    );

    // Fetch zip code data
    await fetchAndDecompress(
      REDFIN_URLS.zipcode,
      "zip_code_market_tracker.tsv"
    );

    console.log("\n=== Fetch Complete ===");
  } catch (error) {
    console.error("Error fetching data:", error);
    process.exit(1);
  }
}

main();
