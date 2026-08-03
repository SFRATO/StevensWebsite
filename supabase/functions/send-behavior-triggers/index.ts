/**
 * Send Behaviour Triggers Edge Function
 *
 * Turns what a lead actually looked at on the site into a targeted follow-up.
 * Invoked daily by netlify/functions/process-behavior-triggers.ts.
 *
 * Rules live in the `behavior_triggers` table (seeded by migration 003) so the
 * cadence is tunable without a deploy. Evaluation order is: highest-value
 * trigger first, one trigger per lead per run.
 *
 * Suppression rules — all four are enforced before any send:
 *   1. lead.status must be 'active' (never mail an unsubscribed or bounced lead);
 *   2. at most one behaviour email per lead per BEHAVIOR_COOLDOWN_DAYS;
 *   3. never on a day the drip campaign already has something queued or sent —
 *      the drip wins, behaviour mail is the extra;
 *   4. per-trigger, per-subject cooldown from behavior_triggers.cooldown_days.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SESClient, SendEmailCommand } from "npm:@aws-sdk/client-ses";
import { createToken } from "../_shared/tokens.ts";

// Environment
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const AWS_ACCESS_KEY_ID = Deno.env.get("AWS_ACCESS_KEY_ID")!;
const AWS_SECRET_ACCESS_KEY = Deno.env.get("AWS_SECRET_ACCESS_KEY")!;
const AWS_REGION = Deno.env.get("AWS_REGION") || "us-east-1";
const SES_SENDER_EMAIL = Deno.env.get("SES_SENDER_EMAIL") || "reports@stevenfrato.com";
const SES_CONFIGURATION_SET = Deno.env.get("SES_CONFIGURATION_SET") || "steven-frato-emails";
const SITE_URL = Deno.env.get("SITE_URL") || "https://stevenfrato.com";
const STEVEN_EMAIL = "sf@stevenfrato.com";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const sesClient = new SESClient({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

// Tuning
const BEHAVIOR_COOLDOWN_DAYS = 7;   // suppression rule 2
const TOWN_REPEAT_MIN_VIEWS = 3;
const TOWN_REPEAT_WINDOW_DAYS = 14;
const HIGH_INTENT_MIN_VIEWS = 5;
const HIGH_INTENT_WINDOW_HOURS = 48;
const DORMANT_DAYS = 30;
const LOOKBACK_DAYS = 30;           // how far back a run considers activity
const MAX_LEADS_PER_RUN = 200;
const SES_RATE_LIMIT_MS = 100;

// Types
interface TriggerRule {
  slug: string;
  template_id: string;
  subject_template: string;
  cooldown_days: number;
  notify_agent_only: boolean;
}

interface Lead {
  id: string;
  email: string;
  name: string;
  status: string;
  town: string | null;
  zipcode: string | null;
  lead_temperature: string | null;
}

interface Activity {
  event_type: string;
  path: string;
  town: string | null;
  zipcode: string | null;
  metadata: Record<string, unknown> | null;
  occurred_at: string;
}

interface ZipcodeData {
  zipcode: string;
  town: string;
  median_sale_price: number | null;
  median_sale_price_yoy: number | null;
  median_dom: number | null;
  inventory: number | null;
  market_type: string;
}

/** A trigger that fired, ready to render and send. */
interface Match {
  rule: TriggerRule;
  lead: Lead;
  subjectKey: string;
  town: string | null;
  zipcode: string | null;
  vars: Record<string, string>;
}

// -----------------------------------------------------------------------------
// Formatting helpers (mirrors src/utils/market-analysis.ts)
// -----------------------------------------------------------------------------

