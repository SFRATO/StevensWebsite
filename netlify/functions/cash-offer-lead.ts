/**
 * /api/cash-offer — public endpoint for the seller funnel landing page.
 *
 * Netlify has no AWS credentials (verified: `netlify env:list` returns zero
 * AWS_* vars), so this function cannot send email itself. It is the public,
 * untrusted-input half: honeypot, rate limit, validation, qualification. The
 * send happens in the send-seller-lead edge function, where SES lives.
 *
 * THE QUALIFICATION DECISION IS MADE HERE, NOT IN THE BROWSER. The page computes
 * the same thing for its own UI, but a client can post whatever it likes — and
 * this value decides whether a Meta `Lead` conversion fires. Trusting the client
 * would let anyone train the ad account on junk.
 */
import type { Handler } from "@netlify/functions";
import { checkEmail } from "./_shared/emailCheck";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// --- rate limiting ---------------------------------------------------------
// Same shape as track-activity.ts, and the same honest caveat: Netlify function
// instances are short-lived and not shared, so this catches a runaway loop or a
// crude script hitting one warm instance. It is a cheap backstop, NOT a security
// control — the honeypot and server-side validation are the real defence.
const RATE = new Map<string, number[]>();
const MAX_PER_WINDOW = 5;
const WINDOW_MS = 60_000;

