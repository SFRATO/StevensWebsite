/**
 * Trigger Email Sequence
 *
 * Initiates the 5-email nurture campaign for market report leads.
 * Uses Amazon SES for email delivery.
 */

import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

interface EmailSequenceRequest {
  email: string;
  name: string;
  location: string;
  address: string;
  town: string;
  zipcode: string;
  phone?: string;
}

// Initialize SES client
const sesClient = new SESClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

// Verified sender email (must be verified in SES)
const SENDER_EMAIL = process.env.SES_SENDER_EMAIL || "reports@stevenfrato.com";

// Steven's email for lead notifications
const STEVEN_EMAIL = "sf@stevenfrato.com";

// Email sequence configuration
const EMAIL_SEQUENCE = [
  { day: 0, templateId: "welcome-report", subject: "Your {location} Market Report is Ready" },
  { day: 3, templateId: "market-deep-dive", subject: "What {location}'s Market Data Means for You" },
  { day: 7, templateId: "pricing-strategy", subject: "How to Price Your Home in Today's {location} Market" },
  { day: 11, templateId: "preparation-tips", subject: "5 Things {location} Buyers Are Looking For Right Now" },
  { day: 14, templateId: "consultation-cta", subject: "Ready to Discuss Your Options?" },
];

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  // Check for AWS credentials
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.error("AWS credentials not configured");
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Email service not configured" }),
    };
  }

  try {
    const body = JSON.parse(event.body || "{}") as EmailSequenceRequest;

    if (!body.email || !body.location || !body.name) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing required fields" }),
      };
    }

    // Build full property address for display
    const fullAddress = `${body.address}, ${body.town}, NJ ${body.zipcode}`;

    // 1. Send notification email to Steven
    try {
      const notificationCommand = new SendEmailCommand({
        Source: `Lead Notifications <${SENDER_EMAIL}>`,
        Destination: {
          ToAddresses: [STEVEN_EMAIL],
        },
        Message: {
          Subject: {
            Data: `New Lead: ${body.name} - ${body.town}, NJ ${body.zipcode}`,
            Charset: "UTF-8",
          },
          Body: {
            Html: {
              Data: generateLeadNotificationEmail(body, fullAddress),
              Charset: "UTF-8",
            },
            Text: {
              Data: generateLeadNotificationText(body, fullAddress),
              Charset: "UTF-8",
            },
          },
        },
        ReplyToAddresses: [body.email],
      });

      await sesClient.send(notificationCommand);
      console.log("Lead notification sent to Steven for:", body.email);
    } catch (notificationError) {
      console.error("Failed to send lead notification:", notificationError);
      // Don't fail the whole request if notification fails
    }

    // 2. Send the welcome email to the user (with PDF link)
    const firstEmail = EMAIL_SEQUENCE[0];
    const subject = firstEmail.subject.replace("{location}", body.location);

    try {
      const sendCommand = new SendEmailCommand({
        Source: `Steven Frato <${SENDER_EMAIL}>`,
        Destination: {
          ToAddresses: [body.email],
        },
        Message: {
          Subject: {
            Data: subject,
            Charset: "UTF-8",
          },
          Body: {
            Html: {
              Data: generateWelcomeEmail(body, fullAddress),
              Charset: "UTF-8",
            },
            Text: {
              Data: generateWelcomeEmailText(body, fullAddress),
              Charset: "UTF-8",
            },
          },
        },
        ReplyToAddresses: [STEVEN_EMAIL],
      });

      await sesClient.send(sendCommand);
      console.log("Welcome email sent to:", body.email);
    } catch (emailError) {
      console.error("Failed to send welcome email:", emailError);
      // Don't fail the whole request if email fails
    }

    // In a production environment, you would:
    // 1. Store the lead in a database (DynamoDB, etc.)
    // 2. Schedule the remaining emails using:
    //    - AWS EventBridge Scheduler
    //    - AWS Step Functions
    //    - SQS with delay queues
    //    - A cron job service

    // For now, log the sequence that would be triggered
    console.log("Email sequence initiated:", {
      email: body.email,
      location: body.location,
      totalEmails: EMAIL_SEQUENCE.length,
      sequence: EMAIL_SEQUENCE.map((e) => ({
        day: e.day,
        subject: e.subject.replace("{location}", body.location),
      })),
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: "Email sequence initiated",
        email: body.email,
        totalEmails: EMAIL_SEQUENCE.length,
      }),
    };
  } catch (error) {
    console.error("Error triggering email sequence:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to initiate email sequence" }),
    };
  }
};

