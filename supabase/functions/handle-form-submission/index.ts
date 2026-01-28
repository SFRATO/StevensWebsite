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

// Helper: Generate unsubscribe URL
function generateUnsubscribeUrl(leadId: string): string {
  // Simple token for now - in production, use signed tokens
  const token = btoa(`${leadId}:${Date.now()}`);
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

// Send lead notification to Steven
async function sendLeadNotification(
  lead: { email: string; name: string; phone?: string; address: string; town: string; zipcode: string },
  interestType: string,
  sourceUrl: string
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

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Lead: ${lead.name}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f6f6f6;">
  <div style="background: #ffffff; border-radius: 8px; overflow: hidden;">
    <div style="text-align: center; padding: 25px; background: #1a1a1a;">
      <span style="display: inline-block; background: #4CAF50; color: #ffffff; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: bold; letter-spacing: 1px;">NEW LEAD</span>
      <h1 style="color: #ffffff; margin: 15px 0 5px; font-size: 24px;">Market Report Request</h1>
      <p style="color: #999; margin: 0; font-size: 14px;">${submittedAt}</p>
    </div>

    <div style="padding: 25px; border-bottom: 2px solid #C99C33;">
      <h3 style="color: #C99C33; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 15px;">Contact Information</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="color: #666; padding: 8px 0; width: 100px;">Name:</td>
          <td style="color: #1a1a1a; font-weight: 500; padding: 8px 0;">${lead.name}</td>
        </tr>
        <tr>
          <td style="color: #666; padding: 8px 0;">Email:</td>
          <td style="padding: 8px 0;"><a href="mailto:${lead.email}" style="color: #C99C33; text-decoration: none;">${lead.email}</a></td>
        </tr>
        ${lead.phone ? `
        <tr>
          <td style="color: #666; padding: 8px 0;">Phone:</td>
          <td style="padding: 8px 0;"><a href="tel:${lead.phone}" style="color: #C99C33; text-decoration: none;">${lead.phone}</a></td>
        </tr>
        ` : ""}
        <tr>
          <td style="color: #666; padding: 8px 0;">Interest:</td>
          <td style="padding: 8px 0;"><span style="background: #f5f5f5; padding: 4px 10px; border-radius: 4px; font-size: 14px;">${interestLabel}</span></td>
        </tr>
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

    <div style="padding: 25px;">
      <h3 style="color: #C99C33; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 15px;">Source</h3>
      <p style="margin: 0;"><a href="${sourceUrl}" style="color: #C99C33; text-decoration: none;">${sourceUrl}</a></p>
    </div>
  </div>

  <p style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">
    This is an automated notification from stevenfrato.com
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
          Data: `New Lead: ${lead.name} - ${lead.town}, NJ ${lead.zipcode}`,
          Charset: "UTF-8",
        },
        Body: {
          Html: { Data: htmlBody, Charset: "UTF-8" },
        },
      },
      ReplyToAddresses: [lead.email],
    });

    await sesClient.send(command);
    console.log("Lead notification sent to Steven");
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

    console.log("Processing form submission for:", payload.email);

    // Check for existing lead
    const { data: existingLead } = await supabase
      .from("leads")
      .select("id, status")
      .ilike("email", payload.email)
      .single();

    if (existingLead) {
      // If lead exists and is active, don't create duplicate
      if (existingLead.status === "active") {
        return new Response(
          JSON.stringify({
            success: true,
            message: "Lead already exists",
            lead_id: existingLead.id,
            duplicate: true,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      // If lead was unsubscribed/bounced, we could reactivate, but for now treat as duplicate
    }

    // Determine interest type
    const interestType = payload.interest || "selling";
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

    // Insert lead (campaign will be auto-assigned via trigger)
    const { data: newLead, error: insertError } = await supabase
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
      })
      .select("id, campaign_id")
      .single();

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
      const { error: scheduleError } = await supabase
        .from("scheduled_emails")
        .insert(scheduledEmails);

      if (scheduleError) {
        console.error("Failed to schedule emails:", scheduleError);
      } else {
        console.log(`Scheduled ${scheduledEmails.length} emails for lead ${newLead.id}`);
      }
    }

    // Generate unsubscribe URL
    const unsubscribeUrl = generateUnsubscribeUrl(newLead.id);

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

    // Send lead notification to Steven
    await sendLeadNotification(
      {
        email: payload.email,
        name: payload.name,
        phone: payload.phone,
        address: payload.address || "Not provided",
        town: payload.town || "Not provided",
        zipcode: payload.zipcode || "Not provided",
      },
      finalInterestType,
      sourceUrl
    );

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
        campaign_slug: campaign?.slug || "unknown",
        emails_scheduled: scheduledEmails.length,
        welcome_email_sent: !!welcomeEmailSesId,
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