function rateLimited(key: string): boolean {
  const now = Date.now();
  const hits = (RATE.get(key) ?? []).filter((t) => now - t < WINDOW_MS);

  // Record the hit ONLY when it is allowed through. Counting rejected attempts
  // makes the window roll forward on every retry, so anyone who keeps trying —
  // including a legitimate person double-tapping submit — can never recover.
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

// --- qualification ---------------------------------------------------------

type LeadStatus = "qualified" | "in_progress" | "disqualified";
type DisqualificationReason =
  | "unsupported_property_type"
  | "not_authorized_to_sell"
  | "currently_listed"
  | "timeline_over_6_months";

const ALLOWED_PROPERTY_TYPES = new Set(["single-family", "townhouse"]);
const QUALIFIED_TIMELINES = new Set(["asap", "1-month", "1-3-months", "3-6-months"]);
/** 6+ months and "just researching" are disqualifying, not a nurture bucket:
 *  the funnel exists to tell Meta what a real seller looks like. */
const DISQUALIFYING_TIMELINES = new Set(["6-plus-months", "researching"]);

const ZIP_RE = /^\d{5}(-\d{4})?$/;
/** New Jersey is 07000-08999 — the whole state, not just the service area. */
const isNjZip = (z: string) => {
  const n = parseInt(z.slice(0, 5), 10);
  return n >= 7000 && n <= 8999;
};

/**
 * Re-derive the outcome from the raw answers.
 *
 * Order matters: a hard disqualifier outranks the timeline, so someone whose
 * home is already listed is disqualified even if they said "ASAP".
 */
function qualify(a: Record<string, string>): {
  leadStatus: LeadStatus;
  reason?: DisqualificationReason;
} {
  if (!ALLOWED_PROPERTY_TYPES.has(a.property_type)) {
    return { leadStatus: "disqualified", reason: "unsupported_property_type" };
  }
  if (a.authorized_owner !== "yes") {
    return { leadStatus: "disqualified", reason: "not_authorized_to_sell" };
  }
  if (a.currently_listed === "yes") {
    return { leadStatus: "disqualified", reason: "currently_listed" };
  }
  if (DISQUALIFYING_TIMELINES.has(a.timeline) || !QUALIFIED_TIMELINES.has(a.timeline)) {
    return { leadStatus: "disqualified", reason: "timeline_over_6_months" };
  }
  return { leadStatus: "qualified" };
}

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

    // Honeypot first — before rate limiting, DNS, or any downstream call. Returns
    // a SUCCESS-shaped 200 so bots believe they succeeded and do not retry. This
    // is the pattern already used by handle-market-report.
    if (get("bot-field")) {
      return json(200, { success: true });
    }

    const ip =
      event.headers["x-nf-client-connection-ip"] ||
      event.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      "unknown";
    if (rateLimited(ip)) {
      return json(429, { error: "Too many submissions. Please wait a moment and try again." });
    }

    const answers = {
      address: get("address"),
      street_address: get("street_address"),
      city: get("city"),
      zip: get("zip"),
      property_type: get("property_type"),
      authorized_owner: get("authorized_owner"),
      timeline: get("timeline"),
      condition: get("condition"),
      reason_for_selling: get("reason_for_selling"),
      reason_other: get("reason_other"),
      currently_listed: get("currently_listed"),
      first_name: get("first_name"),
      last_name: get("last_name"),
      email: get("email"),
      phone: get("phone"),
    };

    // --- validation --------------------------------------------------------
    const missing = (
      ["street_address", "city", "zip", "property_type", "authorized_owner",
       "timeline", "condition", "reason_for_selling", "currently_listed",
       "first_name", "last_name", "email", "phone"] as const
    ).filter((k) => !answers[k]);
    if (missing.length) {
      return json(400, { error: "Some answers are missing. Please go back and complete the form." });
    }

    // Address is validated again here with the same rules as the client. A
    // browser can post anything, and an address that cannot be located is not a
    // lead worth emailing or paying Meta to find more of.
    const street = answers.street_address;
    if (street.length < 5 || !/\d/.test(street)) {
      return json(400, {
        error: "Please include the street number and name.",
        field: "street_address",
      });
    }
    if (answers.city.length < 2 || !/^[A-Za-z][A-Za-z\s'\-.]*$/.test(answers.city)) {
      return json(400, { error: "Please enter the town or city.", field: "city" });
    }
    if (!ZIP_RE.test(answers.zip)) {
      return json(400, { error: "Please enter a 5-digit ZIP code.", field: "zip" });
    }
    if (!isNjZip(answers.zip)) {
      return json(400, { error: "That ZIP code is outside New Jersey.", field: "zip" });
    }

    // Recompose server-side rather than trusting the hidden field the client
    // built, so the stored address always matches the validated parts.
    answers.address = `${street}, ${answers.city}, NJ ${answers.zip}`;

    if (get("consent") !== "1") {
      return json(400, { error: "Please agree to be contacted so I can follow up about your property." });
    }

    const d = digits(answers.phone);
    if (!(d.length === 10 || (d.length === 11 && d[0] === "1"))) {
      return json(400, { error: "Please enter a valid 10-digit phone number.", field: "phone" });
    }

    // Reuse the shared checker: syntax, typo suggestion, disposable domains, MX.
    // Fails open on DNS trouble by design.
    const emailCheck = await checkEmail(answers.email);
    console.log("cash-offer email check:", {
      ok: emailCheck.ok,
      code: emailCheck.code,
      ...emailCheck.trace,
    });
    if (!emailCheck.ok) {
      return json(400, {
        error: emailCheck.message,
        field: "email",
        code: emailCheck.code,
        suggestion: emailCheck.suggestion,
      });
    }
    answers.email = emailCheck.normalized;

    // --- the authoritative qualification decision --------------------------
    const { leadStatus, reason } = qualify(answers);

    // A disqualified visitor never reaches this endpoint in the normal flow — the
    // page ends their journey at the question that disqualified them. If one gets
    // here anyway (a replayed or hand-crafted POST), accept it politely and send
    // nothing, so no email and no conversion result from it.
    if (leadStatus === "disqualified") {
      console.log("cash-offer submission disqualified server-side:", reason);
      return json(200, { success: true, leadStatus: "disqualified" });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("cash-offer: Supabase not configured — cannot deliver lead");
      return json(502, { error: "We weren't able to submit your information. Please try again." });
    }

    const payload = {
      ...answers,
      lead_status: leadStatus,
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

    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-seller-lead`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      // Never report success for a lead that was not delivered. The page uses a
      // non-2xx to show a real error AND to suppress the Meta Lead event.
      const detail = await res.text().catch(() => "");
      console.error(`cash-offer: send-seller-lead returned ${res.status}`, detail.slice(0, 300));
      return json(502, { error: "We weren't able to submit your information. Please try again." });
    }

    return json(200, { success: true, leadStatus });
  } catch (err) {
    console.error("cash-offer handler failed:", err);
    return json(500, { error: "We weren't able to submit your information. Please try again." });
  }
};

export { handler };
