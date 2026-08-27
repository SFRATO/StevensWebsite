/**
 * send-seller-lead — the /cash-offer funnel's lead sink.
 *
 * WHY THIS EXISTS AS AN EDGE FUNCTION AND NOT A NETLIFY FUNCTION:
 * Netlify has no AWS credentials. `netlify env:list` returns zero AWS_* vars, so
 * the SES client in netlify/functions/trigger-email-sequence.ts would throw at
 * runtime — that path is dead today. The SES credentials live only in Supabase
 * secrets, so anything that sends mail has to run here. The public endpoint is
 * netlify/functions/cash-offer-lead.ts, which validates and then calls this with
 * the service-role key, exactly as handle-market-report.ts calls
 * handle-form-submission.
 *
 * This function does two things: email Steven, and persist the lead. The email is
 * the one that matters — if SES fails we return non-2xx so the browser shows a
 * real error and does NOT fire the Meta Lead event. Reporting success for a lead
 * nobody was told about is the failure mode worth engineering against.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SESClient, SendEmailCommand } from "npm:@aws-sdk/client-ses";
import { EMAIL as AGENT_EMAIL_DEFAULT } from "../_shared/contact.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const AWS_ACCESS_KEY_ID = Deno.env.get("AWS_ACCESS_KEY_ID")!;
const AWS_SECRET_ACCESS_KEY = Deno.env.get("AWS_SECRET_ACCESS_KEY")!;
const AWS_REGION = Deno.env.get("AWS_REGION") || "us-east-1";
const SES_SENDER_EMAIL = Deno.env.get("SES_SENDER_EMAIL") || "reports@stevenfrato.com";
const SES_CONFIGURATION_SET = Deno.env.get("SES_CONFIGURATION_SET") || "steven-frato-emails";

/** Same resolution chain as handle-form-submission, so both alert the same inbox. */
const AGENT_NOTIFY_EMAILS: string[] = (() => {
  const ADDR = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const raw = Deno.env.get("AGENT_NOTIFY_EMAIL") ?? AGENT_EMAIL_DEFAULT;
  const all = raw.split(",").map((a) => a.trim()).filter(Boolean).slice(0, 10);
  const good = all.filter((a) => ADDR.test(a));
  if (good.length !== all.length) console.error("AGENT_NOTIFY_EMAIL has invalid entries");
  return good.length ? good : [AGENT_EMAIL_DEFAULT];
})();

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const ses = new SESClient({
  region: AWS_REGION,
  credentials: { accessKeyId: AWS_ACCESS_KEY_ID, secretAccessKey: AWS_SECRET_ACCESS_KEY },
});

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Qualified only. Anything else is rejected before an email exists. */
type LeadStatus = "qualified";

interface Payload {
  address: string;
  property_type: string;
  authorized_owner: string;
  timeline: string;
  condition: string;
  reason_for_selling: string;
  reason_other?: string;
  currently_listed: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  lead_status: LeadStatus;
  source: {
    landing_url?: string;
    referrer?: string;
    user_agent?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    utm_term?: string;
    fbclid?: string;
  };
}

/** Everything here lands in an HTML email; angle brackets must not survive. */
const clean = (v: unknown, max = 200): string =>
  String(v ?? "")
    .replace(/[<>]/g, "")
    .replace(/[\r\n\t]+/g, " ")
    .trim()
    .slice(0, max);

const LABELS: Record<string, string> = {
  "single-family": "Single-Family Home",
  townhouse: "Townhouse",
  "mobile-home": "Mobile Home",
  commercial: "Commercial Property",
  other: "Other",
  asap: "As soon as possible",
  "1-month": "Within 1 month",
  "1-3-months": "1–3 months",
  "3-6-months": "3–6 months",
  "6-plus-months": "More than 6 months",
  researching: "Just researching options",
  excellent: "Excellent / Recently Updated",
  good: "Good Condition",
  "some-repairs": "Needs Some Repairs or Updating",
  "significant-repairs": "Needs Significant Repairs",
  "fixer-upper": "Major Fixer-Upper",
  relocating: "Relocating",
  downsizing: "Downsizing",
  inherited: "Inherited Property",
  financial: "Financial Reasons",
  landlord: "Tired of Being a Landlord",
  divorce: "Divorce / Separation",
  "sell-quickly": "Need to Sell Quickly",
  "buying-another": "Buying Another Home",
  yes: "Yes",
  no: "No",
};
const label = (v: string) => LABELS[v] ?? clean(v);

