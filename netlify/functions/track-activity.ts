/**
 * Track Activity
 *
 * Records an on-site event for a known, consented lead. Exposed as `/api/track`
 * (see netlify.toml) and called via navigator.sendBeacon from
 * src/utils/leadActivity.ts.
 *
 * Preconditions enforced here, not just on the client:
 *   - the request must carry a valid HMAC-signed visitor token, so a caller
 *     cannot write activity against a lead id they guessed;
 *   - the lead must exist and be active.
 *
 * Anonymous visitors have no token and therefore cannot reach this table at all.
 */

import type { Handler, HandlerEvent } from "@netlify/functions";
import { verifyToken } from "./_shared/tokens";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const VALID_EVENTS = new Set(["page_view", "tool_use", "form_start"]);

/**
 * Per-lead throttle. Netlify function instances are short-lived and not shared,
 * so this only catches a runaway loop within one warm instance — it is a
 * cheap-shot backstop, not a security control. The signed token is the control.
 */
const MAX_EVENTS_PER_WINDOW = 30;
const WINDOW_MS = 60_000;
const recentByLead = new Map<string, number[]>();

function isThrottled(leadId: string): boolean {
  const now = Date.now();
  const hits = (recentByLead.get(leadId) ?? []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  recentByLead.set(leadId, hits);

  // Keep the map from growing without bound across a warm instance's lifetime.
  if (recentByLead.size > 500) {
    for (const [key, times] of recentByLead) {
      if (times.every((t) => now - t >= WINDOW_MS)) recentByLead.delete(key);
    }
  }

  return hits.length > MAX_EVENTS_PER_WINDOW;
}

/** sendBeacon can't set headers, so the token travels in the JSON body. */
interface TrackPayload {
  token?: string;
  event?: string;
  path?: string;
  town?: string;
  zipcode?: string;
  county?: string;
  metadata?: Record<string, unknown>;
}

const clip = (value: unknown, max: number): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
};

// Beacons are fire-and-forget; the body is never read by the client.
const ok = () => ({ statusCode: 204, body: "" });

const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("track-activity: Supabase env vars are not configured.");
    return ok();
  }

  let payload: TrackPayload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const leadId = payload.token ? verifyToken("visitor", payload.token) : null;
  if (!leadId) {
    // Unsigned, forged, or absent — drop silently. Never confirm whether a lead
    // id exists, and never fail loudly at a beacon.
    return ok();
  }

  const eventType = payload.event && VALID_EVENTS.has(payload.event) ? payload.event : "page_view";
  const path = clip(payload.path, 500);
  if (!path) return ok();

  if (isThrottled(leadId)) {
    console.warn(`track-activity: throttling lead ${leadId}`);
    return ok();
  }

  const row = {
    lead_id: leadId,
    event_type: eventType,
    path,
    town: clip(payload.town, 100),
    zipcode: clip(payload.zipcode, 10),
    county: clip(payload.county, 100),
    metadata: payload.metadata && typeof payload.metadata === "object" ? payload.metadata : null,
  };

  try {
    // Verify the lead is still active before writing. Someone who unsubscribed
    // should stop generating a behavioural profile, not just stop getting mail.
    const leadResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/leads?id=eq.${leadId}&select=status&limit=1`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );

    const leads = (await leadResponse.json()) as Array<{ status: string }>;
    if (!Array.isArray(leads) || leads.length === 0 || leads[0].status !== "active") {
      return ok();
    }

    const insertResponse = await fetch(`${SUPABASE_URL}/rest/v1/lead_activity`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
    });

    if (!insertResponse.ok) {
      console.error("track-activity insert failed:", await insertResponse.text());
    }
  } catch (error) {
    console.error("track-activity error:", error);
  }

  return ok();
};

export { handler };
