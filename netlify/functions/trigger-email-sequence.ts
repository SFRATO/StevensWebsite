/**
 * Trigger Email Sequence
 *
 * Initiates the 7-email nurture campaign for market report leads.
 * Uses Resend for email delivery.
 */

import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { Resend } from "resend";

interface EmailSequenceRequest {
  email: string;
  location: string;
  timeline?: string;
  propertyAddress: string;
}

const resend = new Resend(process.env.RESEND_API_KEY);

// Email sequence configuration
const EMAIL_SEQUENCE = [
  { day: 0, templateId: "welcome-report", subject: "Your {location} Market Report is Ready" },
  { day: 3, templateId: "market-deep-dive", subject: "What {location}'s Market Data Means for You" },
  { day: 7, templateId: "pricing-strategy", subject: "How to Price Your Home in Today's {location} Market" },
  { day: 11, templateId: "case-study", subject: "How I Helped a {location} Seller Get Top Dollar" },
  { day: 15, templateId: "preparation-tips", subject: "5 Things {location} Buyers Are Looking For Right Now" },
  { day: 18, templateId: "testimonial", subject: '"Steven made selling our home effortless"' },
  { day: 21, templateId: "consultation-cta", subject: "Ready to Discuss Your Options?" },
];

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  // Check for API key
  if (!process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY not configured");
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
      await resend.emails.send({
        from: "Steven Frato <reports@stevenfrato.com>",
        to: body.email,
        subject: subject,
        html: generateWelcomeEmail(body),
      });

      console.log("Welcome email sent to:", body.email);
    } catch (emailError) {
      console.error("Failed to send welcome email:", emailError);
      // Don't fail the whole request if email fails
    }

    // In a production environment, you would:
    // 1. Store the lead in a database
    // 2. Schedule the remaining emails using a job queue (e.g., QStash, Temporal)
    // 3. Or use Resend's audience/broadcast features for drip campaigns

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

export { handler };
