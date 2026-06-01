/**
 * Process Email Queue — Netlify Scheduled Function
 *
 * Runs daily at 10 AM ET and triggers the Supabase send-scheduled-emails
 * edge function to process any pending drip emails.
 */

import type { Config } from "@netlify/functions";

export default async function handler() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[process-email-queue] Missing Supabase credentials — skipping");
    return;
  }

  console.log("[process-email-queue] Triggering send-scheduled-emails edge function...");

  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/send-scheduled-emails`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ triggered_by: "netlify-scheduled" }),
      }
    );

    const body = await response.text();

    if (!response.ok) {
      console.error(
        `[process-email-queue] Edge function returned ${response.status}:`,
        body
      );
      return;
    }

    let result: unknown;
    try {
      result = JSON.parse(body);
    } catch {
      result = body;
    }

    console.log("[process-email-queue] Result:", JSON.stringify(result));
  } catch (error) {
    console.error("[process-email-queue] Failed to call edge function:", error);
  }
}

export const config: Config = {
  schedule: "0 14 * * *", // 10 AM ET (UTC-4 summer) — runs daily
};
