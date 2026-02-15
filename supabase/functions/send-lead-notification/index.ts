/**
 * Send Lead Notification Edge Function
 *
 * Sends enhanced lead notifications to Steven with:
 * - Temperature badge (🔥 HOT, 🟠 WARM, 🟡 NURTURE, ⚪ COLD)
 * - Lead score and priority
 * - Qualification details
 * - Recommended follow-up action
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SESClient, SendEmailCommand } from "npm:@aws-sdk/client-ses";

// Types
interface LeadNotificationPayload {
  // Contact info
  email: string;
  name: string;
  phone?: string;
  address?: string;
  town?: string;
  zipcode?: string;

  // Qualification data
  intent: string;
  timeline: string;
  propertyType?: string;
  valueRange?: string;
  budgetRange?: string;
  importantFactor?: string;
  preApproved?: boolean;
  contactPreference?: string;

  // Scoring
  leadScore: number;
  leadTemperature: 'hot' | 'warm' | 'nurture' | 'cold';
  leadPriority: 'immediate' | 'same-day' | 'nurture' | 'drip';

  // Source
  sourceUrl?: string;
}

// Environment variables
const AWS_ACCESS_KEY_ID = Deno.env.get("AWS_ACCESS_KEY_ID")!;
const AWS_SECRET_ACCESS_KEY = Deno.env.get("AWS_SECRET_ACCESS_KEY")!;
const AWS_REGION = Deno.env.get("AWS_REGION") || "us-east-1";
const SES_SENDER_EMAIL = Deno.env.get("SES_SENDER_EMAIL") || "reports@stevenfrato.com";
const STEVEN_EMAIL = "sf@stevenfrato.com";

// Initialize SES client
const sesClient = new SESClient({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

// Temperature display config
const temperatureConfig = {
  hot: {
    emoji: '🔥',
    label: 'HOT LEAD',
    action: 'CALL NOW',
    color: '#E53935',
    bgColor: 'rgba(229, 57, 53, 0.1)',
    borderColor: '#E53935',
  },
  warm: {
    emoji: '🟠',
    label: 'Warm Lead',
    action: 'Follow Up Today',
    color: '#FB8C00',
    bgColor: 'rgba(251, 140, 0, 0.1)',
    borderColor: '#FB8C00',
  },
  nurture: {
    emoji: '🟡',
    label: 'Nurture Lead',
    action: 'Add to Drip',
    color: '#F9A825',
    bgColor: 'rgba(249, 168, 37, 0.1)',
    borderColor: '#F9A825',
  },
  cold: {
    emoji: '⚪',
    label: 'Cold Lead',
    action: 'Auto-Nurture Only',
    color: '#9E9E9E',
    bgColor: 'rgba(158, 158, 158, 0.1)',
    borderColor: '#9E9E9E',
  },
};

// Format helpers
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

function formatTimeline(timeline: string): string {
  const labels: Record<string, string> = {
    'within-30-days': 'Within 30 days',
    '1-3-months': '1-3 months',
    '3-6-months': '3-6 months',
    '6-plus-months': '6+ months',
  };
  return labels[timeline] || timeline;
}

function formatPropertyType(type: string): string {
  const labels: Record<string, string> = {
    'single-family': 'Single Family',
    'condo': 'Condo',
    'townhouse': 'Townhouse',
    'multi-family': 'Multi-Family',
  };
  return labels[type] || type;
}

function formatImportantFactor(factor: string): string {
  const labels: Record<string, string> = {
    'speed': 'Speed (Sell Quickly)',
    'price': 'Price (Maximize Value)',
    'convenience': 'Convenience (Minimal Hassle)',
  };
  return labels[factor] || factor;
}

function formatContactPreference(pref: string): string {
  const labels: Record<string, string> = {
    'asap': 'ASAP',
    'morning': 'Morning',
    'afternoon': 'Afternoon',
    'evening': 'Evening',
  };
  return labels[pref] || pref;
}

// Generate the notification email
function generateNotificationEmail(lead: LeadNotificationPayload): { subject: string; html: string } {
  const config = temperatureConfig[lead.leadTemperature];
  const submittedAt = new Date().toLocaleString("en-US", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/New_York",
  });

  const isSellerIntent = ['selling', 'both', 'home-value'].includes(lead.intent);

  // Build qualification details rows
  const qualificationRows: string[] = [];

  qualificationRows.push(`
    <tr>
      <td style="color: #666; padding: 8px 0; width: 140px;">Interest:</td>
      <td style="color: #1a1a1a; font-weight: 500; padding: 8px 0;">${formatIntent(lead.intent)}</td>
    </tr>
    <tr>
      <td style="color: #666; padding: 8px 0;">Timeline:</td>
      <td style="color: #1a1a1a; font-weight: 500; padding: 8px 0;">
        ${formatTimeline(lead.timeline)}
        ${lead.timeline === 'within-30-days' ? '<span style="background: rgba(229, 57, 53, 0.1); color: #E53935; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-left: 8px;">URGENT</span>' : ''}
      </td>
    </tr>
  `);

  if (lead.propertyType) {
    qualificationRows.push(`
      <tr>
        <td style="color: #666; padding: 8px 0;">Property Type:</td>
        <td style="color: #1a1a1a; font-weight: 500; padding: 8px 0;">${formatPropertyType(lead.propertyType)}</td>
      </tr>
    `);
  }

  if (lead.valueRange) {
    qualificationRows.push(`
      <tr>
        <td style="color: #666; padding: 8px 0;">Value Range:</td>
        <td style="color: #1a1a1a; font-weight: 500; padding: 8px 0;">${lead.valueRange}</td>
      </tr>
    `);
  }

  if (lead.budgetRange) {
    qualificationRows.push(`
      <tr>
        <td style="color: #666; padding: 8px 0;">Budget Range:</td>
        <td style="color: #1a1a1a; font-weight: 500; padding: 8px 0;">${lead.budgetRange}</td>
      </tr>
    `);
  }

  if (lead.importantFactor) {
    qualificationRows.push(`
      <tr>
        <td style="color: #666; padding: 8px 0;">Priority:</td>
        <td style="color: #1a1a1a; font-weight: 500; padding: 8px 0;">${formatImportantFactor(lead.importantFactor)}</td>
      </tr>
    `);
  }

  if (lead.preApproved !== undefined && lead.preApproved !== null) {
    qualificationRows.push(`
      <tr>
        <td style="color: #666; padding: 8px 0;">Pre-Approved:</td>
        <td style="color: #1a1a1a; font-weight: 500; padding: 8px 0;">
          ${lead.preApproved ? '<span style="color: #4CAF50;">Yes</span>' : '<span style="color: #666;">Not yet</span>'}
        </td>
      </tr>
    `);
  }

  if (lead.contactPreference) {
    qualificationRows.push(`
      <tr>
        <td style="color: #666; padding: 8px 0;">Best Time:</td>
        <td style="color: #1a1a1a; font-weight: 500; padding: 8px 0;">
          ${formatContactPreference(lead.contactPreference)}
          ${lead.contactPreference === 'asap' ? '<span style="background: rgba(76, 175, 80, 0.1); color: #4CAF50; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-left: 8px;">Ready to Talk</span>' : ''}
        </td>
      </tr>
    `);
  }

  const subject = lead.leadTemperature === 'hot'
    ? `🔥 HOT LEAD: ${lead.name} - ${lead.town || 'NJ'} (Score: ${lead.leadScore})`
    : `${config.emoji} New Lead: ${lead.name} - ${lead.town || 'NJ'} (Score: ${lead.leadScore})`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f6f6f6;">
  <div style="background: #ffffff; border-radius: 8px; overflow: hidden; border-top: 4px solid ${config.borderColor};">

    <!-- Temperature Badge Header -->
    <div style="text-align: center; padding: 25px; background: ${config.bgColor};">
      <div style="font-size: 48px; margin-bottom: 10px;">${config.emoji}</div>
      <div style="display: inline-block; background: ${config.color}; color: #ffffff; padding: 8px 20px; border-radius: 20px; font-size: 14px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">
        ${config.label} - ${config.action}
      </div>
      <p style="color: #666; margin: 15px 0 0; font-size: 14px;">${submittedAt}</p>
    </div>

    <!-- Lead Score -->
    <div style="text-align: center; padding: 20px; border-bottom: 1px solid #eee;">
      <div style="display: inline-flex; align-items: center; gap: 15px;">
        <div style="text-align: center;">
          <div style="font-size: 36px; font-weight: bold; color: ${config.color};">${lead.leadScore}</div>
          <div style="font-size: 12px; color: #666; text-transform: uppercase;">Lead Score</div>
        </div>
        <div style="width: 1px; height: 40px; background: #eee;"></div>
        <div style="text-align: center;">
          <div style="font-size: 18px; font-weight: 600; color: #1a1a1a;">${formatTimeline(lead.timeline)}</div>
          <div style="font-size: 12px; color: #666; text-transform: uppercase;">Timeline</div>
        </div>
      </div>
    </div>

    <!-- Contact Information -->
    <div style="padding: 25px; border-bottom: 1px solid #eee;">
      <h3 style="color: #C99C33; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 15px;">Contact Information</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="color: #666; padding: 8px 0; width: 100px;">Name:</td>
          <td style="color: #1a1a1a; font-weight: 600; padding: 8px 0; font-size: 18px;">${lead.name}</td>
        </tr>
        <tr>
          <td style="color: #666; padding: 8px 0;">Email:</td>
          <td style="padding: 8px 0;"><a href="mailto:${lead.email}" style="color: #C99C33; text-decoration: none; font-weight: 500;">${lead.email}</a></td>
        </tr>
        ${lead.phone ? `
        <tr>
          <td style="color: #666; padding: 8px 0;">Phone:</td>
          <td style="padding: 8px 0;">
            <a href="tel:${lead.phone}" style="color: #C99C33; text-decoration: none; font-weight: 500;">${lead.phone}</a>
            ${lead.leadTemperature === 'hot' ? `
            <a href="tel:${lead.phone}" style="display: inline-block; background: #4CAF50; color: white; padding: 6px 12px; border-radius: 4px; text-decoration: none; font-size: 12px; font-weight: 600; margin-left: 10px;">CALL NOW</a>
            ` : ''}
          </td>
        </tr>
        ` : ''}
      </table>
    </div>

    ${isSellerIntent && (lead.address || lead.town) ? `
    <!-- Property Information -->
    <div style="padding: 25px; border-bottom: 1px solid #eee;">
      <h3 style="color: #C99C33; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 15px;">Property Details</h3>
      <table style="width: 100%; border-collapse: collapse;">
        ${lead.address ? `
        <tr>
          <td style="color: #666; padding: 8px 0; width: 100px;">Address:</td>
          <td style="color: #1a1a1a; font-weight: 500; padding: 8px 0;">${lead.address}</td>
        </tr>
        ` : ''}
        ${lead.town ? `
        <tr>
          <td style="color: #666; padding: 8px 0;">Town:</td>
          <td style="color: #1a1a1a; font-weight: 500; padding: 8px 0;">${lead.town}</td>
        </tr>
        ` : ''}
        ${lead.zipcode ? `
        <tr>
          <td style="color: #666; padding: 8px 0;">Zip Code:</td>
          <td style="color: #1a1a1a; font-weight: 500; padding: 8px 0;">${lead.zipcode}</td>
        </tr>
        ` : ''}
      </table>
    </div>
    ` : ''}

    <!-- Qualification Details -->
    <div style="padding: 25px; border-bottom: 1px solid #eee;">
      <h3 style="color: #C99C33; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 15px;">Qualification Details</h3>
      <table style="width: 100%; border-collapse: collapse;">
        ${qualificationRows.join('')}
      </table>
    </div>

    <!-- Recommended Action -->
    <div style="padding: 25px; background: ${config.bgColor};">
      <h3 style="color: ${config.color}; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 10px;">Recommended Action</h3>
      <p style="margin: 0; color: #333; font-size: 15px;">
        ${lead.leadTemperature === 'hot'
          ? `<strong>This is a hot lead!</strong> They're ready to move within 30 days. Call them immediately at ${lead.phone || 'the number provided'}.`
          : lead.leadTemperature === 'warm'
          ? `This lead is actively planning to move in 1-3 months. Follow up today with a personal call or email.`
          : lead.leadTemperature === 'nurture'
          ? `This lead is planning 3-6 months out. They'll receive the automated email sequence. Consider a personal touch in a few weeks.`
          : `This lead is just getting started. They'll receive the automated email sequence to stay top of mind.`
        }
      </p>
    </div>

    ${lead.sourceUrl ? `
    <!-- Source -->
    <div style="padding: 15px 25px; border-top: 1px solid #eee;">
      <p style="margin: 0; font-size: 13px; color: #666;">
        Source: <a href="${lead.sourceUrl}" style="color: #C99C33;">${lead.sourceUrl}</a>
      </p>
    </div>
    ` : ''}
  </div>

  <p style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">
    Lead notification from stevenfrato.com
  </p>
</body>
</html>
  `;

  return { subject, html };
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
    const payload: LeadNotificationPayload = await req.json();

    // Validate required fields
    if (!payload.email || !payload.name || !payload.intent || !payload.timeline) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Generate the notification email
    const { subject, html } = generateNotificationEmail(payload);

    // Send via SES
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
          Html: { Data: html, Charset: "UTF-8" },
        },
      },
      ReplyToAddresses: [payload.email],
    });

    const result = await sesClient.send(command);

    console.log(`Lead notification sent for ${payload.name} (${payload.leadTemperature})`);

    return new Response(
      JSON.stringify({
        success: true,
        messageId: result.MessageId,
        temperature: payload.leadTemperature,
        score: payload.leadScore,
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
    console.error("Error sending lead notification:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to send notification",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