function formatCurrency(value: number | null): string {
  if (value === null) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number | null): string {
  // Same data-integrity guard as the site: a YoY outside [-100, 300] is a
  // source-data artifact, not a real move.
  if (value === null || value < -100 || value > 300) return "N/A";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

/** Escape user-controlled values before they go into email HTML. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

function toolNameFromPath(path: string): string {
  const names: Record<string, string> = {
    "proceeds-calculator": "net proceeds",
    "home-value-estimator": "home value estimate",
    "should-i-sell-now": "timing analysis",
    "affordability-calculator": "affordability estimate",
  };
  const slug = path.split("/").filter(Boolean).pop() ?? "";
  return names[slug] ?? "calculator";
}

// -----------------------------------------------------------------------------
// Email shell — one layout, so behaviour mail is visually consistent with the drip
// -----------------------------------------------------------------------------

function emailShell(bodyHtml: string, unsubscribeUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#333;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">
    <div style="background:#1a1a1a;color:#ffffff;padding:24px 30px;">
      <h1 style="margin:0;font-size:20px;">Steven Frato</h1>
      <p style="margin:4px 0 0;color:#C99C33;font-size:12px;letter-spacing:1px;font-weight:600;">CENTURY 21</p>
    </div>
    <div style="padding:30px;line-height:1.6;">
      ${bodyHtml}
    </div>
    <div style="border-top:1px solid #eee;padding:20px 30px;font-size:12px;color:#999;text-align:center;">
      <p style="margin:0 0 8px;">Steven Frato &middot; Century 21 &middot; 136 Farnsworth Ave, Bordentown, NJ 08505</p>
      <p style="margin:0;"><a href="${unsubscribeUrl}" style="color:#999;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>`;
}

/** A market snapshot block, or empty string when we have no data for the area. */
function statsBlock(zip: ZipcodeData | null): string {
  if (!zip) return "";
  const rows: string[] = [];
  if (zip.median_sale_price !== null) {
    rows.push(`<strong>Median sale price:</strong> ${formatCurrency(zip.median_sale_price)}`);
  }
  if (formatPercent(zip.median_sale_price_yoy) !== "N/A") {
    rows.push(`<strong>Year over year:</strong> ${formatPercent(zip.median_sale_price_yoy)}`);
  }
  if (zip.median_dom !== null) {
    rows.push(`<strong>Days on market:</strong> ${Math.round(zip.median_dom)}`);
  }
  if (zip.inventory !== null) {
    rows.push(`<strong>Homes for sale:</strong> ${zip.inventory}`);
  }
  if (rows.length === 0) return "";

  return `<div style="background:#faf7ef;border-left:4px solid #C99C33;padding:16px 20px;margin:20px 0;">
    ${rows.map((r) => `<p style="margin:0 0 6px;">${r}</p>`).join("")}
  </div>`;
}

interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

type Renderer = (
  match: Match,
  zip: ZipcodeData | null,
  unsubscribeUrl: string,
) => RenderedEmail;

const templates: Record<string, Renderer> = {
  "behavior-town-repeat": (match, zip, unsubscribeUrl) => {
    const town = escapeHtml(match.town ?? "your area");
    const name = escapeHtml(match.lead.name);
    const subject = fillTemplate(match.rule.subject_template, match.vars);
    const cta = `${SITE_URL}/home-value/${(match.town ?? "").toLowerCase().replace(/\s+/g, "-")}/`;

    return {
      subject,
      html: emailShell(
        `<p>Hi ${name},</p>
         <p>I noticed ${town} has been on your radar. Here's where that market stands right now:</p>
         ${statsBlock(zip)}
         <p>If you're weighing a move, the useful question usually isn't "what is my home worth" in the abstract &mdash; it's what it would realistically sell for in this specific market, this season.</p>
         <p style="margin:24px 0;"><a href="${cta}" style="display:inline-block;background:#8A6A12;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Get a ${town} home value estimate</a></p>
         <p>Happy to talk it through with no pressure either way &mdash; just reply to this email or call (609) 789-0126.</p>
         <p>&mdash; Steven</p>`,
        unsubscribeUrl,
      ),
      text: `Hi ${match.lead.name},\n\nI noticed ${match.town ?? "your area"} has been on your radar. Here's where that market stands:\n\n${
        zip
          ? `Median sale price: ${formatCurrency(zip.median_sale_price)}\nYear over year: ${formatPercent(zip.median_sale_price_yoy)}\nDays on market: ${zip.median_dom ?? "N/A"}\n`
          : ""
      }\nGet an estimate: ${cta}\n\nOr just reply / call (609) 789-0126.\n\n-- Steven\n\nUnsubscribe: ${unsubscribeUrl}`,
    };
  },

  "behavior-tool-followup": (match, zip, unsubscribeUrl) => {
    const name = escapeHtml(match.lead.name);
    const tool = escapeHtml(match.vars.tool_name ?? "calculator");
    const town = escapeHtml(match.town ?? "your area");

    return {
      subject: fillTemplate(match.rule.subject_template, match.vars),
      html: emailShell(
        `<p>Hi ${name},</p>
         <p>You ran the ${tool} on my site recently. Those tools give you a solid ballpark, but they can't see the things that actually move a number: condition, layout, what the three most comparable homes nearby just closed at.</p>
         ${statsBlock(zip)}
         <p>If it's useful, I'll put together the real version for ${town} &mdash; actual comparable sales, what I'd list at, and what you'd net. It takes me about twenty minutes and costs you nothing.</p>
         <p style="margin:24px 0;"><a href="${SITE_URL}/contact/" style="display:inline-block;background:#8A6A12;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Ask for the detailed numbers</a></p>
         <p>&mdash; Steven</p>`,
        unsubscribeUrl,
      ),
      text: `Hi ${match.lead.name},\n\nYou ran the ${match.vars.tool_name ?? "calculator"} on my site recently. It's a solid ballpark, but it can't account for condition, layout, or what the closest comparable homes actually closed at.\n\nHappy to put together the real version for ${match.town ?? "your area"} at no cost: ${SITE_URL}/contact/\n\n-- Steven\n\nUnsubscribe: ${unsubscribeUrl}`,
    };
  },

  "behavior-dormant-return": (match, zip, unsubscribeUrl) => {
    const name = escapeHtml(match.lead.name);
    const town = escapeHtml(match.town ?? "your area");

    return {
      subject: fillTemplate(match.rule.subject_template, match.vars),
      html: emailShell(
        `<p>Hi ${name},</p>
         <p>It's been a little while. Since you last looked, here's where ${town} stands:</p>
         ${statsBlock(zip)}
         <p>No agenda here &mdash; if you're still just watching, keep watching. I'll keep the numbers coming once a month.</p>
         <p>If your plans have firmed up, reply and tell me what you're thinking and I'll give you a straight read on timing.</p>
         <p>&mdash; Steven</p>`,
        unsubscribeUrl,
      ),
      text: `Hi ${match.lead.name},\n\nIt's been a little while. Since you last looked, here's where ${match.town ?? "your area"} stands:\n\n${
        zip
          ? `Median sale price: ${formatCurrency(zip.median_sale_price)}\nYear over year: ${formatPercent(zip.median_sale_price_yoy)}\nDays on market: ${zip.median_dom ?? "N/A"}\n`
          : ""
      }\nIf your plans have firmed up, just reply.\n\n-- Steven\n\nUnsubscribe: ${unsubscribeUrl}`,
    };
  },
};

/** Internal alert to the agent — not sent to the lead, so no unsubscribe footer. */
function renderAgentAlert(match: Match, activities: Activity[]): RenderedEmail {
  const recent = activities
    .slice(0, 12)
    .map(
      (a) =>
        `<li>${escapeHtml(a.path)} &mdash; ${new Date(a.occurred_at).toLocaleString("en-US", { timeZone: "America/New_York" })}</li>`,
    )
    .join("");

  return {
    subject: fillTemplate(match.rule.subject_template, match.vars),
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;">
      <h2 style="color:#1a1a1a;">High-intent activity</h2>
      <p><strong>${escapeHtml(match.lead.name)}</strong> &lt;${escapeHtml(match.lead.email)}&gt;</p>
      <p>Area: ${escapeHtml(match.town ?? "unknown")} ${escapeHtml(match.lead.zipcode ?? "")}<br>
         Temperature: ${escapeHtml(match.lead.lead_temperature ?? "unknown")}</p>
      <p><strong>Recent activity:</strong></p>
      <ul>${recent}</ul>
      <p><a href="mailto:${encodeURIComponent(match.lead.email)}">Reply to this lead</a></p>
    </div>`,
    text: `High-intent activity\n\n${match.lead.name} <${match.lead.email}>\nArea: ${match.town ?? "unknown"}\nTemperature: ${match.lead.lead_temperature ?? "unknown"}\n\nRecent:\n${activities
      .slice(0, 12)
      .map((a) => `- ${a.path} (${a.occurred_at})`)
      .join("\n")}`,
  };
}

// -----------------------------------------------------------------------------
// Rule evaluation
// -----------------------------------------------------------------------------

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Evaluate every rule against one lead's activity and return the single
 * highest-value match, or null.
 *
 * Order matters: an agent alert beats a lead email, and a fresh tool completion
 * beats a generic re-engagement nudge.
 */
function evaluate(lead: Lead, activities: Activity[], rules: Map<string, TriggerRule>): Match | null {
  if (activities.length === 0) return null;

  const base = { lead, town: lead.town, zipcode: lead.zipcode };

  // 1. high_intent_return — agent alert, highest value.
  const highIntentRule = rules.get("high_intent_return");
  if (highIntentRule) {
    const cutoff = Date.now() - HIGH_INTENT_WINDOW_HOURS * 60 * 60 * 1000;
    const recent = activities.filter((a) => new Date(a.occurred_at).getTime() >= cutoff);
    const viewedHomeValue = recent.some((a) => a.path.startsWith("/home-value/"));

    if (recent.length >= HIGH_INTENT_MIN_VIEWS || viewedHomeValue) {
      const town = recent.find((a) => a.town)?.town ?? lead.town;
      return {
        ...base,
        rule: highIntentRule,
        subjectKey: "",
        town,
        zipcode: recent.find((a) => a.zipcode)?.zipcode ?? lead.zipcode,
        vars: { name: lead.name, town: town ?? "their area" },
      };
    }
  }

  // 2. tool_completed — they did real work; follow up with the real numbers.
  const toolRule = rules.get("tool_completed");
  if (toolRule) {
    const toolUse = activities.find((a) => a.event_type === "tool_use");
    if (toolUse) {
      const toolName = toolNameFromPath(toolUse.path);
      return {
        ...base,
        rule: toolRule,
        subjectKey: toolUse.path,
        town: toolUse.town ?? lead.town,
        zipcode: toolUse.zipcode ?? lead.zipcode,
        vars: { name: lead.name, tool_name: toolName, town: toolUse.town ?? lead.town ?? "your area" },
      };
    }
  }

  // 3. town_repeat — same town, three or more times, in the last fortnight.
  const townRule = rules.get("town_repeat");
  if (townRule) {
    const cutoff = Date.now() - TOWN_REPEAT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const counts = new Map<string, { count: number; zipcode: string | null }>();

    for (const a of activities) {
      if (!a.town || a.event_type !== "page_view") continue;
      if (new Date(a.occurred_at).getTime() < cutoff) continue;
      const entry = counts.get(a.town) ?? { count: 0, zipcode: a.zipcode };
      entry.count += 1;
      entry.zipcode = entry.zipcode ?? a.zipcode;
      counts.set(a.town, entry);
    }

    let best: { town: string; count: number; zipcode: string | null } | null = null;
    for (const [town, entry] of counts) {
      if (entry.count >= TOWN_REPEAT_MIN_VIEWS && (!best || entry.count > best.count)) {
        best = { town, count: entry.count, zipcode: entry.zipcode };
      }
    }

    if (best) {
      return {
        ...base,
        rule: townRule,
        subjectKey: best.town,
        town: best.town,
        zipcode: best.zipcode ?? lead.zipcode,
        vars: { name: lead.name, town: best.town },
      };
    }
  }

  // 4. dormant_return — back after a long gap.
  const dormantRule = rules.get("dormant_return");
  if (dormantRule && activities.length >= 2) {
    const sorted = [...activities].sort(
      (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
    );
    const latest = new Date(sorted[0].occurred_at).getTime();
    const previous = new Date(sorted[1].occurred_at).getTime();

    if (latest - previous >= DORMANT_DAYS * 24 * 60 * 60 * 1000) {
      const town = sorted[0].town ?? lead.town;
      return {
        ...base,
        rule: dormantRule,
        subjectKey: town ?? "",
        town,
        zipcode: sorted[0].zipcode ?? lead.zipcode,
        vars: { name: lead.name, town: town ?? "your area" },
      };
    }
  }

  return null;
}

// -----------------------------------------------------------------------------
// Main handler
// -----------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  const stats = {
    leads_considered: 0,
    matched: 0,
    sent: 0,
    suppressed: 0,
    failed: 0,
    errors: [] as string[],
  };

  try {
    // Load active rules.
    const { data: ruleRows, error: ruleError } = await supabase
      .from("behavior_triggers")
      .select("slug, template_id, subject_template, cooldown_days, notify_agent_only")
      .eq("is_active", true);

    if (ruleError) throw ruleError;

    const rules = new Map<string, TriggerRule>(
      (ruleRows ?? []).map((r: TriggerRule) => [r.slug, r]),
    );
    if (rules.size === 0) {
      return new Response(JSON.stringify({ ...stats, message: "No active triggers" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Candidate leads: active, with recorded activity in the lookback window.
    const { data: recentActivity, error: activityError } = await supabase
      .from("lead_activity")
      .select("lead_id")
      .gte("occurred_at", daysAgo(LOOKBACK_DAYS));

    if (activityError) throw activityError;

    const leadIds = [...new Set((recentActivity ?? []).map((r: { lead_id: string }) => r.lead_id))].slice(
      0,
      MAX_LEADS_PER_RUN,
    );

    if ((recentActivity ?? []).length > 0 && leadIds.length === MAX_LEADS_PER_RUN) {
      // Never let a cap look like full coverage.
      console.warn(
        `Capped at ${MAX_LEADS_PER_RUN} leads this run; remaining leads will be picked up tomorrow.`,
      );
    }

    if (leadIds.length === 0) {
      return new Response(JSON.stringify({ ...stats, message: "No recent activity" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: leads, error: leadError } = await supabase
      .from("leads")
      .select("id, email, name, status, town, zipcode, lead_temperature")
      // Suppression rule 1: unsubscribed and bounced leads never reach the send loop.
      .eq("status", "active")
      .in("id", leadIds);

    if (leadError) throw leadError;

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    for (const lead of (leads ?? []) as Lead[]) {
      stats.leads_considered++;

      try {
        // Suppression rule 2: one behaviour email per lead per week.
        const { data: recentSends } = await supabase
          .from("behavior_sends")
          .select("id")
          .eq("lead_id", lead.id)
          .gte("sent_at", daysAgo(BEHAVIOR_COOLDOWN_DAYS))
          .limit(1);

        if (recentSends?.length) {
          stats.suppressed++;
          continue;
        }

        // Suppression rule 3: the drip campaign owns today.
        const { data: dripToday } = await supabase
          .from("scheduled_emails")
          .select("id")
          .eq("lead_id", lead.id)
          .gte("scheduled_for", todayStart.toISOString())
          .in("status", ["pending", "sending", "sent", "delivered"])
          .limit(1);

        if (dripToday?.length) {
          stats.suppressed++;
          continue;
        }

        const { data: activities } = await supabase
          .from("lead_activity")
          .select("event_type, path, town, zipcode, metadata, occurred_at")
          .eq("lead_id", lead.id)
          .gte("occurred_at", daysAgo(LOOKBACK_DAYS))
          .order("occurred_at", { ascending: false });

        const match = evaluate(lead, (activities ?? []) as Activity[], rules);
        if (!match) continue;

        // Suppression rule 4: per-trigger, per-subject cooldown.
        const { data: triggerSends } = await supabase
          .from("behavior_sends")
          .select("id")
          .eq("lead_id", lead.id)
          .eq("trigger_slug", match.rule.slug)
          .eq("subject_key", match.subjectKey)
          .gte("sent_at", daysAgo(match.rule.cooldown_days))
          .limit(1);

        if (triggerSends?.length) {
          stats.suppressed++;
          continue;
        }

        stats.matched++;

        // Market data for the town in question.
        let zip: ZipcodeData | null = null;
        if (match.zipcode) {
          const { data } = await supabase
            .from("zipcode_data")
            .select("zipcode, town, median_sale_price, median_sale_price_yoy, median_dom, inventory, market_type")
            .eq("zipcode", match.zipcode)
            .single();
          zip = data;
        }

        const unsubscribeUrl = `${SITE_URL}/.netlify/functions/unsubscribe?token=${await createToken(
          "unsubscribe",
          lead.id,
        )}`;

        let rendered: RenderedEmail;
        let recipient: string;

        if (match.rule.notify_agent_only) {
          rendered = renderAgentAlert(match, (activities ?? []) as Activity[]);
          recipient = STEVEN_EMAIL;
        } else {
          const renderer = templates[match.rule.template_id];
          if (!renderer) {
            console.error(`No renderer for template_id '${match.rule.template_id}' — skipping.`);
            continue;
          }
          rendered = renderer(match, zip, unsubscribeUrl);
          recipient = lead.email;
        }

        const command = new SendEmailCommand({
          Source: `Steven Frato <${SES_SENDER_EMAIL}>`,
          Destination: { ToAddresses: [recipient] },
          Message: {
            Subject: { Data: rendered.subject, Charset: "UTF-8" },
            Body: {
              Html: { Data: rendered.html, Charset: "UTF-8" },
              Text: { Data: rendered.text, Charset: "UTF-8" },
            },
          },
          ReplyToAddresses: [STEVEN_EMAIL],
          ConfigurationSetName: SES_CONFIGURATION_SET,
        });

        const result = await sesClient.send(command);

        await supabase.from("behavior_sends").insert({
          lead_id: lead.id,
          trigger_slug: match.rule.slug,
          subject_key: match.subjectKey,
          ses_message_id: result.MessageId ?? null,
        });

        stats.sent++;
        console.log(`Sent '${match.rule.slug}' to ${recipient} for lead ${lead.id}`);

        await new Promise((resolve) => setTimeout(resolve, SES_RATE_LIMIT_MS));
      } catch (leadError) {
        stats.failed++;
        const message = leadError instanceof Error ? leadError.message : "Unknown error";
        stats.errors.push(`${lead.id}: ${message}`);
        console.error(`Behaviour trigger failed for lead ${lead.id}:`, leadError);
      }
    }

    console.log("Behaviour trigger run complete:", JSON.stringify(stats));

    return new Response(JSON.stringify(stats), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Behaviour trigger run failed:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
        stats,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