function buildEmail(p: Payload) {
  const submittedAt = new Date().toLocaleString("en-US", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/New_York",
  });

  const statusLabel = "Qualified";
  const reason =
    p.reason_for_selling === "other" && p.reason_other
      ? `Other — ${clean(p.reason_other, 300)}`
      : label(p.reason_for_selling);

  const rows: Array<[string, string]> = [
    ["Lead Status", statusLabel],
    ["Property Address", clean(p.address, 250)],
    ["Property Type", label(p.property_type)],
    ["Authorized Owner", label(p.authorized_owner)],
    ["Selling Timeline", label(p.timeline)],
    ["Property Condition", label(p.condition)],
    ["Reason for Selling", reason],
    ["Currently Listed", label(p.currently_listed)],
    ["Name", `${clean(p.first_name, 80)} ${clean(p.last_name, 80)}`.trim()],
    ["Email", clean(p.email, 160)],
    ["Phone", clean(p.phone, 30)],
  ];

  const s = p.source ?? {};
  const sourceRows: Array<[string, string]> = [
    ["Landing Page", clean(s.landing_url, 300)],
    ["Submitted", submittedAt],
    ["UTM Source", clean(s.utm_source, 150)],
    ["UTM Medium", clean(s.utm_medium, 150)],
    ["UTM Campaign", clean(s.utm_campaign, 150)],
    ["UTM Content", clean(s.utm_content, 150)],
    ["UTM Term", clean(s.utm_term, 150)],
    ["Facebook Click ID", clean(s.fbclid, 255)],
    ["Referrer", clean(s.referrer, 300)],
    ["Browser / Device", clean(s.user_agent, 200)],
  ].filter(([, v]) => v !== "");

  const tr = (k: string, v: string, strong = false) => `
    <tr>
      <td style="padding:7px 12px 7px 0;color:#5D6B80;font-size:13px;white-space:nowrap;vertical-align:top;">${k}</td>
      <td style="padding:7px 0;color:#17202A;font-size:15px;${strong ? "font-weight:700;" : ""}">${v || "—"}</td>
    </tr>`;

  const html = `<!doctype html><html><body style="margin:0;background:#F7F8FA;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:24px 16px;">
    <div style="background:#0F2742;color:#fff;padding:18px 22px;border-radius:10px 10px 0 0;">
      <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;opacity:.75;">New Seller Lead</div>
      <div style="font-size:20px;font-weight:700;margin-top:4px;">${clean(p.address, 250)}</div>
      <div style="font-size:13px;margin-top:6px;opacity:.85;">${statusLabel}</div>
    </div>
    <div style="background:#fff;border:1px solid #DDE3EC;border-top:0;border-radius:0 0 10px 10px;padding:20px 22px;">
      <table style="width:100%;border-collapse:collapse;">
        ${rows.map(([k, v], i) => tr(k, v, i === 0)).join("")}
      </table>
      <div style="margin-top:22px;padding-top:16px;border-top:1px solid #DDE3EC;">
        <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#5D6B80;margin-bottom:8px;">Source Information</div>
        <table style="width:100%;border-collapse:collapse;">
          ${sourceRows.map(([k, v]) => tr(k, v)).join("")}
        </table>
      </div>
    </div>
    <p style="color:#5D6B80;font-size:12px;text-align:center;margin-top:16px;">
      Submitted through the /cash-offer landing page.
    </p>
  </div></body></html>`;

  const text = [
    "NEW SELLER LEAD",
    "",
    ...rows.map(([k, v]) => `${k}: ${v || "—"}`),
    "",
    "SOURCE INFORMATION",
    ...sourceRows.map(([k, v]) => `${k}: ${v}`),
  ].join("\n");

  // The address is the one thing that makes a lead actionable at a glance.
  const subject = `NEW QUALIFIED SELLER LEAD — ${clean(p.address, 120)}`;

  return { subject, html, text };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const payload = (await req.json()) as Payload;

    if (!payload?.email || !payload?.address || !payload?.lead_status) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // This function's ONLY output is a "NEW QUALIFIED SELLER LEAD" email. Refuse
    // anything else outright rather than emailing it with a softer subject: a
    // disqualified submission must be structurally incapable of producing a
    // message that could be mistaken for a real lead in the inbox. The caller
    // already stops before reaching here, so this is defence in depth.
    if (payload.lead_status !== "qualified") {
      console.error("send-seller-lead refused a non-qualified payload:", payload.lead_status);
      return new Response(JSON.stringify({ error: "Not a qualified lead" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { subject, html, text } = buildEmail(payload);

    // Send FIRST, persist second. If SES fails we must not report success — the
    // caller uses a non-2xx to suppress the Meta Lead event and show the visitor
    // a real error. No try/catch here: the outer catch owns it.
    const sent = await ses.send(
      new SendEmailCommand({
        Source: `Seller Leads <${SES_SENDER_EMAIL}>`,
        Destination: { ToAddresses: AGENT_NOTIFY_EMAILS },
        ReplyToAddresses: [payload.email],
        Message: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: {
            Html: { Data: html, Charset: "UTF-8" },
            Text: { Data: text, Charset: "UTF-8" },
          },
        },
        ConfigurationSetName: SES_CONFIGURATION_SET,
      }),
    );

    // Persistence is best-effort and deliberately AFTER the send. leads.email is
    // UNIQUE, so a repeat submitter is an update, not a duplicate row — and a
    // conflict must never turn a delivered lead into a visitor-facing error.
    const s = payload.source ?? {};
    const row = {
      email: payload.email.toLowerCase().trim(),
      name: `${clean(payload.first_name, 80)} ${clean(payload.last_name, 80)}`.trim() || "Seller",
      phone: clean(payload.phone, 20),
      address: clean(payload.address, 250),
      interest_type: "selling",
      submission_type: "cash-offer",
      timeline: clean(payload.timeline, 50),
      property_type: clean(payload.property_type, 50),
      source_url: clean(s.landing_url, 500),
      utm_source: clean(s.utm_source, 100) || null,
      utm_medium: clean(s.utm_medium, 100) || null,
      utm_campaign: clean(s.utm_campaign, 100) || null,
      utm_content: clean(s.utm_content, 150) || null,
      utm_term: clean(s.utm_term, 150) || null,
      fbclid: clean(s.fbclid, 255) || null,
      agent_notified_at: new Date().toISOString(),
      seller_funnel: {
        street_address: (payload as Record<string, unknown>).street_address ?? null,
        city: (payload as Record<string, unknown>).city ?? null,
        zip: (payload as Record<string, unknown>).zip ?? null,
        property_type: payload.property_type,
        authorized_owner: payload.authorized_owner,
        timeline: payload.timeline,
        condition: payload.condition,
        // See the FAIR HOUSING note on this column in migration 011.
        reason_for_selling: payload.reason_for_selling,
        reason_other: payload.reason_other ?? null,
        currently_listed: payload.currently_listed,
        lead_status: payload.lead_status,
      },
    };

    let persisted = false;
    try {
      const { error } = await supabase
        .from("leads")
        .upsert(row, { onConflict: "email" });
      if (error) console.error("seller lead upsert failed:", error.message);
      else persisted = true;
    } catch (dbErr) {
      console.error("seller lead upsert threw:", dbErr);
    }

    console.log(
      `seller lead emailed (ses ${sent.MessageId}) status=${payload.lead_status} persisted=${persisted}`,
    );

    return new Response(JSON.stringify({ success: true, persisted }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    // Log the real reason server-side; the visitor gets a generic message.
    console.error("send-seller-lead failed:", err);
    return new Response(JSON.stringify({ error: "Could not deliver the lead" }), {
      status: 502,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
