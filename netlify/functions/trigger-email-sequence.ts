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
  location: string;
  timeline?: string;
  propertyAddress: string;
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

    if (!body.email || !body.location) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing required fields" }),
      };
    }

    // Send the first email immediately (welcome + report delivery)
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
              Data: generateWelcomeEmail(body),
              Charset: "UTF-8",
            },
            Text: {
              Data: generateWelcomeEmailText(body),
              Charset: "UTF-8",
            },
          },
        },
        ReplyToAddresses: ["sf@stevenfrato.com"],
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
 * Generate the welcome email HTML
 */
function generateWelcomeEmail(data: EmailSequenceRequest): string {
  const currentDate = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your ${data.location} Market Report</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #C99C33;">
    <h1 style="color: #1a1a1a; margin: 0;">Steven Frato</h1>
    <p style="color: #C99C33; margin: 5px 0 0; font-weight: 600;">CENTURY 21</p>
  </div>

  <div style="padding: 30px 0;">
    <h2 style="color: #1a1a1a;">Your ${data.location} Market Report is Ready</h2>

    <p>Thank you for your interest in the ${data.location} real estate market. I've prepared a personalized market analysis based on your property at:</p>

    <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <strong>${data.propertyAddress}</strong>
    </div>

    <h3 style="color: #1a1a1a;">What's in Your Report:</h3>
    <ul style="padding-left: 20px;">
      <li>Current market conditions for ${data.location}</li>
      <li>Recent comparable sales in your area</li>
      <li>Estimated value range for your property</li>
      <li>Personalized selling recommendations</li>
    </ul>

    <div style="text-align: center; margin: 30px 0;">
      <a href="https://stevenfrato.com/market/" style="display: inline-block; background: #C99C33; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600;">View Latest Market Data</a>
    </div>

    <p>I'll be sending you more insights about the ${data.location} market over the coming weeks. In the meantime, feel free to reach out if you have any questions.</p>

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
function generateWelcomeEmailText(data: EmailSequenceRequest): string {
  return `
Your ${data.location} Market Report is Ready

Thank you for your interest in the ${data.location} real estate market. I've prepared a personalized market analysis based on your property at:

${data.propertyAddress}

What's in Your Report:
- Current market conditions for ${data.location}
- Recent comparable sales in your area
- Estimated value range for your property
- Personalized selling recommendations

View Latest Market Data: https://stevenfrato.com/market/

I'll be sending you more insights about the ${data.location} market over the coming weeks. In the meantime, feel free to reach out if you have any questions.

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
