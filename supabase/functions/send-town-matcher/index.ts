/**
 * send-town-matcher — stores a /town-matcher lead, notifies Steven, confirms
 * to the visitor.
 *
 * ORDER OF OPERATIONS, AND WHY IT IS THE REVERSE OF send-seller-lead
 * ------------------------------------------------------------------
 * The seller funnel emails first and persists second, on the reasoning that
 * "reporting success for a lead nobody was told about is the failure mode worth
 * engineering against." This funnel inverts that deliberately:
 *
 *   1. PERSIST. If the write fails we return non-2xx, send nothing, and the page
 *      keeps every answer so the visitor can retry. Telling someone "you're all
 *      set" when nothing was stored is the failure mode that matters here.
 *   2. NOTIFY Steven, with retry. A failure is written to leads.agent_notify_error
 *      rather than swallowed — a stored-but-unnotified lead is recoverable, a
 *      lost one is not.
 *   3. CONFIRM to the visitor, in its own try/catch, never able to fail the
 *      request.
 *
 * So no lead is lost in either direction.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SESClient, SendEmailCommand } from "npm:@aws-sdk/client-ses";
import { toDisplayName } from "../_shared/textCase.ts";
import {
  AGENT_NAME,
  BROKERAGE_NAME,
  BROKERAGE_DESCRIPTOR,
  LICENSE_NUMBER,
  PHONE,
  EMAIL as AGENT_EMAIL,
} from "../_shared/contact.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const AWS_ACCESS_KEY_ID = Deno.env.get("AWS_ACCESS_KEY_ID")!;
const AWS_SECRET_ACCESS_KEY = Deno.env.get("AWS_SECRET_ACCESS_KEY")!;
const AWS_REGION = Deno.env.get("AWS_REGION") || "us-east-1";
const SES_SENDER_EMAIL = Deno.env.get("SES_SENDER_EMAIL") || "reports@stevenfrato.com";
const SES_CONFIGURATION_SET = Deno.env.get("SES_CONFIGURATION_SET") || "steven-frato-emails";
const SITE_URL = Deno.env.get("SITE_URL") || "https://www.stevenfrato.com";

const AGENT_NOTIFY_EMAILS: string[] = (() => {
  const raw = Deno.env.get("AGENT_NOTIFY_EMAILS") || Deno.env.get("AGENT_NOTIFY_EMAIL") || "";
  const list = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return list.length ? list : [AGENT_EMAIL];
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

interface Payload {
  budget: string; bedrooms: string; property_type: string;
  current_town: string; current_state: string;
  commute_matters: string; commute_destination: string; commute_frequency: string;
  priorities: string[]; timeline: string;
  rent_or_own: string; needs_to_sell: string;
  first_name: string; last_name: string; email: string; phone: string;
  source?: Record<string, string>;
}

// --- display labels --------------------------------------------------------
// The wire values are stable slugs; these are only for the two emails.
const LABEL: Record<string, string> = {
  "under-350k": "Under $350,000", "350-400k": "$350,000 – $400,000",
  "400-450k": "$400,000 – $450,000", "450-500k": "$450,000 – $500,000",
  "500-600k": "$500,000 – $600,000", "600-750k": "$600,000 – $750,000",
  "750k-plus": "$750,000+",
  "5-plus": "5+",
  detached: "Detached single-family", townhouse: "Townhouse", condo: "Condo",
  open: "Open to anything",
  "0-3-months": "Immediately (0–3 months)", "3-6-months": "3–6 months",
  "6-12-months": "6–12 months", "over-a-year": "More than a year",
  researching: "Just researching",
  rent: "Rents", own: "Owns", yes: "Yes", no: "No",
  "5-days": "5 days a week", "3-4-days": "3–4 days a week",
  "1-2-days": "1–2 days a week", rarely: "Rarely",
  "larger-yard": "Larger yard", "more-square-footage": "More square footage",
  "walkable-downtown": "Walkable downtown", restaurants: "Restaurants and things to do",
  "easy-commuting": "Easy commuting", "public-transportation": "Public transportation",
  quieter: "Quieter neighborhood", affordability: "Affordability",
  "newer-homes": "Newer homes", "historic-character": "Historic character",
  "highway-access": "Close to major highways", "not-sure": "Not sure yet",
};
const label = (v: string) => LABEL[v] ?? v;

const esc = (v: unknown) =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// --- agent notification ----------------------------------------------------
function buildNotification(p: Payload, leadId: string) {
  const name = `${toDisplayName(p.first_name)} ${toDisplayName(p.last_name)}`.trim();
  const sells = p.rent_or_own === "own" && p.needs_to_sell === "yes";

  // A "needs to sell" answer turns a buyer lead into a probable listing too, so
  // it goes in the subject rather than being discovered three screens down.
  const subject = sells
    ? `Town Matcher + LISTING LEAD: ${name} — ${label(p.budget)}`
    : `Town Matcher: ${name} — ${label(p.budget)}`;

  const row = (k: string, v: string) =>
    v ? `<tr><td style="padding:5px 14px 5px 0;color:#5D6B80;white-space:nowrap">${esc(k)}</td><td style="padding:5px 0;color:#17202A">${esc(v)}</td></tr>` : "";

  const s = p.source ?? {};
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#F7F8FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #DDE3EC;border-radius:10px">
    <tr><td style="padding:22px 24px">
      <h1 style="margin:0 0 4px;font-size:18px;color:#17202A">${esc(subject)}</h1>
      ${sells ? `<p style="margin:0 0 14px;padding:8px 11px;background:#FFF6E5;border:1px solid #F0D9A8;border-radius:6px;font-size:13px;color:#7A5A12"><strong>Owns and would need to sell first</strong> — possible listing opportunity as well as a purchase.</p>` : ""}
      <table role="presentation" style="font-size:14px;border-collapse:collapse;width:100%">
        ${row("Name", name)}
        ${row("Email", p.email)}
        ${row("Phone", p.phone)}
        ${row("Lives now", [p.current_town, p.current_state].filter(Boolean).join(", "))}
      </table>
      <h2 style="margin:18px 0 6px;font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:#5D6B80">What they want</h2>
      <table role="presentation" style="font-size:14px;border-collapse:collapse;width:100%">
        ${row("Budget", label(p.budget))}
        ${row("Bedrooms", label(p.bedrooms))}
        ${row("Property type", label(p.property_type))}
        ${row("Timeline", label(p.timeline))}
        ${row("Rent or own", label(p.rent_or_own))}
        ${row("Needs to sell first", p.needs_to_sell ? label(p.needs_to_sell) : "")}
        ${row("Commute matters", label(p.commute_matters))}
        ${row("Commute to", p.commute_destination)}
        ${row("Commute often", p.commute_frequency ? label(p.commute_frequency) : "")}
        ${row("Priorities", p.priorities.map(label).join(", "))}
      </table>
      <h2 style="margin:18px 0 6px;font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:#5D6B80">Where they came from</h2>
      <table role="presentation" style="font-size:13px;border-collapse:collapse;width:100%">
        ${row("Landing URL", s.landing_url ?? "")}
        ${row("Referrer", s.referrer ?? "")}
        ${row("utm_source", s.utm_source ?? "")}
        ${row("utm_medium", s.utm_medium ?? "")}
        ${row("utm_campaign", s.utm_campaign ?? "")}
        ${row("utm_content", s.utm_content ?? "")}
        ${row("utm_term", s.utm_term ?? "")}
        ${row("fbclid", s.fbclid ?? "")}
        ${row("Lead ID", leadId)}
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    subject, "",
    sells ? "OWNS AND WOULD NEED TO SELL FIRST — possible listing opportunity.\n" : "",
    `Name:        ${name}`,
    `Email:       ${p.email}`,
    `Phone:       ${p.phone}`,
    `Lives now:   ${[p.current_town, p.current_state].filter(Boolean).join(", ")}`,
    "",
    `Budget:      ${label(p.budget)}`,
    `Bedrooms:    ${label(p.bedrooms)}`,
    `Type:        ${label(p.property_type)}`,
    `Timeline:    ${label(p.timeline)}`,
    `Rent/own:    ${label(p.rent_or_own)}`,
    p.needs_to_sell ? `Must sell:   ${label(p.needs_to_sell)}` : "",
    `Commute:     ${label(p.commute_matters)}${p.commute_destination ? ` — ${p.commute_destination} (${label(p.commute_frequency)})` : ""}`,
    `Priorities:  ${p.priorities.map(label).join(", ")}`,
    "",
    `Source:      ${s.utm_source || "—"} / ${s.utm_campaign || "—"} / ${s.utm_content || "—"}`,
    `Landing:     ${s.landing_url || "—"}`,
    `Lead ID:     ${leadId}`,
  ].filter(Boolean).join("\n");

  return { subject, html, text };
}

// --- visitor confirmation --------------------------------------------------
function buildConfirmation(firstName: string) {
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  const paragraphs = [
    "Thanks for reaching out and completing the South Jersey Town Matcher.",
    "I received your information and I'm going to review your budget, housing needs, commute, and the things that matter most to you.",
    "From there, I'll narrow things down to a few South Jersey towns I think make the most sense for what you're looking for and pull some current homes so you can see what your budget actually looks like in those areas.",
    "I'll be in touch with you soon.",
    `If you'd like to get started sooner, feel free to call or text me directly at ${PHONE}.`,
  ];
  const P = (t: string) =>
    `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#17202A;">${esc(t)}</p>`;

  const html = `<!doctype html>
<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#F7F8FA;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F7F8FA;">
    <tr><td align="center" style="padding:28px 12px;">
      <!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="width:100%;max-width:600px;background:#ffffff;border:1px solid #DDE3EC;border-radius:10px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <tr><td style="padding:28px 26px 6px;">
          ${P(greeting)}
          ${paragraphs.map(P).join("")}
        </td></tr>
        <tr><td align="center" style="padding:6px 26px 30px;">
          <div style="font-size:13px;line-height:1.45;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#17202A;">${esc(BROKERAGE_NAME)}</div>
          <div style="font-size:14px;line-height:1.5;color:#17202A;padding:3px 0 0;">${esc(AGENT_NAME)}</div>
          <div style="font-size:14px;line-height:1.5;padding:1px 0 0;">
            <a href="tel:+16094963330" style="color:#1E4A73;text-decoration:none;">${esc(PHONE)}</a>
          </div>
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
      <!-- Compliance as LIVE TEXT outside the card: an image-blocked client must
           still show it, and 11:5-6.1 applies either way. -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
        <tr><td align="center" style="padding:16px 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;line-height:1.6;color:#5D6B80;">
          ${esc(BROKERAGE_NAME)} &mdash; ${esc(BROKERAGE_DESCRIPTOR)}. NJ Real Estate License #${esc(LICENSE_NUMBER)}.<br />
          Equal Housing Opportunity.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    greeting, "",
    ...paragraphs.flatMap((t) => [t, ""]),
    BROKERAGE_NAME, AGENT_NAME, PHONE, "",
    `${BROKERAGE_NAME} - ${BROKERAGE_DESCRIPTOR}. NJ Real Estate License #${LICENSE_NUMBER}.`,
    "Equal Housing Opportunity.",
  ].join("\n");

  return { subject: "Your South Jersey Town Matcher request", html, text };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const p = (await req.json()) as Payload;
    if (!p?.email || !p?.first_name || !p?.budget) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const s = p.source ?? {};

    // ---- 1. PERSIST FIRST -------------------------------------------------
    // leads.email is UNIQUE, so a repeat submitter is an update, not a
    // duplicate row. A failure here is fatal to the request by design.
    const row = {
      email: p.email.toLowerCase(),
      name: `${toDisplayName(p.first_name)} ${toDisplayName(p.last_name)}`.trim(),
      phone: p.phone,
      town: p.current_town || null,
      interest_type: "buying",
      submission_type: "town-matcher",
      timeline: p.timeline,
      property_type: p.property_type,
      source_url: s.landing_url || `${SITE_URL}/town-matcher/`,
      utm_source: s.utm_source || null,
      utm_medium: s.utm_medium || null,
      utm_campaign: s.utm_campaign || null,
      utm_content: s.utm_content || null,
      utm_term: s.utm_term || null,
      fbclid: s.fbclid || null,
      town_matcher: {
        budget: p.budget,
        bedrooms: p.bedrooms,
        property_type: p.property_type,
        current_town: p.current_town,
        current_state: p.current_state,
        commute_matters: p.commute_matters,
        commute_destination: p.commute_destination || null,
        commute_frequency: p.commute_frequency || null,
        priorities: p.priorities,
        timeline: p.timeline,
        rent_or_own: p.rent_or_own,
        needs_to_sell: p.needs_to_sell || null,
        first_name_raw: p.first_name,
        last_name_raw: p.last_name,
      },
    };

    const { data: saved, error: saveError } = await supabase
      .from("leads")
      .upsert(row, { onConflict: "email" })
      .select("id")
      .single();

    if (saveError || !saved) {
      console.error("town-matcher: lead NOT stored:", saveError);
      return new Response(JSON.stringify({ error: "Could not store the lead" }), {
        status: 502, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const leadId = saved.id as string;
    console.log("town-matcher lead stored:", leadId);

    // ---- 2. NOTIFY STEVEN, with retry ------------------------------------
    let notified = false;
    let notifyError: string | null = null;
    const n = buildNotification(p, leadId);
    for (let attempt = 1; attempt <= 3 && !notified; attempt++) {
      try {
        const res = await ses.send(new SendEmailCommand({
          Source: `Town Matcher <${SES_SENDER_EMAIL}>`,
          Destination: { ToAddresses: AGENT_NOTIFY_EMAILS },
          ReplyToAddresses: [p.email],
          Message: {
            Subject: { Data: n.subject, Charset: "UTF-8" },
            Body: { Html: { Data: n.html, Charset: "UTF-8" }, Text: { Data: n.text, Charset: "UTF-8" } },
          },
          ConfigurationSetName: SES_CONFIGURATION_SET,
        }));
        notified = true;
        console.log(`town-matcher agent notified (ses ${res.MessageId})`);
      } catch (err) {
        notifyError = String((err as Error)?.message ?? err).slice(0, 300);
        console.error(`town-matcher notify attempt ${attempt} failed:`, err);
        if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 400));
      }
    }
    // Record the outcome either way. A stored-but-unnotified lead must be
    // recoverable, not silent.
    await supabase.from("leads").update(
      notified
        ? { agent_notified_at: new Date().toISOString(), agent_notify_error: null }
        : { agent_notify_error: notifyError },
    ).eq("id", leadId);

    // ---- 3. CONFIRM TO THE VISITOR ---------------------------------------
    // Own try/catch: the lead is stored and Steven knows. A courtesy email
    // failing must not turn that into a visitor-facing error.
    let confirmationSent = false;
    try {
      const c = buildConfirmation(toDisplayName(p.first_name));
      const res = await ses.send(new SendEmailCommand({
        // Display name quoted — it contains a comma, and an unquoted comma in a
        // From header splits it into two malformed addresses.
        Source: `"${AGENT_NAME} | ${BROKERAGE_NAME}" <${SES_SENDER_EMAIL}>`,
        Destination: { ToAddresses: [p.email] },
        ReplyToAddresses: [AGENT_NOTIFY_EMAILS[0]],
        Message: {
          Subject: { Data: c.subject, Charset: "UTF-8" },
          Body: { Html: { Data: c.html, Charset: "UTF-8" }, Text: { Data: c.text, Charset: "UTF-8" } },
        },
        ConfigurationSetName: SES_CONFIGURATION_SET,
      }));
      confirmationSent = true;
      console.log(`town-matcher confirmation sent to ${p.email} (ses ${res.MessageId})`);
      await supabase.from("leads")
        .update({ confirmation_sent_at: new Date().toISOString() })
        .eq("id", leadId);
    } catch (err) {
      console.error("town-matcher confirmation failed:", err);
    }

    return new Response(
      JSON.stringify({ success: true, leadId, notified, confirmationSent }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("send-town-matcher failed:", err);
    return new Response(JSON.stringify({ error: "Could not process the lead" }), {
      status: 502, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
