/**
 * Process Behaviour Triggers — Netlify Scheduled Function
 *
 * Runs daily at 11 AM ET, an hour after the drip queue (process-email-queue),
 * so the behaviour engine can see what the drip already sent today and stand
 * down rather than double-mailing the same lead.
 */

import type { Config } from "@netlify/functions";

export default async function handler() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[process-behavior-triggers] Missing Supabase credentials — skipping");
    return;
  }

  console.log("[process-behavior-triggers] Triggering send-behavior-triggers edge function...");

  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/send-behavior-triggers`,
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
        `[process-behavior-triggers] Edge function returned ${response.status}:`,
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

    console.log("[process-behavior-triggers] Result:", JSON.stringify(result));
  } catch (error) {
    console.error("[process-behavior-triggers] Failed to call edge function:", error);
  }
}

export const config: Config = {
  schedule: "0 15 * * *", // 11 AM ET (UTC-4 summer) — one hour after the drip queue
};
