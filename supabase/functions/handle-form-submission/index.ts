/**
 * Handle Form Submission Edge Function
 *
 * Processes form submissions from Netlify webhook:
 * 1. Validates and parses form data
 * 2. Checks for duplicate leads
 * 3. Inserts lead into database (campaign auto-assigned via trigger)
 * 4. Schedules all campaign emails
 * 5. Sends immediate welcome email via SES
 * 6. Sends lead notification to Steven
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SESClient, SendEmailCommand } from "npm:@aws-sdk/client-ses";
import { createToken } from "../_shared/tokens.ts";

// Types
interface FormSubmissionPayload {
  email: string;
  name: string;
  address?: string;
  town?: string;
  zipcode?: string;
  phone?: string;
  interest?: string;
  "source-location"?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;

  /**
   * Set by step 2 of the exit-intent popup: this is the same signup completing,
   * not a returning visitor. Suppresses a duplicate agent notification and
   * permits re-campaigning within the signup window.
   */
  qualify?: boolean | string;

  // Qualification fields from multi-step quiz
  intent?: string;
  timeline?: string;
  "property-type"?: string;
  "value-range"?: string;
  "budget-range"?: string;
  "important-factor"?: string;
  "pre-approved"?: string;
  "contact-preference"?: string;
  "lead-score"?: string;
  "lead-temperature"?: string;
}

// Lead scoring types
type LeadTemperature = 'hot' | 'warm' | 'nurture' | 'cold';
type LeadPriority = 'immediate' | 'same-day' | 'nurture' | 'drip';

interface LeadScore {
  score: number;
  temperature: LeadTemperature;
  priority: LeadPriority;
}

// Lead scoring calculation (mirrors TypeScript utility)
function calculateLeadScore(data: {
  intent?: string;
  timeline?: string;
  propertyType?: string;
  valueRange?: string;
  budgetRange?: string;
  importantFactor?: string;
  preApproved?: boolean | null;
  contactPreference?: string;
}): LeadScore {
  let score = 0;

  // Timeline scoring (max 40)
  const timelineScores: Record<string, number> = {
    'within-30-days': 40,
    '1-3-months': 25,
    '3-6-months': 15,
    '6-plus-months': 5,
  };
  score += timelineScores[data.timeline || ''] || 0;

  // Intent scoring (max 25)
  const intentScores: Record<string, number> = {
    'selling': 20,
    'buying': 15,
    'both': 25,
    'home-value': 10,
    'browsing': 0,
  };
  score += intentScores[data.intent || ''] || 0;

  // Property type scoring
  const propertyScores: Record<string, number> = {
    'single-family': 10,
    'townhouse': 10,
    'condo': 8,
    'multi-family': 12,
  };
  score += propertyScores[data.propertyType || ''] || 0;

  // Important factor scoring
  const factorScores: Record<string, number> = {
    'speed': 8,
    'price': 5,
    'convenience': 3,
  };
  score += factorScores[data.importantFactor || ''] || 0;

  // Pre-approval for buyers
  if (data.intent === 'buying' || data.intent === 'both') {
    if (data.preApproved === true) {
      score += 15;
    } else if (data.preApproved === false) {
      score += 5;
    }
  }

  // Value/budget range bonus
  if (data.valueRange || data.budgetRange) {
    score += 5;
  }

  // Contact preference scoring
  const contactScores: Record<string, number> = {
    'asap': 10,
    'morning': 5,
    'afternoon': 5,
    'evening': 3,
  };
  score += contactScores[data.contactPreference || ''] || 0;

  score = Math.min(100, Math.max(0, score));

  // Determine temperature
  const temperature: LeadTemperature = score >= 80 ? 'hot' : score >= 50 ? 'warm' : score >= 25 ? 'nurture' : 'cold';

  // Determine priority
  const priorityMap: Record<LeadTemperature, LeadPriority> = {
    'hot': 'immediate',
    'warm': 'same-day',
    'nurture': 'nurture',
    'cold': 'drip',
  };

  return {
    score,
    temperature,
    priority: priorityMap[temperature],
  };
}

interface ZipcodeData {
  zipcode: string;
  town: string | null;
  county: string | null;
  median_sale_price: number | null;
  median_sale_price_yoy: number | null;
  median_dom: number | null;
  inventory: number | null;
  sold_above_list_pct: number | null;
  market_type: string;
  ai_insight: string | null;
  nearby_zips: string[];
}

interface CampaignStep {
  id: string;
  step_number: number;
  template_id: string;
  subject_template: string;
  delay_days: number;
  send_hour: number;
}

// Environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const AWS_ACCESS_KEY_ID = Deno.env.get("AWS_ACCESS_KEY_ID")!;
const AWS_SECRET_ACCESS_KEY = Deno.env.get("AWS_SECRET_ACCESS_KEY")!;
const AWS_REGION = Deno.env.get("AWS_REGION") || "us-east-1";
const SES_SENDER_EMAIL = Deno.env.get("SES_SENDER_EMAIL") || "reports@stevenfrato.com";
const SES_CONFIGURATION_SET = Deno.env.get("SES_CONFIGURATION_SET") || "steven-frato-emails";
const STEVEN_EMAIL = "sf@stevenfrato.com";
const SITE_URL = Deno.env.get("SITE_URL") || "https://stevenfrato.com";

