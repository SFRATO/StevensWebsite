/**
 * /api/town-matcher — public endpoint for the South Jersey Town Matcher.
 *
 * Same split as the seller funnel: Netlify has no AWS credentials (verified —
 * `netlify env:list` returns zero AWS_* vars), so this function cannot send
 * email. It is the untrusted-input half — honeypot, rate limit, validation,
 * email checking — and the send + persistence happen in the send-town-matcher
 * edge function, where SES lives.
 *
 * ORDERING NOTE. Unlike cash-offer-lead.ts, a non-2xx from downstream here means
 * "the lead was NOT stored". The page relies on that: it keeps every answer on
 * screen and lets the visitor retry rather than showing a success card for a
 * lead that does not exist.
 */
import type { Handler } from "@netlify/functions";
import { checkEmail } from "./_shared/emailCheck";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// --- rate limiting ---------------------------------------------------------
// Same shape and same honest caveat as cash-offer-lead.ts: function instances
// are short-lived and not shared, so this catches a runaway loop or a crude
// script hitting one warm instance. The honeypot and server-side validation are
// the real defence.
const RATE = new Map<string, number[]>();
const MAX_PER_WINDOW = 5;
const WINDOW_MS = 60_000;

function rateLimited(key: string): boolean {
  const now = Date.now();
  const hits = (RATE.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  // Record only when allowed through. Counting rejected attempts rolls the
  // window forward on every retry, so someone double-tapping submit could
  // never recover.
  if (hits.length >= MAX_PER_WINDOW) {
    RATE.set(key, hits);
    return true;
  }
  hits.push(now);
  RATE.set(key, hits);
  if (RATE.size > 500) {
    for (const k of RATE.keys()) {
      RATE.delete(k);
      break;
    }
  }
  return false;
}

const BUDGETS = new Set([
  "under-350k", "350-400k", "400-450k", "450-500k", "500-600k", "600-750k", "750k-plus",
]);
const BEDROOMS = new Set(["1", "2", "3", "4", "5-plus"]);
const PROPERTY_TYPES = new Set(["detached", "townhouse", "condo", "open"]);
const TIMELINES = new Set(["0-3-months", "3-6-months", "6-12-months", "over-a-year", "researching"]);
const RENT_OWN = new Set(["rent", "own"]);
const YES_NO = new Set(["yes", "no"]);
const COMMUTE_FREQUENCY = new Set(["5-days", "3-4-days", "1-2-days", "rarely"]);

/** Place and property attributes only — see the Fair Housing note in 015. */
const PRIORITIES = new Set([
  "larger-yard", "more-square-footage", "walkable-downtown", "restaurants",
  "easy-commuting", "public-transportation", "quieter", "affordability",
  "newer-homes", "historic-character", "highway-access", "not-sure",
]);

const digits = (s: string) => s.replace(/\D/g, "");

const handler: Handler = async (event) => {
  const json = (status: number, body: unknown) => ({
    statusCode: status,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });
  if (!event.body) return json(400, { error: "Missing form data" });

  try {
    const params = new URLSearchParams(event.body);
    const get = (k: string) => (params.get(k) ?? "").trim();

    // Honeypot first — before rate limiting or any downstream call. Returns a
    // success-shaped 200 so bots believe they succeeded and do not retry.
    if (get("bot-field")) return json(200, { success: true });

    const ip =
      event.headers["x-nf-client-connection-ip"] ||
      event.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      "unknown";
    if (rateLimited(ip)) {
      return json(429, { error: "Too many submissions. Please wait a moment and try again." });
    }

    const a = {
      budget: get("budget"),
      bedrooms: get("bedrooms"),
      property_type: get("property_type"),
      current_town: get("current_town"),
      current_state: get("current_state"),
      commute_matters: get("commute_matters"),
      commute_destination: get("commute_destination"),
      commute_frequency: get("commute_frequency"),
      priorities: params.getAll("priorities").map((s) => s.trim()).filter(Boolean),
      timeline: get("timeline"),
      rent_or_own: get("rent_or_own"),
      needs_to_sell: get("needs_to_sell"),
      first_name: get("first_name"),
      last_name: get("last_name"),
      email: get("email"),
      phone: get("phone"),
    };

    // --- validation --------------------------------------------------------
    const bad = (error: string, field?: string) => json(400, { error, field });

    if (!BUDGETS.has(a.budget)) return bad("Please choose a budget range.", "budget");
    if (!BEDROOMS.has(a.bedrooms)) return bad("Please choose how many bedrooms you need.", "bedrooms");
    if (!PROPERTY_TYPES.has(a.property_type)) return bad("Please choose a property type.", "property_type");

    if (a.current_town.length < 2) return bad("Please tell me the town or city you live in now.", "current_town");
    if (a.current_state.length < 2) return bad("Please tell me your state.", "current_state");

    if (!YES_NO.has(a.commute_matters)) return bad("Please let me know whether commuting matters.", "commute_matters");
    if (a.commute_matters === "yes") {
      if (a.commute_destination.length < 2) {
        return bad("Where do you need to commute to?", "commute_destination");
      }
      if (!COMMUTE_FREQUENCY.has(a.commute_frequency)) {
        return bad("How often would you make that commute?", "commute_frequency");
      }
    } else {
      // Do not carry stale answers from a "yes" the visitor changed their mind about.
      a.commute_destination = "";
      a.commute_frequency = "";
    }

    a.priorities = a.priorities.filter((p) => PRIORITIES.has(p));
    if (!a.priorities.length) return bad("Please choose at least one thing that matters to you.", "priorities");

    if (!TIMELINES.has(a.timeline)) return bad("Please choose a timeline.", "timeline");
    if (!RENT_OWN.has(a.rent_or_own)) return bad("Please let me know if you rent or own.", "rent_or_own");
    if (a.rent_or_own === "own") {
      if (!YES_NO.has(a.needs_to_sell)) {
        return bad("Would you need to sell before buying?", "needs_to_sell");
      }
    } else {
      a.needs_to_sell = "";
    }

    if (a.first_name.length < 1) return bad("Please enter your first name.", "first_name");
    if (a.last_name.length < 1) return bad("Please enter your last name.", "last_name");

    if (get("consent") !== "1") {
      return bad("Please agree to be contacted so I can send you your matches.");
    }

    const d = digits(a.phone);
    if (!(d.length === 10 || (d.length === 11 && d[0] === "1"))) {
      return bad("Please enter a valid 10-digit phone number.", "phone");
    }

    // Shared checker: syntax, typo suggestion, disposable domains, MX.
    // Fails open on DNS trouble by design.
    const emailCheck = await checkEmail(a.email, {
      allowOverride: get("email-confirmed") === "1",
    });
    if (!emailCheck.ok) {
      return json(400, {
        error: emailCheck.message,
        field: "email",
        code: emailCheck.code,
        suggestion: emailCheck.suggestion,
      });
    }
    a.email = emailCheck.normalized;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("town-matcher: Supabase not configured — cannot store lead");
      return json(502, { error: "We weren't able to submit your information. Please try again." });
    }

    const payload = {
      ...a,
      source: {
        landing_url: get("landing_url"),
        referrer: get("referrer") || event.headers.referer || "",
        user_agent: (event.headers["user-agent"] || "").slice(0, 200),
        utm_source: get("utm_source"),
        utm_medium: get("utm_medium"),
        utm_campaign: get("utm_campaign"),
        utm_content: get("utm_content"),
        utm_term: get("utm_term"),
        fbclid: get("fbclid"),
      },
    };

    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-town-matcher`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      // A non-2xx here means the lead was NOT stored. Never report success —
      // the page keeps the visitor's answers and lets them retry.
      const detail = await res.text().catch(() => "");
      console.error(`town-matcher: send-town-matcher returned ${res.status}`, detail.slice(0, 300));
      return json(502, { error: "We weren't able to submit your information. Please try again." });
    }

    const result = (await res.json().catch(() => ({}))) as {
      notified?: boolean;
      confirmationSent?: boolean;
    };
    console.log("town-matcher stored:", {
      to: a.email,
      notified: result.notified === true,
      confirmationSent: result.confirmationSent === true,
    });

    return json(200, { success: true });
  } catch (err) {
    console.error("town-matcher handler failed:", err);
    return json(500, { error: "We weren't able to submit your information. Please try again." });
  }
};

export { handler };