/**
 * Generate lead notification email HTML for Steven
 */
function generateLeadNotificationEmail(data: EmailSequenceRequest, fullAddress: string): string {
  const submittedAt = new Date().toLocaleString("en-US", {
    dateStyle: "full",
    timeStyle: "short",
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Lead: ${data.name}</title>
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
          <td style="color: #666; padding: 8px 0; width: 80px;">Name:</td>
          <td style="color: #1a1a1a; font-weight: 500; padding: 8px 0;">${data.name}</td>
        </tr>
        <tr>
          <td style="color: #666; padding: 8px 0;">Email:</td>
          <td style="padding: 8px 0;"><a href="mailto:${data.email}" style="color: #C99C33; text-decoration: none;">${data.email}</a></td>
        </tr>
        ${data.phone ? `
        <tr>
          <td style="color: #666; padding: 8px 0;">Phone:</td>
          <td style="padding: 8px 0;"><a href="tel:${data.phone}" style="color: #C99C33; text-decoration: none;">${data.phone}</a></td>
        </tr>
        ` : ""}
      </table>
    </div>

    <div style="padding: 25px; border-bottom: 2px solid #C99C33;">
      <h3 style="color: #C99C33; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 15px;">Property Details</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="color: #666; padding: 8px 0; width: 80px;">Address:</td>
          <td style="color: #1a1a1a; font-weight: 500; padding: 8px 0;">${data.address}</td>
        </tr>
        <tr>
          <td style="color: #666; padding: 8px 0;">Town:</td>
          <td style="color: #1a1a1a; font-weight: 500; padding: 8px 0;">${data.town}</td>
        </tr>
        <tr>
          <td style="color: #666; padding: 8px 0;">Zip Code:</td>
          <td style="color: #1a1a1a; font-weight: 500; padding: 8px 0;">${data.zipcode}</td>
        </tr>
      </table>
    </div>

    <div style="padding: 25px;">
      <h3 style="color: #C99C33; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 15px;">Source</h3>
      <p style="margin: 0;"><a href="https://stevenfrato.com/market/${data.zipcode}/" style="color: #C99C33; text-decoration: none;">https://stevenfrato.com/market/${data.zipcode}/</a></p>
    </div>
  </div>

  <p style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">
    This is an automated notification from stevenfrato.com
  </p>
</body>
</html>
  `;
}

/**
 * Generate plain text lead notification for Steven
 */
function generateLeadNotificationText(data: EmailSequenceRequest, fullAddress: string): string {
  const submittedAt = new Date().toLocaleString("en-US", {
    dateStyle: "full",
    timeStyle: "short",
  });

  return `
NEW LEAD - Market Report Request
================================
${submittedAt}

CONTACT INFORMATION
-------------------
Name: ${data.name}
Email: ${data.email}
${data.phone ? `Phone: ${data.phone}` : ""}

PROPERTY DETAILS
----------------
Address: ${data.address}
Town: ${data.town}
Zip Code: ${data.zipcode}

SOURCE
------
https://stevenfrato.com/market/${data.zipcode}/

---
This is an automated notification from stevenfrato.com
  `.trim();
}

/**
 * Generate the welcome email HTML
 */
function generateWelcomeEmail(data: EmailSequenceRequest, fullAddress: string): string {
  // Create PDF download URL with all parameters for personalization
  const pdfParams = new URLSearchParams({
    zipcode: data.zipcode,
    name: data.name,
    address: data.address,
    town: data.town,
  });
  const pdfUrl = `https://stevenfrato.com/.netlify/functions/generate-pdf?${pdfParams.toString()}`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your ${data.town} Market Report</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #C99C33;">
    <h1 style="color: #1a1a1a; margin: 0;">Steven Frato</h1>
    <p style="color: #C99C33; margin: 5px 0 0; font-weight: 600;">CENTURY 21</p>
  </div>

  <div style="padding: 30px 0;">
    <h2 style="color: #1a1a1a;">Your ${data.town} Market Report is Ready</h2>

    <p>Hi ${data.name},</p>

    <p>Thank you for your interest in the ${data.town}, NJ real estate market. I've prepared a personalized market analysis based on your property at:</p>

    <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <strong>${fullAddress}</strong>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${pdfUrl}" style="display: inline-block; background: #C99C33; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Download Your Market Report (PDF)</a>
    </div>

    <h3 style="color: #1a1a1a;">What's in Your Report:</h3>
    <ul style="padding-left: 20px;">
      <li>Current market conditions for ${data.town} (${data.zipcode})</li>
      <li>Median sale price and year-over-year trends</li>
      <li>Days on market and inventory levels</li>
      <li>Whether it's a buyer's or seller's market</li>
    </ul>

    <div style="background: linear-gradient(135deg, rgba(201, 156, 51, 0.1) 0%, rgba(201, 156, 51, 0.2) 100%); padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #C99C33;">
      <p style="margin: 0; font-weight: 600; color: #1a1a1a;">Want to discuss your options?</p>
      <p style="margin: 10px 0 0; color: #666;">I'm happy to provide a complimentary home value consultation. Just reply to this email or call me directly.</p>
    </div>

    <p>I'll be sending you more insights about the ${data.town} market over the coming weeks. In the meantime, feel free to reach out if you have any questions.</p>

    <p>Best regards,</p>
    <p><strong>Steven Frato</strong><br>
    Century 21<br>
    (609) 789-0126<br>
    sf@stevenfrato.com</p>
  </div>

  <div style="border-top: 1px solid #ddd; padding-top: 20px; font-size: 12px; color: #666; text-align: center;">
    <p>136 Farnsworth Ave, Bordentown, NJ 08505</p>
    <p>You're receiving this email because you requested a market report from stevenfrato.com</p>
    <p><a href="https://stevenfrato.com" style="color: #C99C33;">stevenfrato.com</a></p>
  </div>
</body>
</html>
  `;
}

/**
 * Generate plain text version of welcome email
 */
function generateWelcomeEmailText(data: EmailSequenceRequest, fullAddress: string): string {
  const pdfParams = new URLSearchParams({
    zipcode: data.zipcode,
    name: data.name,
    address: data.address,
    town: data.town,
  });
  const pdfUrl = `https://stevenfrato.com/.netlify/functions/generate-pdf?${pdfParams.toString()}`;

  return `
Your ${data.town} Market Report is Ready

Hi ${data.name},

Thank you for your interest in the ${data.town}, NJ real estate market. I've prepared a personalized market analysis based on your property at:

${fullAddress}

DOWNLOAD YOUR REPORT: ${pdfUrl}

What's in Your Report:
- Current market conditions for ${data.town} (${data.zipcode})
- Median sale price and year-over-year trends
- Days on market and inventory levels
- Whether it's a buyer's or seller's market

Want to discuss your options? I'm happy to provide a complimentary home value consultation. Just reply to this email or call me directly.

I'll be sending you more insights about the ${data.town} market over the coming weeks. In the meantime, feel free to reach out if you have any questions.

Best regards,
Steven Frato
Century 21
(609) 789-0126
sf@stevenfrato.com

---
136 Farnsworth Ave, Bordentown, NJ 08505
You're receiving this email because you requested a market report from stevenfrato.com
https://stevenfrato.com
  `.trim();
}

export { handler };