// Initialize clients
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const sesClient = new SESClient({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

// Helper: Format currency
function formatCurrency(value: number | null): string {
  if (value === null) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

// Helper: Format percentage change
function formatPercentChange(value: number | null): string {
  if (value === null) return "N/A";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

// Helper: Get market type label
function getMarketTypeLabel(marketType: string): string {
  switch (marketType) {
    case "seller":
      return "Seller's Market";
    case "buyer":
      return "Buyer's Market";
    default:
      return "Balanced Market";
  }
}

// Helper: Calculate scheduled time for email
function calculateScheduledTime(signupDate: Date, delayDays: number, sendHour: number): Date {
  const scheduledDate = new Date(signupDate);
  scheduledDate.setDate(scheduledDate.getDate() + delayDays);

  // Set to the specified hour (EST/EDT)
  // For simplicity, we'll use UTC and assume EST (UTC-5)
  scheduledDate.setUTCHours(sendHour + 5, 0, 0, 0);

  // If delay is 0 and it's past the send hour, send immediately
  if (delayDays === 0) {
    return new Date();
  }

  return scheduledDate;
}

/**
 * Move a lead onto a different campaign and rebuild its pending queue.
 *
 * Used when step 2 of the exit-intent popup reveals a different intent than the
 * default the lead was enrolled under (e.g. signed up as a seller, then said
 * "looking to buy"). Only steps the lead has not already been sent are
 * scheduled, so nobody receives a day-0 welcome twice.
 *
 * Returns the number of emails scheduled (0 if nothing changed).
 */
async function recampaignLead(
  leadId: string,
  interestType: string,
  signupIso: string,
): Promise<number> {
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id")
    .contains("interest_types", [interestType])
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!campaign) {
    console.warn(`No active campaign for interest_type '${interestType}' — keeping current campaign.`);
    return 0;
  }

  // Steps already sent (or in flight) must not be re-queued.
  const { data: sentRows } = await supabase
    .from("scheduled_emails")
    .select("campaign_step:campaign_steps(step_number)")
    .eq("lead_id", leadId)
    .neq("status", "pending");

  const highestSentStep = (sentRows ?? []).reduce((max: number, row: any) => {
    const n = row?.campaign_step?.step_number ?? 0;
    return n > max ? n : max;
  }, 0);

  const { data: steps } = await supabase
    .from("campaign_steps")
    .select("id, step_number, delay_days, send_hour")
    .eq("campaign_id", campaign.id)
    .order("step_number", { ascending: true });

  if (!steps?.length) return 0;

  // Drop the old queue first so the unique (lead_id, campaign_step_id) constraint
  // can't collide with the rows we're about to write.
  const { error: deleteError } = await supabase
    .from("scheduled_emails")
    .delete()
    .eq("lead_id", leadId)
    .eq("status", "pending");

  if (deleteError) {
    console.error("Re-campaign: failed to clear pending emails:", deleteError);
    return 0;
  }

  const signupDate = new Date(signupIso);
  const rows = steps
    .filter((step) => step.step_number > highestSentStep)
    .map((step) => ({
      lead_id: leadId,
      campaign_step_id: step.id,
      scheduled_for: calculateScheduledTime(signupDate, step.delay_days, step.send_hour).toISOString(),
      status: "pending",
    }));

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from("scheduled_emails").insert(rows);
    if (insertError) {
      console.error("Re-campaign: failed to schedule new emails:", insertError);
      return 0;
    }
  }

  const next = rows[0];
  await supabase
    .from("leads")
    .update({
      campaign_id: campaign.id,
      current_step: highestSentStep,
      next_email_at: next?.scheduled_for ?? null,
    })
    .eq("id", leadId);

  console.log(`Re-campaigned lead ${leadId} to '${interestType}' — ${rows.length} emails queued.`);
  return rows.length;
}

// Helper: Generate unsubscribe URL. Token is HMAC-signed (see _shared/tokens.ts)
// so a lead id alone is not enough to unsubscribe someone else.
async function generateUnsubscribeUrl(leadId: string): Promise<string> {
  const token = await createToken("unsubscribe", leadId);
  return `${SITE_URL}/.netlify/functions/unsubscribe?token=${token}`;
}

// Send welcome email
async function sendWelcomeEmail(
  lead: { email: string; name: string; address: string; town: string; zipcode: string },
  zipData: ZipcodeData | null,
  unsubscribeUrl: string
): Promise<string | null> {
  const fullAddress = `${lead.address}, ${lead.town}, NJ ${lead.zipcode}`;

  // Generate PDF URL
  const pdfParams = new URLSearchParams({
    zipcode: lead.zipcode,
    name: lead.name,
    address: lead.address,
    town: lead.town,
  });
  const pdfUrl = `${SITE_URL}/.netlify/functions/generate-pdf?${pdfParams.toString()}`;

  // Market data for email
  const medianPrice = formatCurrency(zipData?.median_sale_price ?? null);
  const priceChange = formatPercentChange(zipData?.median_sale_price_yoy ?? null);
  const marketType = getMarketTypeLabel(zipData?.market_type ?? "balanced");

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your ${lead.town} Market Report</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f6f6f6;">
  <div style="background: #ffffff; border-radius: 8px; overflow: hidden;">
    <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #C99C33;">
      <h1 style="color: #1a1a1a; margin: 0;">Steven Frato</h1>
      <p style="color: #C99C33; margin: 5px 0 0; font-weight: 600;">CENTURY 21</p>
    </div>

    <div style="padding: 30px;">
      <h2 style="color: #1a1a1a;">Your ${lead.town} Market Report is Ready</h2>

      <p>Hi ${lead.name},</p>

      <p>Thank you for your interest in the ${lead.town}, NJ real estate market. I've prepared a personalized market analysis based on your property at:</p>

      <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <strong>${fullAddress}</strong>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${pdfUrl}" style="display: inline-block; background: #C99C33; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Download Your Market Report (PDF)</a>
      </div>

      ${zipData ? `
      <div style="background: linear-gradient(135deg, rgba(201, 156, 51, 0.1) 0%, rgba(201, 156, 51, 0.2) 100%); padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #C99C33;">
        <h3 style="margin: 0 0 15px; color: #1a1a1a;">Quick Market Snapshot</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #666;">Median Sale Price:</td>
            <td style="padding: 8px 0; font-weight: 600; text-align: right;">${medianPrice}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Year-over-Year Change:</td>
            <td style="padding: 8px 0; font-weight: 600; text-align: right; color: ${(zipData.median_sale_price_yoy ?? 0) >= 0 ? '#4CAF50' : '#f44336'};">${priceChange}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Market Conditions:</td>
            <td style="padding: 8px 0; font-weight: 600; text-align: right;">${marketType}</td>
          </tr>
        </table>
      </div>
      ` : ''}

      <h3 style="color: #1a1a1a;">What's in Your Report:</h3>
      <ul style="padding-left: 20px;">
        <li>Current market conditions for ${lead.town} (${lead.zipcode})</li>
        <li>Median sale price and year-over-year trends</li>
        <li>Days on market and inventory levels</li>
        <li>Whether it's a buyer's or seller's market</li>
      </ul>

      <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 25px 0;">
        <p style="margin: 0; font-weight: 600; color: #1a1a1a;">Want to discuss your options?</p>
        <p style="margin: 10px 0 0; color: #666;">I'm happy to provide a complimentary home value consultation. Just reply to this email or call me directly.</p>
      </div>

      <p>I'll be sending you more insights about the ${lead.town} market over the coming weeks. In the meantime, feel free to reach out if you have any questions.</p>

      <p>Best regards,</p>
      <p><strong>Steven Frato</strong><br>
      Century 21<br>
      (609) 789-0126<br>
      sf@stevenfrato.com</p>
    </div>

    <div style="border-top: 1px solid #ddd; padding: 20px; font-size: 12px; color: #666; text-align: center;">
      <p style="margin: 0 0 10px;">136 Farnsworth Ave, Bordentown, NJ 08505</p>
      <p style="margin: 0 0 10px;">You're receiving this email because you requested a market report from stevenfrato.com</p>
      <p style="margin: 0;"><a href="${unsubscribeUrl}" style="color: #999;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>
  `;

  const textBody = `
Your ${lead.town} Market Report is Ready

Hi ${lead.name},

Thank you for your interest in the ${lead.town}, NJ real estate market. I've prepared a personalized market analysis based on your property at:

${fullAddress}

DOWNLOAD YOUR REPORT: ${pdfUrl}

What's in Your Report:
- Current market conditions for ${lead.town} (${lead.zipcode})
- Median sale price and year-over-year trends
- Days on market and inventory levels
- Whether it's a buyer's or seller's market

Want to discuss your options? I'm happy to provide a complimentary home value consultation. Just reply to this email or call me directly.

I'll be sending you more insights about the ${lead.town} market over the coming weeks. In the meantime, feel free to reach out if you have any questions.

Best regards,
Steven Frato
Century 21
(609) 789-0126
sf@stevenfrato.com

---
136 Farnsworth Ave, Bordentown, NJ 08505
Unsubscribe: ${unsubscribeUrl}
  `.trim();

  try {
    const command = new SendEmailCommand({
      Source: `Steven Frato <${SES_SENDER_EMAIL}>`,
      Destination: {
        ToAddresses: [lead.email],
      },
      Message: {
        Subject: {
          Data: `Your ${lead.town} Market Report is Ready`,
          Charset: "UTF-8",
        },
        Body: {
          Html: { Data: htmlBody, Charset: "UTF-8" },
          Text: { Data: textBody, Charset: "UTF-8" },
        },
      },
      ReplyToAddresses: [STEVEN_EMAIL],
      ConfigurationSetName: SES_CONFIGURATION_SET,
    });

    const result = await sesClient.send(command);
    return result.MessageId ?? null;
  } catch (error) {
    console.error("Failed to send welcome email:", error);
    return null;
  }
}

// Qualification data interface for lead notification
interface QualificationNotificationData {
  intent: string;
  timeline?: string;
  propertyType?: string;
  valueRange?: string;
  budgetRange?: string;
  importantFactor?: string;
  preApproved?: boolean | null;
  contactPreference?: string;
  leadScore: number;
  leadTemperature: LeadTemperature;
  leadPriority: LeadPriority;
}

// Temperature display config
const temperatureConfig: Record<LeadTemperature, { emoji: string; label: string; action: string; color: string; bgColor: string }> = {
  hot: {
    emoji: '🔥',
    label: 'HOT LEAD',
    action: 'CALL NOW',
    color: '#E53935',
    bgColor: 'rgba(229, 57, 53, 0.1)',
  },
  warm: {
    emoji: '🟠',
    label: 'Warm Lead',
    action: 'Follow Up Today',
    color: '#FB8C00',
    bgColor: 'rgba(251, 140, 0, 0.1)',
  },
  nurture: {
    emoji: '🟡',
    label: 'Nurture Lead',
    action: 'Add to Drip',
    color: '#F9A825',
    bgColor: 'rgba(249, 168, 37, 0.1)',
  },
  cold: {
    emoji: '⚪',
    label: 'Cold Lead',
    action: 'Auto-Nurture',
    color: '#9E9E9E',
    bgColor: 'rgba(158, 158, 158, 0.1)',
  },
};

// Format timeline for display
function formatTimeline(timeline: string | undefined): string {
  if (!timeline) return 'Not specified';
  const labels: Record<string, string> = {
    'within-30-days': 'Within 30 days',
    '1-3-months': '1-3 months',
    '3-6-months': '3-6 months',
    '6-plus-months': '6+ months',
  };
  return labels[timeline] || timeline;
}

// Format intent for display
function formatIntent(intent: string): string {
  const labels: Record<string, string> = {
    'selling': 'Selling a Home',
    'buying': 'Buying a Home',
    'both': 'Buying & Selling',
    'home-value': 'Home Value Inquiry',
    'browsing': 'Just Browsing',
  };
  return labels[intent] || intent;
}

// Send lead notification to Steven
async function sendLeadNotification(
  lead: { email: string; name: string; phone?: string; address: string; town: string; zipcode: string },
  interestType: string,
  sourceUrl: string,
  qualification?: QualificationNotificationData
): Promise<void> {
  const submittedAt = new Date().toLocaleString("en-US", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/New_York",
  });

  const interestLabel = {
    selling: "Selling a Home",
    buying: "Buying a Home",
    both: "Buying & Selling",
    investment: "Investment Property",
    consultation: "General Consultation",
  }[interestType] || interestType;

  // Get temperature config if qualification data is provided
  const hasQualification = qualification && qualification.leadTemperature;
  const config = hasQualification ? temperatureConfig[qualification.leadTemperature] : null;

  // Build subject line based on lead temperature
  const subject = hasQualification && qualification.leadTemperature === 'hot'
    ? `🔥 HOT LEAD: ${lead.name} - ${lead.town || 'NJ'} (Score: ${qualification.leadScore})`
    : hasQualification
    ? `${config?.emoji} New Lead: ${lead.name} - ${lead.town || 'NJ'} (Score: ${qualification.leadScore})`
    : `New Lead: ${lead.name} - ${lead.town}, NJ ${lead.zipcode}`;

  // Build qualification section HTML
  let qualificationHtml = '';
  if (hasQualification) {
    qualificationHtml = `
    <!-- Lead Score Section -->
    <div style="text-align: center; padding: 20px; border-bottom: 1px solid #eee; background: ${config?.bgColor || '#f5f5f5'};">
      <div style="font-size: 48px; margin-bottom: 10px;">${config?.emoji || '📧'}</div>
      <div style="display: inline-block; background: ${config?.color || '#666'}; color: #ffffff; padding: 8px 20px; border-radius: 20px; font-size: 14px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">
        ${config?.label || 'NEW LEAD'} - ${config?.action || 'Review'}
      </div>
      <div style="margin-top: 15px;">
        <span style="font-size: 36px; font-weight: bold; color: ${config?.color || '#666'};">${qualification.leadScore}</span>
        <span style="font-size: 14px; color: #666;"> / 100</span>
      </div>
    </div>

    <!-- Qualification Details -->
    <div style="padding: 25px; border-bottom: 2px solid #C99C33;">
      <h3 style="color: #C99C33; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 15px;">Qualification Details</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="color: #666; padding: 8px 0; width: 120px;">Intent:</td>
          <td style="color: #1a1a1a; font-weight: 500; padding: 8px 0;">${formatIntent(qualification.intent)}</td>
        </tr>
        <tr>
          <td style="color: #666; padding: 8px 0;">Timeline:</td>
          <td style="color: #1a1a1a; font-weight: 500; padding: 8px 0;">
            ${formatTimeline(qualification.timeline)}
            ${qualification.timeline === 'within-30-days' ? '<span style="background: rgba(229, 57, 53, 0.1); color: #E53935; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-left: 8px;">URGENT</span>' : ''}
          </td>
        </tr>
        ${qualification.propertyType ? `
        <tr>
          <td style="color: #666; padding: 8px 0;">Property Type:</td>
          <td style="color: #1a1a1a; font-weight: 500; padding: 8px 0;">${qualification.propertyType}</td>
        </tr>
        ` : ''}
        ${qualification.valueRange ? `
        <tr>
          <td style="color: #666; padding: 8px 0;">Value Range:</td>
          <td style="color: #1a1a1a; font-weight: 500; padding: 8px 0;">${qualification.valueRange}</td>
        </tr>
        ` : ''}
        ${qualification.budgetRange ? `
        <tr>
          <td style="color: #666; padding: 8px 0;">Budget:</td>
          <td style="color: #1a1a1a; font-weight: 500; padding: 8px 0;">${qualification.budgetRange}</td>
        </tr>
        ` : ''}
        ${qualification.importantFactor ? `
        <tr>
          <td style="color: #666; padding: 8px 0;">Priority:</td>
          <td style="color: #1a1a1a; font-weight: 500; padding: 8px 0;">${qualification.importantFactor}</td>
        </tr>
        ` : ''}
        ${qualification.preApproved !== null && qualification.preApproved !== undefined ? `
        <tr>
          <td style="color: #666; padding: 8px 0;">Pre-Approved:</td>
          <td style="color: #1a1a1a; font-weight: 500; padding: 8px 0;">${qualification.preApproved ? 'Yes' : 'Not yet'}</td>
        </tr>
        ` : ''}
        ${qualification.contactPreference ? `
        <tr>
          <td style="color: #666; padding: 8px 0;">Best Time:</td>
          <td style="color: #1a1a1a; font-weight: 500; padding: 8px 0;">
            ${qualification.contactPreference}
            ${qualification.contactPreference === 'asap' ? '<span style="background: rgba(76, 175, 80, 0.1); color: #4CAF50; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-left: 8px;">Ready to Talk</span>' : ''}
          </td>
        </tr>
        ` : ''}
      </table>
    </div>

    <!-- Recommended Action -->
    <div style="padding: 20px 25px; background: ${config?.bgColor || '#f5f5f5'};">
      <p style="margin: 0; font-weight: 600; color: ${config?.color || '#333'};">
        ${qualification.leadTemperature === 'hot'
          ? `🔥 HOT LEAD - Call ${lead.phone ? 'at ' + lead.phone : 'immediately'}!`
          : qualification.leadTemperature === 'warm'
          ? '🟠 Follow up today with a personal call or email.'
          : qualification.leadTemperature === 'nurture'
          ? '🟡 Added to drip campaign. Consider personal touch in a few weeks.'
          : '⚪ Added to auto-nurture sequence.'}
      </p>
    </div>
    `;
  }

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f6f6f6;">
  <div style="background: #ffffff; border-radius: 8px; overflow: hidden; ${hasQualification ? `border-top: 4px solid ${config?.color || '#C99C33'};` : ''}">
    ${hasQualification ? qualificationHtml : `
    <div style="text-align: center; padding: 25px; background: #1a1a1a;">
      <span style="display: inline-block; background: #4CAF50; color: #ffffff; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: bold; letter-spacing: 1px;">NEW LEAD</span>
      <h1 style="color: #ffffff; margin: 15px 0 5px; font-size: 24px;">Market Report Request</h1>
      <p style="color: #999; margin: 0; font-size: 14px;">${submittedAt}</p>
    </div>
    `}

    <div style="padding: 25px; border-bottom: 2px solid #C99C33;">
      <h3 style="color: #C99C33; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 15px;">Contact Information</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="color: #666; padding: 8px 0; width: 100px;">Name:</td>
          <td style="color: #1a1a1a; font-weight: 600; padding: 8px 0; font-size: 18px;">${lead.name}</td>
        </tr>
        <tr>
          <td style="color: #666; padding: 8px 0;">Email:</td>
          <td style="padding: 8px 0;"><a href="mailto:${lead.email}" style="color: #C99C33; text-decoration: none;">${lead.email}</a></td>
        </tr>
        ${lead.phone ? `
        <tr>
          <td style="color: #666; padding: 8px 0;">Phone:</td>
          <td style="padding: 8px 0;">
            <a href="tel:${lead.phone}" style="color: #C99C33; text-decoration: none; font-weight: 500;">${lead.phone}</a>
            ${hasQualification && qualification.leadTemperature === 'hot' ? `
            <a href="tel:${lead.phone}" style="display: inline-block; background: #4CAF50; color: white; padding: 6px 12px; border-radius: 4px; text-decoration: none; font-size: 12px; font-weight: 600; margin-left: 10px;">CALL NOW</a>
            ` : ''}
          </td>
        </tr>
        ` : ""}
        ${!hasQualification ? `
        <tr>
          <td style="color: #666; padding: 8px 0;">Interest:</td>
          <td style="padding: 8px 0;"><span style="background: #f5f5f5; padding: 4px 10px; border-radius: 4px; font-size: 14px;">${interestLabel}</span></td>
        </tr>
        ` : ''}
      </table>
    </div>

    <div style="padding: 25px; border-bottom: 2px solid #C99C33;">
      <h3 style="color: #C99C33; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 15px;">Property Details</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="color: #666; padding: 8px 0; width: 100px;">Address:</td>
          <td style="color: #1a1a1a; font-weight: 500; padding: 8px 0;">${lead.address}</td>
        </tr>
        <tr>
          <td style="color: #666; padding: 8px 0;">Town:</td>
          <td style="color: #1a1a1a; font-weight: 500; padding: 8px 0;">${lead.town}</td>
        </tr>
        <tr>
          <td style="color: #666; padding: 8px 0;">Zip Code:</td>
          <td style="color: #1a1a1a; font-weight: 500; padding: 8px 0;">${lead.zipcode}</td>
        </tr>
      </table>
    </div>

    <div style="padding: 15px 25px; border-top: 1px solid #eee;">
      <p style="margin: 0; font-size: 13px; color: #666;">
        Source: <a href="${sourceUrl}" style="color: #C99C33;">${sourceUrl}</a>
      </p>
      <p style="margin: 5px 0 0; font-size: 13px; color: #999;">${submittedAt}</p>
    </div>
  </div>

  <p style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">
    Lead notification from stevenfrato.com
  </p>
</body>
</html>
  `;

  try {
    const command = new SendEmailCommand({
      Source: `Lead Notifications <${SES_SENDER_EMAIL}>`,
      Destination: {
        ToAddresses: [STEVEN_EMAIL],
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: "UTF-8",
        },
        Body: {
          Html: { Data: htmlBody, Charset: "UTF-8" },
        },
      },
      ReplyToAddresses: [lead.email],
    });

    await sesClient.send(command);
    console.log(`Lead notification sent to Steven (${hasQualification ? qualification.leadTemperature : 'no score'})`);
  } catch (error) {
    console.error("Failed to send lead notification:", error);
  }
}

// Main handler
serve(async (req) => {
  // Handle CORS preflight
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

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const payload: FormSubmissionPayload = await req.json();

    // Validate required fields
    if (!payload.email || !payload.name) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: email and name" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // SECURITY: sanitize user-controlled fields before they flow into email HTML
    // bodies and SES subject lines. Prevents HTML/script injection into the agent's
    // inbox (e.g. name='<img onerror=...>') and CR/LF header injection in subjects.
    // Strip angle brackets + control chars and cap length; applied once at ingestion
    // so every downstream template and the DB insert use the safe values.
    const sanitizeField = (s: string | undefined, max = 200): string =>
      (s ?? "")
        .replace(/[<>]/g, "")
        .replace(/[\r\n\t]+/g, " ")
        .trim()
        .slice(0, max);
    payload.name = sanitizeField(payload.name, 80);
    payload.address = sanitizeField(payload.address, 160);
    payload.town = sanitizeField(payload.town, 80);
    payload.zipcode = sanitizeField(payload.zipcode, 10);
    payload.email = sanitizeField(payload.email, 160);
    if (payload.phone) payload.phone = sanitizeField(payload.phone, 30);

    console.log("Processing form submission for:", payload.email);

    // Small retry helper for transient Supabase failures (best-effort, additive).
    const withRetry = async (
      label: string,
      fn: () => Promise<{ data?: unknown; error: unknown }>,
      attempts = 3
    ): Promise<any> => {
      let last: any = { error: new Error("not run") };
      for (let i = 0; i < attempts; i++) {
        last = await fn();
        if (!last.error) return last;
        console.error(`${label} attempt ${i + 1}/${attempts} failed:`, last.error);
        await new Promise((r) => setTimeout(r, 150 * (i + 1)));
      }
      return last;
    };

    // Check for existing lead. Handling happens further down, once interest type,
    // zip data and the lead score have been derived — a repeat submission updates
    // the existing record rather than being discarded (see "Existing lead" below).
    const { data: existingLead } = await supabase
      .from("leads")
      .select("id, status, name, created_at, current_step, interest_type, campaign_id")
      .ilike("email", payload.email)
      .single();

    // Determine interest type - prefer new intent field, fall back to interest
    const intent = payload.intent || payload.interest || "selling";
    // Map new intent values to old interest_type enum
    const intentToInterestMap: Record<string, string> = {
      'selling': 'selling',
      'buying': 'buying',
      'both': 'both',
      'home-value': 'selling',  // Home value seekers are potential sellers
      'browsing': 'consultation',
    };
    const interestType = intentToInterestMap[intent] || intent;
    const validInterestTypes = ["selling", "buying", "both", "investment", "consultation"];
    const finalInterestType = validInterestTypes.includes(interestType) ? interestType : "selling";

    // Determine source URL
    const sourceUrl = payload["source-location"]
      ? `${SITE_URL}/market/${payload["source-location"]}/`
      : `${SITE_URL}/market/${payload.zipcode}/`;

    // Look up zipcode data
    let zipData: ZipcodeData | null = null;
    if (payload.zipcode) {
      const { data } = await supabase
        .from("zipcode_data")
        .select("*")
        .eq("zipcode", payload.zipcode)
        .single();
      zipData = data;
    }

    // Determine county from zipcode data or default
    const county = zipData?.county || "Burlington County";

    // Calculate lead score from qualification data
    const preApprovedValue = payload["pre-approved"] === "yes" ? true :
                             payload["pre-approved"] === "no" ? false :
                             payload["pre-approved"] === "cash" ? true : null;

    const leadScoreData = calculateLeadScore({
      intent: payload.intent,
      timeline: payload.timeline,
      propertyType: payload["property-type"],
      valueRange: payload["value-range"],
      budgetRange: payload["budget-range"],
      importantFactor: payload["important-factor"],
      preApproved: preApprovedValue,
      contactPreference: payload["contact-preference"],
    });

    // Use client-calculated score if provided, otherwise use server calculation
    const finalLeadScore = payload["lead-score"]
      ? parseInt(payload["lead-score"], 10)
      : leadScoreData.score;
    const finalLeadTemperature = (payload["lead-temperature"] as LeadTemperature) || leadScoreData.temperature;
    const finalLeadPriority = leadScoreData.priority;

    console.log(`Lead score calculated: ${finalLeadScore} (${finalLeadTemperature})`);

    // ---------------------------------------------------------------------
    // Existing lead: update, don't discard.
    //
    // This previously returned `{duplicate: true}` and did nothing else, which
    // threw away two valuable signals: the second step of the exit-intent popup
    // (which submits qualification moments after the email), and a past lead
    // coming back to re-submit — one of the strongest buying signals there is.
    // ---------------------------------------------------------------------
    if (existingLead) {
      const ageMs = Date.now() - new Date(existingLead.created_at).getTime();

      // The popup's step 2 lands within seconds of step 1. Treat anything inside
      // 30 minutes on an un-progressed lead as completing that same signup
      // rather than as a returning visitor.
      const isQualificationFollowUp =
        (payload.qualify === true || payload.qualify === "1") &&
        ageMs < 30 * 60 * 1000 &&
        (existingLead.current_step ?? 0) <= 1;

      // Only overwrite columns this submission actually carries — a step-2 post
      // that skipped the timeline question must not blank an existing value.
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (payload.timeline) updates.timeline = payload.timeline;
      if (payload["property-type"]) updates.property_type = payload["property-type"];
      if (payload["value-range"]) updates.value_range = payload["value-range"];
      if (payload["budget-range"]) updates.budget_range = payload["budget-range"];
      if (payload["important-factor"]) updates.important_factor = payload["important-factor"];
      if (payload["contact-preference"]) updates.contact_preference = payload["contact-preference"];
      if (preApprovedValue !== null) updates.pre_approved = preApprovedValue;
      if (payload.phone) updates.phone = payload.phone;
      if (payload.address) updates.address = payload.address;
      if (payload.town || zipData?.town) updates.town = payload.town || zipData?.town;
      if (payload.zipcode) updates.zipcode = payload.zipcode;
      // "Website Visitor" is the popup's step-1 placeholder — never let it
      // overwrite a real name we already hold.
      if (payload.name && payload.name !== "Website Visitor") updates.name = payload.name;

      // An explicit new intent wins; the "selling" default must not silently
      // re-categorise someone who told us otherwise earlier.
      const intentWasStated = Boolean(payload.intent || payload.interest);
      if (intentWasStated) updates.interest_type = finalInterestType;

      // The auto_calculate_lead_score BEFORE UPDATE trigger recomputes
      // lead_score/temperature/priority from these columns, so we don't set them.
      const { error: updateError } = await withRetry("existing lead update", () =>
        supabase.from("leads").update(updates).eq("id", existingLead.id).select("id")
      );
      if (updateError) {
        console.error("Failed to update existing lead:", existingLead.id, updateError);
      }

      const interestChanged =
        intentWasStated && finalInterestType !== existingLead.interest_type;

      // Re-campaign only during the signup window. Past that, the lead is
      // mid-drip and swapping campaigns would re-send emails they've had.
      let rescheduled = 0;
      if (isQualificationFollowUp && interestChanged) {
        rescheduled = await recampaignLead(existingLead.id, finalInterestType, existingLead.created_at);
      }

      // Ping Steven for a genuine return visit — but not for step 2 of a signup
      // he was already notified about seconds ago.
      if (!isQualificationFollowUp) {
        const { data: refreshed } = await supabase
          .from("leads")
          .select("lead_score, lead_temperature, lead_priority, town, zipcode")
          .eq("id", existingLead.id)
          .single();

        try {
          await sendLeadNotification(
            {
              email: payload.email,
              name: (updates.name as string) || existingLead.name,
              phone: payload.phone,
              address: payload.address || "Not provided",
              town: payload.town || refreshed?.town || zipData?.town || "Not provided",
              zipcode: payload.zipcode || refreshed?.zipcode || "Not provided",
            },
            intentWasStated ? finalInterestType : existingLead.interest_type,
            `${sourceUrl} (returning lead — re-submitted)`,
            {
              intent: payload.intent || finalInterestType,
              timeline: payload.timeline,
              propertyType: payload["property-type"],
              valueRange: payload["value-range"],
              budgetRange: payload["budget-range"],
              importantFactor: payload["important-factor"],
              preApproved: preApprovedValue,
              contactPreference: payload["contact-preference"],
              leadScore: refreshed?.lead_score ?? finalLeadScore,
              leadTemperature: refreshed?.lead_temperature ?? finalLeadTemperature,
              leadPriority: refreshed?.lead_priority ?? finalLeadPriority,
            }
          );
        } catch (notifyErr) {
          console.error("Returning-lead notification failed:", notifyErr);
        }

        // Leave a trail so behaviour triggers can see the re-engagement.
        await supabase.from("lead_activity").insert({
          lead_id: existingLead.id,
          event_type: "resubmit",
          path: payload["source-location"] || "form",
          town: payload.town || zipData?.town || null,
          zipcode: payload.zipcode || null,
          county: zipData?.county || null,
          metadata: { status: existingLead.status },
        });
      }

      // Unsubscribed/bounced leads are updated and reported, but never
      // re-enrolled — re-subscribing someone who opted out is not ours to do.
      if (existingLead.status !== "active") {
        console.log(
          `Existing ${existingLead.status} lead ${existingLead.id} re-submitted — updated, not re-enrolled.`
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: isQualificationFollowUp ? "Lead qualification updated" : "Lead updated",
          lead_id: existingLead.id,
          lead_token: await createToken("visitor", existingLead.id),
          duplicate: true,
          qualification_update: isQualificationFollowUp,
          emails_rescheduled: rescheduled,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Insert lead (campaign will be auto-assigned via trigger)
    const { data: newLead, error: insertError } = await withRetry("lead insert", () => supabase
      .from("leads")
      .insert({
        email: payload.email.toLowerCase().trim(),
        name: payload.name,
        phone: payload.phone || null,
        address: payload.address || null,
        town: payload.town || zipData?.town || null,
        zipcode: payload.zipcode || null,
        county: county,
        interest_type: finalInterestType,
        source_url: sourceUrl,
        utm_source: payload.utm_source || null,
        utm_medium: payload.utm_medium || null,
        utm_campaign: payload.utm_campaign || null,
        status: "active",
        // Qualification fields
        timeline: payload.timeline || null,
        property_type: payload["property-type"] || null,
        value_range: payload["value-range"] || null,
        budget_range: payload["budget-range"] || null,
        pre_approved: preApprovedValue,
        important_factor: payload["important-factor"] || null,
        contact_preference: payload["contact-preference"] || null,
        lead_score: finalLeadScore,
        lead_temperature: finalLeadTemperature,
        lead_priority: finalLeadPriority,
      })
      .select("id, campaign_id, lead_score, lead_temperature, lead_priority")
      .single());

    if (insertError) {
      console.error("Failed to insert lead:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create lead", details: insertError.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("Lead created:", newLead.id);

    // Get campaign steps for scheduling
    const { data: campaignSteps, error: stepsError } = await supabase
      .from("campaign_steps")
      .select("id, step_number, template_id, subject_template, delay_days, send_hour")
      .eq("campaign_id", newLead.campaign_id)
      .order("step_number", { ascending: true });

    if (stepsError || !campaignSteps?.length) {
      console.error("Failed to get campaign steps:", stepsError);
    }

    // Schedule all campaign emails
    const signupDate = new Date();
    const scheduledEmails: Array<{
      lead_id: string;
      campaign_step_id: string;
      scheduled_for: string;
      status: string;
    }> = [];

    let welcomeEmailSesId: string | null = null;

    for (const step of campaignSteps || []) {
      const scheduledFor = calculateScheduledTime(signupDate, step.delay_days, step.send_hour);

      scheduledEmails.push({
        lead_id: newLead.id,
        campaign_step_id: step.id,
        scheduled_for: scheduledFor.toISOString(),
        status: step.delay_days === 0 ? "sending" : "pending",
      });
    }

    // Insert scheduled emails
    if (scheduledEmails.length > 0) {
      const { error: scheduleError } = await withRetry("scheduled_emails insert", () =>
        supabase.from("scheduled_emails").insert(scheduledEmails)
      );

      if (scheduleError) {
        console.error(
          "ALERT: failed to schedule drip emails after retries — drip NOT scheduled for lead",
          newLead.id, scheduleError
        );
      } else {
        console.log(`Scheduled ${scheduledEmails.length} emails for lead ${newLead.id}`);
      }
    }

    // Generate unsubscribe URL
    const unsubscribeUrl = await generateUnsubscribeUrl(newLead.id);

    // Send welcome email immediately (step 1)
    if (payload.address && payload.town && payload.zipcode) {
      welcomeEmailSesId = await sendWelcomeEmail(
        {
          email: payload.email,
          name: payload.name,
          address: payload.address,
          town: payload.town,
          zipcode: payload.zipcode,
        },
        zipData,
        unsubscribeUrl
      );

      // Update the first scheduled email with the SES message ID
      if (welcomeEmailSesId && scheduledEmails.length > 0) {
        const firstEmail = scheduledEmails[0];
        await supabase
          .from("scheduled_emails")
          .update({
            status: "sent",
            ses_message_id: welcomeEmailSesId,
            sent_at: new Date().toISOString(),
          })
          .eq("lead_id", newLead.id)
          .eq("campaign_step_id", firstEmail.campaign_step_id);

        // Update lead's current step and next email time
        const nextStep = campaignSteps?.find((s) => s.step_number === 2);
        if (nextStep) {
          const nextEmailAt = calculateScheduledTime(signupDate, nextStep.delay_days, nextStep.send_hour);
          await supabase
            .from("leads")
            .update({
              current_step: 1,
              next_email_at: nextEmailAt.toISOString(),
            })
            .eq("id", newLead.id);
        }
      }
    }

    // If the immediate welcome email was NOT sent (missing address/town/zip — now
    // possible since those are optional — or a send failure), reset its day-0
    // scheduled row from "sending" back to "pending" so the cron retries it instead
    // of orphaning it in "sending" forever.
    if (!welcomeEmailSesId && scheduledEmails.length > 0) {
      const firstEmail = scheduledEmails[0];
      await supabase
        .from("scheduled_emails")
        .update({ status: "pending" })
        .eq("lead_id", newLead.id)
        .eq("campaign_step_id", firstEmail.campaign_step_id)
        .eq("status", "sending");
    }

    // Send lead notification to Steven (retry once; never fail the request — the
    // lead is already saved). On persistent failure, log loudly for monitoring.
    let leadNotified = false;
    for (let nAttempt = 0; nAttempt < 2 && !leadNotified; nAttempt++) {
      try {
        await sendLeadNotification(
          {
            email: payload.email,
            name: payload.name,
            phone: payload.phone,
            address: payload.address || "Not provided",
            town: payload.town || zipData?.town || "Not provided",
            zipcode: payload.zipcode || "Not provided",
          },
          finalInterestType,
          sourceUrl,
          {
            intent: payload.intent || finalInterestType,
            timeline: payload.timeline,
            propertyType: payload["property-type"],
            valueRange: payload["value-range"],
            budgetRange: payload["budget-range"],
            importantFactor: payload["important-factor"],
            preApproved: preApprovedValue,
            contactPreference: payload["contact-preference"],
            leadScore: newLead.lead_score || finalLeadScore,
            leadTemperature: newLead.lead_temperature || finalLeadTemperature,
            leadPriority: newLead.lead_priority || finalLeadPriority,
          }
        );
        leadNotified = true;
      } catch (notifyErr) {
        console.error(`Lead notification attempt ${nAttempt + 1} failed:`, notifyErr);
      }
    }
    if (!leadNotified) {
      console.error(
        "ALERT: lead notification FAILED after retries for lead", newLead.id,
        `(${finalLeadTemperature}) — Steven was NOT pinged; reconcile manually.`
      );
      // TODO(reliability): alert a secondary channel (SNS / webhook / backup SES) for HOT leads.
    }

    // Get campaign slug for response
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("slug")
      .eq("id", newLead.campaign_id)
      .single();

    return new Response(
      JSON.stringify({
        success: true,
        lead_id: newLead.id,
        // Opaque signed handle for the browser. The raw UUID must never leave
        // the server — this is what the client stores and replays for step 2 of
        // the popup and for activity tracking.
        lead_token: await createToken("visitor", newLead.id),
        campaign_slug: campaign?.slug || "unknown",
        emails_scheduled: scheduledEmails.length,
        welcome_email_sent: !!welcomeEmailSesId,
        lead_score: newLead.lead_score || finalLeadScore,
        lead_temperature: newLead.lead_temperature || finalLeadTemperature,
        lead_priority: newLead.lead_priority || finalLeadPriority,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("Error processing form submission:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
