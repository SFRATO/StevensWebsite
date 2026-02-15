/**
 * Send Scheduled Emails Edge Function
 *
 * Triggered by pg_cron every hour to process the email queue:
 * 1. Query pending emails where scheduled_for <= NOW()
 * 2. Load lead and market data for personalization
 * 3. Render email template
 * 4. Send via SES with ConfigurationSet for tracking
 * 5. Update scheduled_emails status
 * 6. Advance lead to next campaign step
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SESClient, SendEmailCommand } from "npm:@aws-sdk/client-ses";

// Types
interface ScheduledEmailWithDetails {
  id: string;
  lead_id: string;
  campaign_step_id: string;
  scheduled_for: string;
  status: string;
  attempts: number;
  max_attempts: number;
  lead: {
    id: string;
    email: string;
    name: string;
    address: string | null;
    town: string | null;
    zipcode: string | null;
    county: string | null;
    status: string;
    campaign_id: string;
    current_step: number;
  };
  campaign_step: {
    id: string;
    step_number: number;
    template_id: string;
    subject_template: string;
    delay_days: number;
    send_hour: number;
    campaign_id: string;
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

// Processing configuration
const BATCH_SIZE = 50; // Process 50 emails at a time
const SES_RATE_LIMIT_MS = 100; // 10 emails per second max

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

// Helper: Generate unsubscribe URL
function generateUnsubscribeUrl(leadId: string): string {
  const token = btoa(`${leadId}:${Date.now()}`);
  return `${SITE_URL}/.netlify/functions/unsubscribe?token=${token}`;
}

// Helper: Replace template variables
function replaceTemplateVars(
  template: string,
  vars: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }
  return result;
}

// Helper: Sleep for rate limiting
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Email template renderers by template_id
const emailTemplates: Record<
  string,
  (
    lead: ScheduledEmailWithDetails["lead"],
    zipData: ZipcodeData | null,
    unsubscribeUrl: string
  ) => { subject: string; html: string; text: string }
> = {
  // ============================================
  // SELLER TRACK TEMPLATES
  // ============================================

  // Seller track - Day 0 (Welcome) - Note: Usually sent via handle-form-submission
  "seller-1-welcome": (lead, zipData, unsubscribeUrl) => {
    const town = lead.town || "your area";
    const medianPrice = formatCurrency(zipData?.median_sale_price ?? null);
    const priceChange = formatPercentChange(zipData?.median_sale_price_yoy ?? null);
    const marketType = getMarketTypeLabel(zipData?.market_type ?? "balanced");

    return {
      subject: `Your ${town} Market Report is Ready`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f6f6f6;">
  <div style="background: #ffffff; border-radius: 8px; overflow: hidden;">
    <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #C99C33;">
      <h1 style="color: #1a1a1a; margin: 0;">Steven Frato</h1>
      <p style="color: #C99C33; margin: 5px 0 0; font-weight: 600;">CENTURY 21</p>
    </div>

    <div style="padding: 30px;">
      <h2 style="color: #1a1a1a;">Your ${town} Market Report is Ready</h2>

      <p>Hi ${lead.name},</p>

      <p>Thank you for your interest in the ${town}, NJ real estate market. I've prepared a personalized market analysis for you.</p>

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
        <li>Current market conditions for ${town}</li>
        <li>Median sale price and year-over-year trends</li>
        <li>Days on market and inventory levels</li>
        <li>Whether it's a buyer's or seller's market</li>
      </ul>

      <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 25px 0;">
        <p style="margin: 0; font-weight: 600; color: #1a1a1a;">Want to discuss your options?</p>
        <p style="margin: 10px 0 0; color: #666;">I'm happy to provide a complimentary home value consultation.</p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${SITE_URL}/contact/" style="display: inline-block; background: #C99C33; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600;">Schedule a Consultation</a>
      </div>

      <p>I'll be sending you more insights about the ${town} market over the coming weeks.</p>

      <p>Best regards,<br><strong>Steven Frato</strong><br>Century 21<br>(609) 789-0126</p>
    </div>

    <div style="border-top: 1px solid #ddd; padding: 20px; font-size: 12px; color: #666; text-align: center;">
      <p style="margin: 0 0 10px;">136 Farnsworth Ave, Bordentown, NJ 08505</p>
      <p style="margin: 0;"><a href="${unsubscribeUrl}" style="color: #999;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>
      `,
      text: `Your ${town} Market Report is Ready

Hi ${lead.name},

Thank you for your interest in the ${town}, NJ real estate market.

QUICK MARKET SNAPSHOT:
- Median Sale Price: ${medianPrice}
- Year-over-Year Change: ${priceChange}
- Market Conditions: ${marketType}

Want to discuss your options? Schedule a consultation: ${SITE_URL}/contact/

Best regards,
Steven Frato
Century 21
(609) 789-0126

---
Unsubscribe: ${unsubscribeUrl}`,
    };
  },

  // Seller track - Day 3
  "seller-2-market-deep-dive": (lead, zipData, unsubscribeUrl) => {
    const town = lead.town || "your area";
    const medianPrice = formatCurrency(zipData?.median_sale_price ?? null);
    const priceChange = formatPercentChange(zipData?.median_sale_price_yoy ?? null);
    const dom = zipData?.median_dom ?? 30;
    const marketType = getMarketTypeLabel(zipData?.market_type ?? "balanced");

    return {
      subject: `What ${town}'s Market Data Means for You`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f6f6f6;">
  <div style="background: #ffffff; border-radius: 8px; overflow: hidden;">
    <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #C99C33;">
      <h1 style="color: #1a1a1a; margin: 0;">Steven Frato</h1>
      <p style="color: #C99C33; margin: 5px 0 0; font-weight: 600;">CENTURY 21</p>
    </div>

    <div style="padding: 30px;">
      <h2 style="color: #1a1a1a;">What ${town}'s Market Data Means for You</h2>

      <p>Hi ${lead.name},</p>

      <p>A few days ago, I sent you a market report for ${town}. Today, let me break down what those numbers actually mean for your selling timeline.</p>

      <h3 style="color: #1a1a1a; margin-top: 25px;">The Key Metrics</h3>

      <div style="display: flex; gap: 15px; margin: 20px 0;">
        <div style="flex: 1; background: #f9f9f9; padding: 20px; border-radius: 8px; text-align: center; border: 1px solid #e0e0e0;">
          <p style="font-size: 12px; color: #666; text-transform: uppercase; margin: 0 0 5px;">Median Price</p>
          <p style="font-size: 28px; font-weight: bold; color: #C99C33; margin: 0;">${medianPrice}</p>
          <p style="font-size: 14px; color: ${(zipData?.median_sale_price_yoy ?? 0) >= 0 ? '#4CAF50' : '#f44336'}; margin: 5px 0 0;">${priceChange} YoY</p>
        </div>
        <div style="flex: 1; background: #f9f9f9; padding: 20px; border-radius: 8px; text-align: center; border: 1px solid #e0e0e0;">
          <p style="font-size: 12px; color: #666; text-transform: uppercase; margin: 0 0 5px;">Days on Market</p>
          <p style="font-size: 28px; font-weight: bold; color: #C99C33; margin: 0;">${dom}</p>
          <p style="font-size: 12px; color: #666; margin: 5px 0 0;">Average</p>
        </div>
      </div>

      <h3 style="color: #1a1a1a;">What This Means for Sellers</h3>

      <p><strong>Current conditions:</strong> ${town} is currently a <strong>${marketType.toLowerCase()}</strong>. ${
        zipData?.market_type === "seller"
          ? "Sellers have the advantage with limited inventory and strong buyer demand."
          : zipData?.market_type === "buyer"
          ? "Buyers have more options, so pricing strategy is crucial."
          : "Supply and demand are relatively balanced, giving both parties negotiating room."
      }</p>

      <p><strong>Timing matters:</strong> With homes averaging ${dom} days on market, a well-priced home can move quickly. However, pricing too high initially can lead to price reductions and a longer sale process.</p>

      ${zipData?.ai_insight ? `
      <div style="background: linear-gradient(135deg, rgba(201, 156, 51, 0.1) 0%, rgba(201, 156, 51, 0.2) 100%); padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #C99C33;">
        <p style="margin: 0; font-style: italic;">"${zipData.ai_insight}"</p>
      </div>
      ` : ''}

      <div style="text-align: center; margin: 30px 0;">
        <a href="${SITE_URL}/contact/" style="display: inline-block; background: #C99C33; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600;">Let's Discuss Your Situation</a>
      </div>

      <p>In my next email, I'll share specific pricing strategies that help ${town} sellers maximize their sale price without sitting on the market too long.</p>

      <p>Talk soon,<br><strong>Steven</strong></p>
    </div>

    <div style="border-top: 1px solid #ddd; padding: 20px; font-size: 12px; color: #666; text-align: center;">
      <p style="margin: 0 0 10px;">136 Farnsworth Ave, Bordentown, NJ 08505 | (609) 789-0126</p>
      <p style="margin: 0;"><a href="${unsubscribeUrl}" style="color: #999;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>
      `,
      text: `What ${town}'s Market Data Means for You

Hi ${lead.name},

A few days ago, I sent you a market report for ${town}. Today, let me break down what those numbers actually mean for your selling timeline.

THE KEY METRICS
- Median Price: ${medianPrice} (${priceChange} YoY)
- Days on Market: ${dom} average

WHAT THIS MEANS FOR SELLERS
Current conditions: ${town} is currently a ${marketType.toLowerCase()}.
Timing matters: With homes averaging ${dom} days on market, a well-priced home can move quickly.

Let's discuss your situation: ${SITE_URL}/contact/

Talk soon,
Steven

---
Unsubscribe: ${unsubscribeUrl}`,
    };
  },

  // Seller track - Day 7
  "seller-3-pricing-strategy": (lead, zipData, unsubscribeUrl) => {
    const town = lead.town || "your area";
    const medianPrice = formatCurrency(zipData?.median_sale_price ?? null);
    const soldAboveList = zipData?.sold_above_list_pct ?? 40;
    const marketType = zipData?.market_type ?? "balanced";

    return {
      subject: `How to Price Your Home in Today's ${town} Market`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f6f6f6;">
  <div style="background: #ffffff; border-radius: 8px; overflow: hidden;">
    <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #C99C33;">
      <h1 style="color: #1a1a1a; margin: 0;">Steven Frato</h1>
      <p style="color: #C99C33; margin: 5px 0 0; font-weight: 600;">CENTURY 21</p>
    </div>

    <div style="padding: 30px;">
      <h2 style="color: #1a1a1a;">How to Price Your Home in Today's ${town} Market</h2>

      <p>Hi ${lead.name},</p>

      <p>Pricing a home is both an art and a science. Today I want to share the pricing strategies that work best in ${town}'s current market conditions.</p>

      <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
        <p style="font-size: 14px; color: #666; margin: 0 0 10px;">In ${town}, approximately</p>
        <p style="font-size: 36px; font-weight: bold; color: #C99C33; margin: 0;">${soldAboveList.toFixed(0)}%</p>
        <p style="font-size: 14px; color: #666; margin: 10px 0 0;">of homes sold at or above list price</p>
      </div>

      <h3 style="color: #1a1a1a;">The 3 Pricing Strategies</h3>

      <p><strong>1. Competitive Pricing</strong> - Price at or slightly below market value to generate multiple offers. This works well in ${marketType === "seller" ? "your current seller's market" : "competitive situations"} and often results in final prices above the list price.</p>

      <p><strong>2. Value-Based Pricing</strong> - Price based on your home's unique features and improvements. Best for homes with significant upgrades or in premium locations.</p>

      <p><strong>3. Strategic High Pricing</strong> - Price above market to leave negotiating room. Only recommended when you're not in a hurry and your home has exceptional features.</p>

      <div style="background: linear-gradient(135deg, rgba(201, 156, 51, 0.1) 0%, rgba(201, 156, 51, 0.2) 100%); padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #C99C33;">
        <p style="margin: 0 0 10px; font-weight: 600;">My Recommendation for ${town}:</p>
        <p style="margin: 0;">${
          marketType === "seller"
            ? "Given the current seller's market conditions, competitive pricing often generates the strongest results. Multiple offers can drive your final sale price well above asking."
            : marketType === "buyer"
            ? "In the current market, value-based pricing with room for negotiation tends to work best. Focus on highlighting your home's best features."
            : "The balanced market conditions favor value-based pricing. Price your home to reflect its true worth and be prepared for some negotiation."
        }</p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${SITE_URL}/contact/" style="display: inline-block; background: #C99C33; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600;">Get a Free Pricing Analysis</a>
      </div>

      <p>Next time, I'll share the top things ${town} buyers are looking for right now - insights that can help you prepare your home for sale.</p>

      <p>Best,<br><strong>Steven</strong></p>
    </div>

    <div style="border-top: 1px solid #ddd; padding: 20px; font-size: 12px; color: #666; text-align: center;">
      <p style="margin: 0 0 10px;">136 Farnsworth Ave, Bordentown, NJ 08505 | (609) 789-0126</p>
      <p style="margin: 0;"><a href="${unsubscribeUrl}" style="color: #999;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>
      `,
      text: `How to Price Your Home in Today's ${town} Market

Hi ${lead.name},

Pricing a home is both an art and a science. Today I want to share the pricing strategies that work best in ${town}'s current market conditions.

In ${town}, approximately ${soldAboveList.toFixed(0)}% of homes sold at or above list price.

THE 3 PRICING STRATEGIES

1. Competitive Pricing - Price at or slightly below market value to generate multiple offers.

2. Value-Based Pricing - Price based on your home's unique features and improvements.

3. Strategic High Pricing - Price above market to leave negotiating room.

Get a free pricing analysis: ${SITE_URL}/contact/

Best,
Steven

---
Unsubscribe: ${unsubscribeUrl}`,
    };
  },

  // Seller track - Day 11
  "seller-4-preparation-tips": (lead, zipData, unsubscribeUrl) => {
    const town = lead.town || "your area";

    return {
      subject: `5 Things ${town} Buyers Are Looking For Right Now`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f6f6f6;">
  <div style="background: #ffffff; border-radius: 8px; overflow: hidden;">
    <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #C99C33;">
      <h1 style="color: #1a1a1a; margin: 0;">Steven Frato</h1>
      <p style="color: #C99C33; margin: 5px 0 0; font-weight: 600;">CENTURY 21</p>
    </div>

    <div style="padding: 30px;">
      <h2 style="color: #1a1a1a;">5 Things ${town} Buyers Are Looking For Right Now</h2>

      <p>Hi ${lead.name},</p>

      <p>After helping dozens of families find their homes in ${town}, I've noticed clear patterns in what today's buyers prioritize. Here's what I'm seeing:</p>

      <div style="margin: 25px 0;">
        <div style="display: flex; align-items: flex-start; gap: 15px; margin-bottom: 20px;">
          <span style="background: #C99C33; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0;">1</span>
          <div>
            <p style="margin: 0; font-weight: 600;">Move-In Ready Condition</p>
            <p style="margin: 5px 0 0; color: #666; font-size: 14px;">Buyers are willing to pay a premium for homes that don't require immediate work. Fresh paint, updated fixtures, and good condition go a long way.</p>
          </div>
        </div>

        <div style="display: flex; align-items: flex-start; gap: 15px; margin-bottom: 20px;">
          <span style="background: #C99C33; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0;">2</span>
          <div>
            <p style="margin: 0; font-weight: 600;">Updated Kitchens</p>
            <p style="margin: 5px 0 0; color: #666; font-size: 14px;">The kitchen is still the heart of the home. Modern appliances, updated countertops, and good storage make a big impression.</p>
          </div>
        </div>

        <div style="display: flex; align-items: flex-start; gap: 15px; margin-bottom: 20px;">
          <span style="background: #C99C33; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0;">3</span>
          <div>
            <p style="margin: 0; font-weight: 600;">Home Office Space</p>
            <p style="margin: 5px 0 0; color: #666; font-size: 14px;">Remote and hybrid work is here to stay. A dedicated office space or flexible room that could serve as one is highly valued.</p>
          </div>
        </div>

        <div style="display: flex; align-items: flex-start; gap: 15px; margin-bottom: 20px;">
          <span style="background: #C99C33; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0;">4</span>
          <div>
            <p style="margin: 0; font-weight: 600;">Outdoor Living Space</p>
            <p style="margin: 5px 0 0; color: #666; font-size: 14px;">Patios, decks, and well-maintained yards are more important than ever. Even small outdoor spaces can be a major selling point.</p>
          </div>
        </div>

        <div style="display: flex; align-items: flex-start; gap: 15px;">
          <span style="background: #C99C33; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0;">5</span>
          <div>
            <p style="margin: 0; font-weight: 600;">Energy Efficiency</p>
            <p style="margin: 5px 0 0; color: #666; font-size: 14px;">With utility costs rising, buyers appreciate updated HVAC systems, good insulation, and energy-efficient windows.</p>
          </div>
        </div>
      </div>

      <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 25px 0;">
        <p style="margin: 0; font-weight: 600;">Quick Tip:</p>
        <p style="margin: 10px 0 0;">You don't need to renovate everything. Strategic improvements in these areas can significantly impact your home's appeal and sale price.</p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${SITE_URL}/contact/" style="display: inline-block; background: #C99C33; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600;">Get Personalized Prep Advice</a>
      </div>

      <p>In my final email of this series, I'll extend an invitation for a complimentary consultation to discuss your specific situation.</p>

      <p>Best,<br><strong>Steven</strong></p>
    </div>

    <div style="border-top: 1px solid #ddd; padding: 20px; font-size: 12px; color: #666; text-align: center;">
      <p style="margin: 0 0 10px;">136 Farnsworth Ave, Bordentown, NJ 08505 | (609) 789-0126</p>
      <p style="margin: 0;"><a href="${unsubscribeUrl}" style="color: #999;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>
      `,
      text: `5 Things ${town} Buyers Are Looking For Right Now

Hi ${lead.name},

After helping dozens of families find their homes in ${town}, I've noticed clear patterns in what today's buyers prioritize:

1. Move-In Ready Condition
2. Updated Kitchens
3. Home Office Space
4. Outdoor Living Space
5. Energy Efficiency

You don't need to renovate everything. Strategic improvements can significantly impact your home's appeal and sale price.

Get personalized prep advice: ${SITE_URL}/contact/

Best,
Steven

---
Unsubscribe: ${unsubscribeUrl}`,
    };
  },

  // Seller track - Day 14
  "seller-5-consultation": (lead, zipData, unsubscribeUrl) => {
    const town = lead.town || "your area";
    const marketType = getMarketTypeLabel(zipData?.market_type ?? "balanced");

    return {
      subject: "Ready to Discuss Your Options?",
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f6f6f6;">
  <div style="background: #ffffff; border-radius: 8px; overflow: hidden;">
    <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #C99C33;">
      <h1 style="color: #1a1a1a; margin: 0;">Steven Frato</h1>
      <p style="color: #C99C33; margin: 5px 0 0; font-weight: 600;">CENTURY 21</p>
    </div>

    <div style="padding: 30px;">
      <h2 style="color: #1a1a1a;">Ready to Discuss Your Options?</h2>

      <p>Hi ${lead.name},</p>

      <p>Over the past two weeks, I've shared market data, pricing strategies, and buyer insights for ${town}. Now I'd like to offer you something more personalized.</p>

      <div style="background: linear-gradient(135deg, rgba(201, 156, 51, 0.1) 0%, rgba(201, 156, 51, 0.2) 100%); padding: 25px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #C99C33;">
        <h3 style="margin: 0 0 15px; color: #1a1a1a;">Free Home Value Consultation</h3>
        <p style="margin: 0 0 15px;">In this no-obligation session, we'll discuss:</p>
        <ul style="margin: 0; padding-left: 20px;">
          <li>Your home's current estimated value</li>
          <li>What comparable homes have sold for recently</li>
          <li>The best timing for your situation</li>
          <li>Any questions you have about the process</li>
        </ul>
      </div>

      <p>Whether you're thinking about selling soon or just exploring your options, I'm happy to provide honest, no-pressure guidance.</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${SITE_URL}/contact/" style="display: inline-block; background: #C99C33; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 18px;">Schedule Your Free Consultation</a>
      </div>

      <p>You can also reach me directly:</p>
      <ul style="list-style: none; padding: 0;">
        <li style="margin-bottom: 8px;"><strong>Phone:</strong> <a href="tel:6097890126" style="color: #C99C33;">(609) 789-0126</a></li>
        <li style="margin-bottom: 8px;"><strong>Email:</strong> <a href="mailto:sf@stevenfrato.com" style="color: #C99C33;">sf@stevenfrato.com</a></li>
        <li><strong>Text:</strong> Same number - I respond quickly!</li>
      </ul>

      <p style="margin-top: 25px;">Looking forward to connecting,</p>
      <p><strong>Steven Frato</strong><br>
      Century 21<br>
      Your ${town} Real Estate Expert</p>

      <p style="margin-top: 25px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666;">
        <strong>P.S.</strong> ${town}'s ${marketType.toLowerCase()} conditions won't last forever. If you've been thinking about selling, now might be a great time to at least explore your options. I'm here when you're ready.
      </p>
    </div>

    <div style="border-top: 1px solid #ddd; padding: 20px; font-size: 12px; color: #666; text-align: center;">
      <p style="margin: 0 0 10px;">136 Farnsworth Ave, Bordentown, NJ 08505 | (609) 789-0126</p>
      <p style="margin: 0;"><a href="${unsubscribeUrl}" style="color: #999;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>
      `,
      text: `Ready to Discuss Your Options?

Hi ${lead.name},

Over the past two weeks, I've shared market data, pricing strategies, and buyer insights for ${town}. Now I'd like to offer you something more personalized.

FREE HOME VALUE CONSULTATION

In this no-obligation session, we'll discuss:
- Your home's current estimated value
- What comparable homes have sold for recently
- The best timing for your situation
- Any questions you have about the process

Schedule your free consultation: ${SITE_URL}/contact/

Or reach me directly:
Phone: (609) 789-0126
Email: sf@stevenfrato.com
Text: Same number - I respond quickly!

Looking forward to connecting,
Steven Frato
Century 21

P.S. ${town}'s ${marketType.toLowerCase()} conditions won't last forever. If you've been thinking about selling, now might be a great time to explore your options.

---
Unsubscribe: ${unsubscribeUrl}`,
    };
  },

  // ============================================
  // BUYER TRACK TEMPLATES
  // ============================================

  // Buyer track - Day 0 (Welcome)
  "buyer-1-welcome": (lead, zipData, unsubscribeUrl) => {
    const town = lead.town || "your area";
    const county = lead.county || "your county";
    const medianPrice = formatCurrency(zipData?.median_sale_price ?? null);
    const inventory = zipData?.inventory ?? 45;
    const marketType = zipData?.market_type ?? "balanced";
    const marketTypeLabel = getMarketTypeLabel(marketType);
    const marketAdvice = marketType === "seller"
      ? "Homes are selling quickly, so being prepared to act fast is essential."
      : marketType === "buyer"
      ? "You have more options and negotiating power in the current market."
      : "Supply and demand are balanced, giving you good options without excessive pressure.";

    return {
      subject: `Your Guide to Buying in ${town}`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f6f6f6;">
  <div style="background: #ffffff; border-radius: 8px; overflow: hidden;">
    <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #C99C33;">
      <h1 style="color: #1a1a1a; margin: 0;">Steven Frato</h1>
      <p style="color: #C99C33; margin: 5px 0 0; font-weight: 600;">CENTURY 21</p>
    </div>

    <div style="padding: 30px;">
      <h2 style="color: #1a1a1a;">Your Guide to Buying in ${town}</h2>

      <p>Hi ${lead.name},</p>

      <p>Thank you for your interest in finding a home in ${town}, NJ. I'm excited to help you navigate this journey and find the perfect place to call home.</p>

      <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e0e0e0;">
        <p style="font-size: 14px; font-weight: 600; color: #C99C33; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 15px;">Current Market Snapshot</p>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #666;">Median Price:</td>
            <td style="padding: 8px 0; font-weight: 600; text-align: right;">${medianPrice}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Active Listings:</td>
            <td style="padding: 8px 0; font-weight: 600; text-align: right;">${inventory} homes</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Market Conditions:</td>
            <td style="padding: 8px 0; font-weight: 600; text-align: right;">${marketTypeLabel}</td>
          </tr>
        </table>
      </div>

      <h3 style="color: #1a1a1a; margin-top: 25px;">What This Means for You</h3>
      <p>${marketAdvice}</p>

      <p>Over the next two weeks, I'll send you valuable information about:</p>
      <ul style="padding-left: 20px;">
        <li style="margin-bottom: 8px;">${town}'s best neighborhoods and what makes each unique</li>
        <li style="margin-bottom: 8px;">Smart buying strategies for the current market</li>
        <li style="margin-bottom: 8px;">How to maximize your buying power with today's financing options</li>
        <li style="margin-bottom: 8px;">The home buying process from start to finish</li>
      </ul>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${SITE_URL}/contact/" style="display: inline-block; background: #C99C33; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600;">Let's Start Your Home Search</a>
      </div>

      <div style="background: linear-gradient(135deg, rgba(201, 156, 51, 0.1) 0%, rgba(201, 156, 51, 0.2) 100%); padding: 20px; border-radius: 8px; border-left: 4px solid #C99C33; margin: 25px 0;">
        <p style="margin: 0 0 10px; font-weight: 600;">Ready to start looking?</p>
        <p style="margin: 0; font-size: 14px; color: #666;">I'd love to learn about what you're looking for in your next home. Reply to this email or give me a call - I'm here to help, no pressure.</p>
      </div>

      <p>Looking forward to helping you find home,<br><strong>Steven Frato</strong><br>Century 21<br>(609) 789-0126</p>
    </div>

    <div style="border-top: 1px solid #ddd; padding: 20px; font-size: 12px; color: #666; text-align: center;">
      <p style="margin: 0 0 10px;">136 Farnsworth Ave, Bordentown, NJ 08505</p>
      <p style="margin: 0;"><a href="${unsubscribeUrl}" style="color: #999;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>
      `,
      text: `Your Guide to Buying in ${town}

Hi ${lead.name},

Thank you for your interest in finding a home in ${town}, NJ. I'm excited to help you navigate this journey and find the perfect place to call home.

CURRENT MARKET SNAPSHOT
- Median Price: ${medianPrice}
- Active Listings: ${inventory} homes
- Market Conditions: ${marketTypeLabel}

WHAT THIS MEANS FOR YOU
${marketAdvice}

Over the next two weeks, I'll send you valuable information about ${town}'s neighborhoods, buying strategies, financing options, and the home buying process.

Let's start your home search: ${SITE_URL}/contact/

Looking forward to helping you find home,
Steven Frato
Century 21
(609) 789-0126

---
Unsubscribe: ${unsubscribeUrl}`,
    };
  },

  // Buyer track - Day 3 (Neighborhoods)
  "buyer-2-neighborhoods": (lead, zipData, unsubscribeUrl) => {
    const town = lead.town || "your area";
    const county = lead.county || "your county";

    return {
      subject: `Discovering ${town}'s Best Neighborhoods`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f6f6f6;">
  <div style="background: #ffffff; border-radius: 8px; overflow: hidden;">
    <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #C99C33;">
      <h1 style="color: #1a1a1a; margin: 0;">Steven Frato</h1>
      <p style="color: #C99C33; margin: 5px 0 0; font-weight: 600;">CENTURY 21</p>
    </div>

    <div style="padding: 30px;">
      <h2 style="color: #1a1a1a;">Discovering ${town}'s Best Neighborhoods</h2>

      <p>Hi ${lead.name},</p>

      <p>One of the most important decisions when buying a home isn't just the house itself - it's the neighborhood. Today I want to share what makes ${town} and surrounding areas in ${county} special.</p>

      <h3 style="color: #1a1a1a; margin-top: 25px;">What to Consider When Choosing a Neighborhood</h3>

      <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 15px; display: flex; align-items: flex-start; gap: 15px;">
        <span style="background: #C99C33; color: white; width: 28px; height: 28px; border-radius: 50%; display: inline-block; text-align: center; line-height: 28px; font-weight: bold; flex-shrink: 0;">1</span>
        <div>
          <p style="margin: 0 0 5px; font-weight: 600;">School Districts</p>
          <p style="margin: 0; font-size: 14px; color: #666;">Even if you don't have school-age children, school quality significantly impacts home values and resale potential.</p>
        </div>
      </div>

      <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 15px; display: flex; align-items: flex-start; gap: 15px;">
        <span style="background: #C99C33; color: white; width: 28px; height: 28px; border-radius: 50%; display: inline-block; text-align: center; line-height: 28px; font-weight: bold; flex-shrink: 0;">2</span>
        <div>
          <p style="margin: 0 0 5px; font-weight: 600;">Commute & Transportation</p>
          <p style="margin: 0; font-size: 14px; color: #666;">Consider your daily commute, access to major highways, and proximity to NJ Transit options.</p>
        </div>
      </div>

      <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 15px; display: flex; align-items: flex-start; gap: 15px;">
        <span style="background: #C99C33; color: white; width: 28px; height: 28px; border-radius: 50%; display: inline-block; text-align: center; line-height: 28px; font-weight: bold; flex-shrink: 0;">3</span>
        <div>
          <p style="margin: 0 0 5px; font-weight: 600;">Future Development</p>
          <p style="margin: 0; font-size: 14px; color: #666;">Ask about planned developments. New infrastructure can increase property values.</p>
        </div>
      </div>

      <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 15px; display: flex; align-items: flex-start; gap: 15px;">
        <span style="background: #C99C33; color: white; width: 28px; height: 28px; border-radius: 50%; display: inline-block; text-align: center; line-height: 28px; font-weight: bold; flex-shrink: 0;">4</span>
        <div>
          <p style="margin: 0 0 5px; font-weight: 600;">Community & Lifestyle</p>
          <p style="margin: 0; font-size: 14px; color: #666;">Visit at different times of day. Each community has its own character and pace.</p>
        </div>
      </div>

      <div style="background: linear-gradient(135deg, rgba(201, 156, 51, 0.1) 0%, rgba(201, 156, 51, 0.2) 100%); padding: 20px; border-radius: 8px; border-left: 4px solid #C99C33; margin: 25px 0;">
        <p style="margin: 0 0 10px; font-weight: 600; color: #C99C33; font-size: 14px; text-transform: uppercase;">Local Insight</p>
        <p style="margin: 0; font-size: 15px;">${county} offers diverse options - from quiet suburban streets to communities with walkable downtown areas. I can help you find the one that fits your lifestyle.</p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${SITE_URL}/contact/" style="display: inline-block; background: #C99C33; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600;">Schedule a Neighborhood Tour</a>
      </div>

      <p>In my next email, I'll share smart buying strategies for ${town}'s current market.</p>

      <p>Here to help you find your place,<br><strong>Steven</strong></p>
    </div>

    <div style="border-top: 1px solid #ddd; padding: 20px; font-size: 12px; color: #666; text-align: center;">
      <p style="margin: 0 0 10px;">136 Farnsworth Ave, Bordentown, NJ 08505 | (609) 789-0126</p>
      <p style="margin: 0;"><a href="${unsubscribeUrl}" style="color: #999;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>
      `,
      text: `Discovering ${town}'s Best Neighborhoods

Hi ${lead.name},

One of the most important decisions when buying a home isn't just the house itself - it's the neighborhood.

WHAT TO CONSIDER:

1. School Districts - Even without kids, school quality impacts home values.

2. Commute & Transportation - Access to highways and NJ Transit options.

3. Future Development - Planned changes that could affect property values.

4. Community & Lifestyle - Visit at different times to feel the neighborhood character.

${county} offers diverse options - from quiet suburban streets to walkable downtown areas.

Schedule a neighborhood tour: ${SITE_URL}/contact/

Here to help you find your place,
Steven

---
Unsubscribe: ${unsubscribeUrl}`,
    };
  },

  // Buyer track - Day 7 (Strategy)
  "buyer-3-strategy": (lead, zipData, unsubscribeUrl) => {
    const town = lead.town || "your area";
    const marketType = zipData?.market_type ?? "balanced";
    const dom = zipData?.median_dom ?? 30;

    return {
      subject: `Smart Buying Strategies for ${town}'s Market`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f6f6f6;">
  <div style="background: #ffffff; border-radius: 8px; overflow: hidden;">
    <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #C99C33;">
      <h1 style="color: #1a1a1a; margin: 0;">Steven Frato</h1>
      <p style="color: #C99C33; margin: 5px 0 0; font-weight: 600;">CENTURY 21</p>
    </div>

    <div style="padding: 30px;">
      <h2 style="color: #1a1a1a;">Smart Buying Strategies for ${town}'s Market</h2>

      <p>Hi ${lead.name},</p>

      <p>In ${town}'s current ${getMarketTypeLabel(marketType).toLowerCase()}, knowing how to position yourself as a buyer can make all the difference. Here's what's working right now.</p>

      <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
        <p style="font-size: 14px; color: #666; margin: 0 0 5px;">Average Days on Market</p>
        <p style="font-size: 36px; font-weight: bold; color: #C99C33; margin: 0;">${dom}</p>
        <p style="font-size: 12px; color: #999; margin: 5px 0 0;">in ${town}</p>
      </div>

      <h3 style="color: #1a1a1a;">Strategies That Work</h3>

      <p><strong>1. Get Pre-Approved First</strong><br>
      <span style="color: #666;">A pre-approval letter shows sellers you're serious and ready. In competitive situations, this can be the difference between getting the house or losing it.</span></p>

      <p><strong>2. Know Your Must-Haves vs Nice-to-Haves</strong><br>
      <span style="color: #666;">Be clear on what's non-negotiable (location, bedrooms, school district) versus what you can compromise on. This helps you act quickly when the right home appears.</span></p>

      <p><strong>3. ${marketType === "seller" ? "Be Ready to Move Fast" : "Take Time to Negotiate"}</strong><br>
      <span style="color: #666;">${marketType === "seller"
        ? "With homes selling in " + dom + " days on average, you need to be prepared to make decisions quickly. That means doing your research upfront."
        : "The current market gives you room to negotiate on price and terms. Don't be afraid to ask for what you want."}</span></p>

      <p><strong>4. Consider Escalation Clauses</strong><br>
      <span style="color: #666;">In multiple-offer situations, an escalation clause can automatically increase your offer up to a maximum you set - keeping you competitive without overpaying.</span></p>

      <div style="background: linear-gradient(135deg, rgba(201, 156, 51, 0.1) 0%, rgba(201, 156, 51, 0.2) 100%); padding: 20px; border-radius: 8px; border-left: 4px solid #C99C33; margin: 25px 0;">
        <p style="margin: 0 0 10px; font-weight: 600;">The Bottom Line</p>
        <p style="margin: 0; font-size: 14px; color: #666;">Preparation is everything. The buyers who succeed aren't necessarily those with the most money - they're the ones who are ready when opportunity knocks.</p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${SITE_URL}/contact/" style="display: inline-block; background: #C99C33; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600;">Let's Discuss Your Strategy</a>
      </div>

      <p>Next time, I'll share how to maximize your buying power with today's financing options.</p>

      <p>Best,<br><strong>Steven</strong></p>
    </div>

    <div style="border-top: 1px solid #ddd; padding: 20px; font-size: 12px; color: #666; text-align: center;">
      <p style="margin: 0 0 10px;">136 Farnsworth Ave, Bordentown, NJ 08505 | (609) 789-0126</p>
      <p style="margin: 0;"><a href="${unsubscribeUrl}" style="color: #999;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>
      `,
      text: `Smart Buying Strategies for ${town}'s Market

Hi ${lead.name},

In ${town}'s current ${getMarketTypeLabel(marketType).toLowerCase()}, knowing how to position yourself can make all the difference.

Average Days on Market in ${town}: ${dom}

STRATEGIES THAT WORK:

1. Get Pre-Approved First - Shows sellers you're serious and ready.

2. Know Your Must-Haves vs Nice-to-Haves - Helps you act quickly.

3. ${marketType === "seller" ? "Be Ready to Move Fast" : "Take Time to Negotiate"}

4. Consider Escalation Clauses - Stay competitive without overpaying.

THE BOTTOM LINE: Preparation is everything. Ready buyers succeed.

Let's discuss your strategy: ${SITE_URL}/contact/

Best,
Steven

---
Unsubscribe: ${unsubscribeUrl}`,
    };
  },

  // Buyer track - Day 11 (Financing)
  "buyer-4-financing": (lead, zipData, unsubscribeUrl) => {
    const county = lead.county || "your county";
    const medianPrice = formatCurrency(zipData?.median_sale_price ?? null);

    return {
      subject: `Maximizing Your Buying Power in ${county}`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f6f6f6;">
  <div style="background: #ffffff; border-radius: 8px; overflow: hidden;">
    <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #C99C33;">
      <h1 style="color: #1a1a1a; margin: 0;">Steven Frato</h1>
      <p style="color: #C99C33; margin: 5px 0 0; font-weight: 600;">CENTURY 21</p>
    </div>

    <div style="padding: 30px;">
      <h2 style="color: #1a1a1a;">Maximizing Your Buying Power in ${county}</h2>

      <p>Hi ${lead.name},</p>

      <p>With ${county}'s median home price at ${medianPrice}, understanding your financing options can help you get more home for your money. Here's what you should know.</p>

      <h3 style="color: #1a1a1a; margin-top: 25px;">Financing Options to Consider</h3>

      <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 15px 0;">
        <p style="margin: 0 0 8px; font-weight: 600; color: #C99C33;">Conventional Loans</p>
        <p style="margin: 0; font-size: 14px; color: #666;">Traditional mortgages with competitive rates. Typically require 5-20% down, with better rates for larger down payments.</p>
      </div>

      <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 15px 0;">
        <p style="margin: 0 0 8px; font-weight: 600; color: #C99C33;">FHA Loans</p>
        <p style="margin: 0; font-size: 14px; color: #666;">Government-backed loans with lower down payment requirements (as low as 3.5%) and more flexible credit requirements.</p>
      </div>

      <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 15px 0;">
        <p style="margin: 0 0 8px; font-weight: 600; color: #C99C33;">VA Loans</p>
        <p style="margin: 0; font-size: 14px; color: #666;">For veterans and active military - often no down payment required and competitive rates.</p>
      </div>

      <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 15px 0;">
        <p style="margin: 0 0 8px; font-weight: 600; color: #C99C33;">NJ First-Time Buyer Programs</p>
        <p style="margin: 0; font-size: 14px; color: #666;">New Jersey offers down payment assistance and favorable terms for first-time buyers through NJHMFA programs.</p>
      </div>

      <div style="background: linear-gradient(135deg, rgba(201, 156, 51, 0.1) 0%, rgba(201, 156, 51, 0.2) 100%); padding: 20px; border-radius: 8px; border-left: 4px solid #C99C33; margin: 25px 0;">
        <p style="margin: 0 0 10px; font-weight: 600;">Pro Tip</p>
        <p style="margin: 0; font-size: 14px; color: #666;">Shop around for lenders. Even a small difference in interest rate can save you thousands over the life of your loan. I can connect you with trusted local lenders who know ${county}.</p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${SITE_URL}/contact/" style="display: inline-block; background: #C99C33; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600;">Get Lender Recommendations</a>
      </div>

      <p>In my final email, I'll extend an invitation to discuss how I can help you find your perfect home.</p>

      <p>Best,<br><strong>Steven</strong></p>
    </div>

    <div style="border-top: 1px solid #ddd; padding: 20px; font-size: 12px; color: #666; text-align: center;">
      <p style="margin: 0 0 10px;">136 Farnsworth Ave, Bordentown, NJ 08505 | (609) 789-0126</p>
      <p style="margin: 0;"><a href="${unsubscribeUrl}" style="color: #999;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>
      `,
      text: `Maximizing Your Buying Power in ${county}

Hi ${lead.name},

With ${county}'s median home price at ${medianPrice}, understanding your financing options can help you get more home for your money.

FINANCING OPTIONS:

- Conventional Loans: 5-20% down, competitive rates
- FHA Loans: As low as 3.5% down, flexible credit
- VA Loans: No down payment for veterans
- NJ First-Time Buyer Programs: Down payment assistance available

PRO TIP: Shop around for lenders. Even a small rate difference saves thousands.

Get lender recommendations: ${SITE_URL}/contact/

Best,
Steven

---
Unsubscribe: ${unsubscribeUrl}`,
    };
  },

  // Buyer track - Day 14 (Consultation)
  "buyer-5-consultation": (lead, zipData, unsubscribeUrl) => {
    const town = lead.town || "your area";

    return {
      subject: `Let's Find Your Perfect ${town} Home`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f6f6f6;">
  <div style="background: #ffffff; border-radius: 8px; overflow: hidden;">
    <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #C99C33;">
      <h1 style="color: #1a1a1a; margin: 0;">Steven Frato</h1>
      <p style="color: #C99C33; margin: 5px 0 0; font-weight: 600;">CENTURY 21</p>
    </div>

    <div style="padding: 30px;">
      <h2 style="color: #1a1a1a;">Let's Find Your Perfect ${town} Home</h2>

      <p>Hi ${lead.name},</p>

      <p>Over the past two weeks, I've shared neighborhood insights, buying strategies, and financing options. Now I'd like to offer you something more personal.</p>

      <div style="background: linear-gradient(135deg, rgba(201, 156, 51, 0.1) 0%, rgba(201, 156, 51, 0.2) 100%); padding: 25px; border-radius: 8px; border-left: 4px solid #C99C33; margin: 25px 0;">
        <h3 style="margin: 0 0 15px; color: #1a1a1a;">Free Buyer Consultation</h3>
        <p style="margin: 0 0 15px;">In this no-pressure meeting, we'll discuss:</p>
        <ul style="margin: 0; padding-left: 20px;">
          <li style="margin-bottom: 8px;">What you're looking for in your next home</li>
          <li style="margin-bottom: 8px;">Your ideal neighborhoods and budget</li>
          <li style="margin-bottom: 8px;">Current market conditions and opportunities</li>
          <li style="margin-bottom: 8px;">The home buying timeline and process</li>
        </ul>
      </div>

      <p>Whether you're ready to start looking this weekend or just planning for the future, I'm happy to help at whatever pace works for you.</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${SITE_URL}/contact/" style="display: inline-block; background: #C99C33; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 18px;">Schedule Your Free Consultation</a>
      </div>

      <p>You can also reach me directly:</p>
      <ul style="list-style: none; padding: 0;">
        <li style="margin-bottom: 8px;"><strong>Phone:</strong> <a href="tel:6097890126" style="color: #C99C33;">(609) 789-0126</a></li>
        <li style="margin-bottom: 8px;"><strong>Email:</strong> <a href="mailto:sf@stevenfrato.com" style="color: #C99C33;">sf@stevenfrato.com</a></li>
        <li><strong>Text:</strong> Same number - I respond quickly!</li>
      </ul>

      <p style="margin-top: 25px;">Looking forward to helping you find home,</p>
      <p><strong>Steven Frato</strong><br>Century 21<br>Your ${town} Real Estate Guide</p>

      <p style="margin-top: 25px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666;">
        <strong>P.S.</strong> The best homes don't stay on the market long. Even if you're not ready to buy today, let's talk about what you're looking for so I can keep an eye out for you.
      </p>
    </div>

    <div style="border-top: 1px solid #ddd; padding: 20px; font-size: 12px; color: #666; text-align: center;">
      <p style="margin: 0 0 10px;">136 Farnsworth Ave, Bordentown, NJ 08505 | (609) 789-0126</p>
      <p style="margin: 0;"><a href="${unsubscribeUrl}" style="color: #999;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>
      `,
      text: `Let's Find Your Perfect ${town} Home

Hi ${lead.name},

Over the past two weeks, I've shared neighborhood insights, buying strategies, and financing options. Now I'd like to offer you something more personal.

FREE BUYER CONSULTATION

In this no-pressure meeting, we'll discuss:
- What you're looking for in your next home
- Your ideal neighborhoods and budget
- Current market conditions and opportunities
- The home buying timeline and process

Schedule your free consultation: ${SITE_URL}/contact/

Or reach me directly:
Phone: (609) 789-0126
Email: sf@stevenfrato.com
Text: Same number - I respond quickly!

Looking forward to helping you find home,
Steven Frato
Century 21

P.S. The best homes don't stay on the market long. Let's talk about what you're looking for.

---
Unsubscribe: ${unsubscribeUrl}`,
    };
  },

  // ============================================
  // BOTH TRACK TEMPLATES (Buy & Sell)
  // ============================================

  // Both track - Day 0 (Welcome)
  "both-1-welcome": (lead, zipData, unsubscribeUrl) => {
    const town = lead.town || "your area";
    const medianPrice = formatCurrency(zipData?.median_sale_price ?? null);
    const marketType = getMarketTypeLabel(zipData?.market_type ?? "balanced");

    return {
      subject: `Your ${town} Buy & Sell Strategy Starts Here`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f6f6f6;">
  <div style="background: #ffffff; border-radius: 8px; overflow: hidden;">
    <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #C99C33;">
      <h1 style="color: #1a1a1a; margin: 0;">Steven Frato</h1>
      <p style="color: #C99C33; margin: 5px 0 0; font-weight: 600;">CENTURY 21</p>
    </div>

    <div style="padding: 30px;">
      <h2 style="color: #1a1a1a;">Your ${town} Buy & Sell Strategy Starts Here</h2>

      <p>Hi ${lead.name},</p>

      <p>Buying and selling at the same time is one of the more complex real estate situations - but with the right strategy, it can go smoothly. I'm here to help you navigate both transactions successfully.</p>

      <table style="width: 100%; border-collapse: collapse; margin: 25px 0;">
        <tr>
          <td style="width: 48%; background: #f9f9f9; padding: 20px; border-radius: 8px 0 0 8px; text-align: center; vertical-align: top;">
            <p style="font-size: 12px; font-weight: 600; color: #C99C33; text-transform: uppercase; margin: 0 0 5px;">Selling</p>
            <p style="font-size: 14px; color: #666; margin: 0 0 15px;">Your Current Home</p>
            <p style="font-size: 24px; font-weight: bold; color: #1a1a1a; margin: 0;">${medianPrice}</p>
            <p style="font-size: 12px; color: #999; margin: 5px 0 0;">Median in ${town}</p>
          </td>
          <td style="width: 4%; background: #e0e0e0;"></td>
          <td style="width: 48%; background: #f9f9f9; padding: 20px; border-radius: 0 8px 8px 0; text-align: center; vertical-align: top;">
            <p style="font-size: 12px; font-weight: 600; color: #C99C33; text-transform: uppercase; margin: 0 0 5px;">Buying</p>
            <p style="font-size: 14px; color: #666; margin: 0 0 15px;">Your Next Home</p>
            <p style="font-size: 24px; font-weight: bold; color: #1a1a1a; margin: 0;">${marketType}</p>
            <p style="font-size: 12px; color: #999; margin: 5px 0 0;">Current Conditions</p>
          </td>
        </tr>
      </table>

      <h3 style="color: #1a1a1a;">The Key Questions We'll Answer Together</h3>
      <ul style="padding-left: 20px;">
        <li style="margin-bottom: 10px;">Should you sell first, buy first, or try to do both simultaneously?</li>
        <li style="margin-bottom: 10px;">What's your current home worth in today's market?</li>
        <li style="margin-bottom: 10px;">How can you avoid being homeless between transactions?</li>
        <li style="margin-bottom: 10px;">What financing options make sense for your situation?</li>
        <li style="margin-bottom: 10px;">How do you make a competitive offer when your purchase depends on your sale?</li>
      </ul>

      <div style="background: linear-gradient(135deg, rgba(201, 156, 51, 0.1) 0%, rgba(201, 156, 51, 0.2) 100%); padding: 20px; border-radius: 8px; border-left: 4px solid #C99C33; margin: 25px 0;">
        <p style="margin: 0 0 10px; font-weight: 600;">Every situation is different</p>
        <p style="margin: 0; font-size: 14px; color: #666;">The best strategy depends on your specific circumstances - your timeline, your finances, and your priorities. I'd love to learn more about your situation.</p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${SITE_URL}/contact/" style="display: inline-block; background: #C99C33; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600;">Let's Discuss Your Plan</a>
      </div>

      <p>Looking forward to helping you make your move,<br><strong>Steven Frato</strong><br>Century 21<br>(609) 789-0126</p>
    </div>

    <div style="border-top: 1px solid #ddd; padding: 20px; font-size: 12px; color: #666; text-align: center;">
      <p style="margin: 0 0 10px;">136 Farnsworth Ave, Bordentown, NJ 08505</p>
      <p style="margin: 0;"><a href="${unsubscribeUrl}" style="color: #999;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>
      `,
      text: `Your ${town} Buy & Sell Strategy Starts Here

Hi ${lead.name},

Buying and selling at the same time is complex - but with the right strategy, it can go smoothly.

SELLING: Median in ${town}: ${medianPrice}
BUYING: Current Conditions: ${marketType}

KEY QUESTIONS WE'LL ANSWER:
- Should you sell first, buy first, or both simultaneously?
- What's your current home worth?
- How to avoid being homeless between transactions?
- What financing options make sense?
- How to make competitive offers?

Let's discuss your plan: ${SITE_URL}/contact/

Looking forward to helping you make your move,
Steven Frato
Century 21
(609) 789-0126

---
Unsubscribe: ${unsubscribeUrl}`,
    };
  },

  // Both track - Day 3 (Timing)
  "both-2-timing": (lead, zipData, unsubscribeUrl) => {
    const town = lead.town || "your area";
    const marketType = zipData?.market_type ?? "balanced";

    return {
      subject: "Timing Your Move: Buy First or Sell First?",
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f6f6f6;">
  <div style="background: #ffffff; border-radius: 8px; overflow: hidden;">
    <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #C99C33;">
      <h1 style="color: #1a1a1a; margin: 0;">Steven Frato</h1>
      <p style="color: #C99C33; margin: 5px 0 0; font-weight: 600;">CENTURY 21</p>
    </div>

    <div style="padding: 30px;">
      <h2 style="color: #1a1a1a;">Timing Your Move: Buy First or Sell First?</h2>

      <p>Hi ${lead.name},</p>

      <p>This is the most common question I get from people in your situation. The answer depends on several factors. Let me break down the three main approaches.</p>

      <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0 0 10px; font-weight: 600; color: #C99C33;">Option 1: Sell First</p>
        <p style="margin: 0 0 10px; font-size: 14px;"><strong>Best when:</strong> You need equity from your current home for the down payment, or you're in a competitive buying market.</p>
        <p style="margin: 0; font-size: 14px; color: #666;"><strong>Challenge:</strong> You may need temporary housing or a rent-back agreement.</p>
      </div>

      <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0 0 10px; font-weight: 600; color: #C99C33;">Option 2: Buy First</p>
        <p style="margin: 0 0 10px; font-size: 14px;"><strong>Best when:</strong> You have savings for two mortgages temporarily, or your current home will sell quickly.</p>
        <p style="margin: 0; font-size: 14px; color: #666;"><strong>Challenge:</strong> Carrying two mortgages can be stressful and expensive.</p>
      </div>

      <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0 0 10px; font-weight: 600; color: #C99C33;">Option 3: Simultaneous Closings</p>
        <p style="margin: 0 0 10px; font-size: 14px;"><strong>Best when:</strong> You can coordinate timelines and have flexibility on both ends.</p>
        <p style="margin: 0; font-size: 14px; color: #666;"><strong>Challenge:</strong> Requires careful coordination and backup plans.</p>
      </div>

      <div style="background: linear-gradient(135deg, rgba(201, 156, 51, 0.1) 0%, rgba(201, 156, 51, 0.2) 100%); padding: 20px; border-radius: 8px; border-left: 4px solid #C99C33; margin: 25px 0;">
        <p style="margin: 0 0 10px; font-weight: 600;">My Recommendation for ${town}'s Market</p>
        <p style="margin: 0; font-size: 14px; color: #666;">${marketType === "seller"
          ? "In the current seller's market, your home will likely sell quickly. Consider listing first with a flexible closing date, then house hunting aggressively."
          : marketType === "buyer"
          ? "With more inventory available, you have time to find your next home first. Consider making your purchase contingent on selling, which is more acceptable in this market."
          : "The balanced market gives you flexibility. I'd recommend getting your home market-ready first, then starting your search - ready to list when you find the right place."}</p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${SITE_URL}/contact/" style="display: inline-block; background: #C99C33; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600;">Let's Discuss Your Timing</a>
      </div>

      <p>Next time, I'll help you understand what your current home might be worth in today's market.</p>

      <p>Best,<br><strong>Steven</strong></p>
    </div>

    <div style="border-top: 1px solid #ddd; padding: 20px; font-size: 12px; color: #666; text-align: center;">
      <p style="margin: 0 0 10px;">136 Farnsworth Ave, Bordentown, NJ 08505 | (609) 789-0126</p>
      <p style="margin: 0;"><a href="${unsubscribeUrl}" style="color: #999;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>
      `,
      text: `Timing Your Move: Buy First or Sell First?

Hi ${lead.name},

The three main approaches:

OPTION 1: SELL FIRST
Best when: You need equity for down payment
Challenge: May need temporary housing

OPTION 2: BUY FIRST
Best when: You can handle two mortgages temporarily
Challenge: Financial stress of carrying both

OPTION 3: SIMULTANEOUS CLOSINGS
Best when: You have flexibility on both ends
Challenge: Requires careful coordination

Let's discuss your timing: ${SITE_URL}/contact/

Best,
Steven

---
Unsubscribe: ${unsubscribeUrl}`,
    };
  },

  // Both track - Day 7 (Value)
  "both-3-value": (lead, zipData, unsubscribeUrl) => {
    const town = lead.town || "your area";
    const medianPrice = formatCurrency(zipData?.median_sale_price ?? null);
    const priceChange = formatPercentChange(zipData?.median_sale_price_yoy ?? null);
    const isPositive = (zipData?.median_sale_price_yoy ?? 0) >= 0;

    return {
      subject: `What's Your ${town} Home Worth Today?`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f6f6f6;">
  <div style="background: #ffffff; border-radius: 8px; overflow: hidden;">
    <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #C99C33;">
      <h1 style="color: #1a1a1a; margin: 0;">Steven Frato</h1>
      <p style="color: #C99C33; margin: 5px 0 0; font-weight: 600;">CENTURY 21</p>
    </div>

    <div style="padding: 30px;">
      <h2 style="color: #1a1a1a;">What's Your ${town} Home Worth Today?</h2>

      <p>Hi ${lead.name},</p>

      <p>Understanding your current home's value is crucial for planning your buy-and-sell strategy. Here's what's happening in ${town}.</p>

      <div style="background: #1a1a1a; padding: 25px; border-radius: 8px; margin: 25px 0; text-align: center;">
        <p style="font-size: 12px; color: #999; text-transform: uppercase; margin: 0 0 10px;">${town} Median Sale Price</p>
        <p style="font-size: 36px; font-weight: bold; color: #C99C33; margin: 0;">${medianPrice}</p>
        <p style="font-size: 16px; color: ${isPositive ? '#4CAF50' : '#f44336'}; margin: 10px 0 0;">${priceChange} from last year</p>
      </div>

      <h3 style="color: #1a1a1a;">What Affects Your Home's Value</h3>

      <ul style="padding-left: 20px;">
        <li style="margin-bottom: 10px;"><strong>Location within ${town}:</strong> Even within the same zip code, different streets and neighborhoods can vary significantly.</li>
        <li style="margin-bottom: 10px;"><strong>Updates and condition:</strong> Recent renovations, especially kitchens and bathrooms, can add substantial value.</li>
        <li style="margin-bottom: 10px;"><strong>Lot size and features:</strong> Larger lots, privacy, and outdoor amenities are increasingly valuable.</li>
        <li style="margin-bottom: 10px;"><strong>Recent comparable sales:</strong> What similar homes have actually sold for in the past 3-6 months.</li>
      </ul>

      <div style="background: linear-gradient(135deg, rgba(201, 156, 51, 0.1) 0%, rgba(201, 156, 51, 0.2) 100%); padding: 20px; border-radius: 8px; border-left: 4px solid #C99C33; margin: 25px 0;">
        <p style="margin: 0 0 10px; font-weight: 600;">Get an Accurate Estimate</p>
        <p style="margin: 0; font-size: 14px; color: #666;">Online estimates can be off by 10-20%. A professional comparative market analysis looks at the specific features of your home and recent sales in your immediate area.</p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${SITE_URL}/contact/" style="display: inline-block; background: #C99C33; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600;">Get Your Free Home Valuation</a>
      </div>

      <p>Next, I'll share tips for finding your next home while managing the sale of your current one.</p>

      <p>Best,<br><strong>Steven</strong></p>
    </div>

    <div style="border-top: 1px solid #ddd; padding: 20px; font-size: 12px; color: #666; text-align: center;">
      <p style="margin: 0 0 10px;">136 Farnsworth Ave, Bordentown, NJ 08505 | (609) 789-0126</p>
      <p style="margin: 0;"><a href="${unsubscribeUrl}" style="color: #999;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>
      `,
      text: `What's Your ${town} Home Worth Today?

Hi ${lead.name},

${town} MEDIAN SALE PRICE: ${medianPrice}
Year-over-year change: ${priceChange}

WHAT AFFECTS YOUR HOME'S VALUE:
- Location within ${town}
- Updates and condition
- Lot size and features
- Recent comparable sales

Online estimates can be off by 10-20%. Get an accurate professional analysis.

Get your free home valuation: ${SITE_URL}/contact/

Best,
Steven

---
Unsubscribe: ${unsubscribeUrl}`,
    };
  },

  // Both track - Day 10 (Search)
  "both-4-search": (lead, zipData, unsubscribeUrl) => {
    const county = lead.county || "your county";
    const inventory = zipData?.inventory ?? 45;

    return {
      subject: `Finding Your Next Home in ${county}`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f6f6f6;">
  <div style="background: #ffffff; border-radius: 8px; overflow: hidden;">
    <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #C99C33;">
      <h1 style="color: #1a1a1a; margin: 0;">Steven Frato</h1>
      <p style="color: #C99C33; margin: 5px 0 0; font-weight: 600;">CENTURY 21</p>
    </div>

    <div style="padding: 30px;">
      <h2 style="color: #1a1a1a;">Finding Your Next Home in ${county}</h2>

      <p>Hi ${lead.name},</p>

      <p>While managing the sale of your current home, you'll also be searching for your next one. Here's how to do both effectively.</p>

      <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
        <p style="font-size: 14px; color: #666; margin: 0 0 5px;">Current Inventory</p>
        <p style="font-size: 36px; font-weight: bold; color: #C99C33; margin: 0;">${inventory}</p>
        <p style="font-size: 12px; color: #999; margin: 5px 0 0;">Active listings nearby</p>
      </div>

      <h3 style="color: #1a1a1a;">Smart Search Strategies</h3>

      <p><strong>1. Define Your Must-Haves Early</strong><br>
      <span style="color: #666;">Know what you absolutely need versus what would be nice. This helps you act quickly when the right home appears.</span></p>

      <p><strong>2. Expand Your Search Area</strong><br>
      <span style="color: #666;">Consider neighboring towns that might offer better value or more inventory.</span></p>

      <p><strong>3. Get Pre-Approved</strong><br>
      <span style="color: #666;">Even if your purchase depends on your sale, lenders can pre-approve you based on projected proceeds.</span></p>

      <p><strong>4. Consider "Coming Soon" Listings</strong><br>
      <span style="color: #666;">Working with an agent gives you access to homes before they hit the market.</span></p>

      <div style="background: linear-gradient(135deg, rgba(201, 156, 51, 0.1) 0%, rgba(201, 156, 51, 0.2) 100%); padding: 20px; border-radius: 8px; border-left: 4px solid #C99C33; margin: 25px 0;">
        <p style="margin: 0 0 10px; font-weight: 600;">My Role in Your Search</p>
        <p style="margin: 0; font-size: 14px; color: #666;">I'll set up a customized search that alerts you to new listings matching your criteria. When something promising appears, we can view it quickly - before it's gone.</p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${SITE_URL}/contact/" style="display: inline-block; background: #C99C33; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600;">Set Up Your Home Search</a>
      </div>

      <p>In my next email, I'll share tips for coordinating both transactions smoothly.</p>

      <p>Best,<br><strong>Steven</strong></p>
    </div>

    <div style="border-top: 1px solid #ddd; padding: 20px; font-size: 12px; color: #666; text-align: center;">
      <p style="margin: 0 0 10px;">136 Farnsworth Ave, Bordentown, NJ 08505 | (609) 789-0126</p>
      <p style="margin: 0;"><a href="${unsubscribeUrl}" style="color: #999;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>
      `,
      text: `Finding Your Next Home in ${county}

Hi ${lead.name},

Current inventory nearby: ${inventory} active listings

SMART SEARCH STRATEGIES:

1. Define Your Must-Haves Early
2. Expand Your Search Area
3. Get Pre-Approved
4. Consider "Coming Soon" Listings

I'll set up a customized search that alerts you to new listings matching your criteria.

Set up your home search: ${SITE_URL}/contact/

Best,
Steven

---
Unsubscribe: ${unsubscribeUrl}`,
    };
  },

  // Both track - Day 12 (Coordination)
  "both-5-coordination": (lead, zipData, unsubscribeUrl) => {
    const town = lead.town || "your area";

    return {
      subject: "Coordinating Your Buy & Sell Transaction",
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f6f6f6;">
  <div style="background: #ffffff; border-radius: 8px; overflow: hidden;">
    <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #C99C33;">
      <h1 style="color: #1a1a1a; margin: 0;">Steven Frato</h1>
      <p style="color: #C99C33; margin: 5px 0 0; font-weight: 600;">CENTURY 21</p>
    </div>

    <div style="padding: 30px;">
      <h2 style="color: #1a1a1a;">Coordinating Your Buy & Sell Transaction</h2>

      <p>Hi ${lead.name},</p>

      <p>The trickiest part of buying and selling simultaneously is the coordination. Here are the strategies that help ensure a smooth transition.</p>

      <h3 style="color: #1a1a1a; margin-top: 25px;">Coordination Strategies</h3>

      <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 15px 0;">
        <p style="margin: 0 0 8px; font-weight: 600; color: #C99C33;">Rent-Back Agreements</p>
        <p style="margin: 0; font-size: 14px; color: #666;">You sell your home but rent it back from the buyer for a period (typically 30-60 days). This gives you time to find and close on your next home without moving twice.</p>
      </div>

      <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 15px 0;">
        <p style="margin: 0 0 8px; font-weight: 600; color: #C99C33;">Bridge Loans</p>
        <p style="margin: 0; font-size: 14px; color: #666;">Short-term financing that lets you buy your new home before selling your current one. You repay it when your home sells.</p>
      </div>

      <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 15px 0;">
        <p style="margin: 0 0 8px; font-weight: 600; color: #C99C33;">Contingent Offers</p>
        <p style="margin: 0; font-size: 14px; color: #666;">Make your purchase offer contingent on selling your home. More acceptable in buyer's markets or when you have a strong offer.</p>
      </div>

      <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 15px 0;">
        <p style="margin: 0 0 8px; font-weight: 600; color: #C99C33;">Flexible Closing Dates</p>
        <p style="margin: 0; font-size: 14px; color: #666;">Negotiate closing dates on both transactions to align as closely as possible.</p>
      </div>

      <div style="background: linear-gradient(135deg, rgba(201, 156, 51, 0.1) 0%, rgba(201, 156, 51, 0.2) 100%); padding: 20px; border-radius: 8px; border-left: 4px solid #C99C33; margin: 25px 0;">
        <p style="margin: 0 0 10px; font-weight: 600;">The Key to Success</p>
        <p style="margin: 0; font-size: 14px; color: #666;">Communication and contingency planning. Having backup options (temporary housing, storage, etc.) reduces stress even if you never need them.</p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${SITE_URL}/contact/" style="display: inline-block; background: #C99C33; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600;">Let's Plan Your Coordination</a>
      </div>

      <p>In my final email, I'll offer to help you put together a comprehensive plan for your move.</p>

      <p>Best,<br><strong>Steven</strong></p>
    </div>

    <div style="border-top: 1px solid #ddd; padding: 20px; font-size: 12px; color: #666; text-align: center;">
      <p style="margin: 0 0 10px;">136 Farnsworth Ave, Bordentown, NJ 08505 | (609) 789-0126</p>
      <p style="margin: 0;"><a href="${unsubscribeUrl}" style="color: #999;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>
      `,
      text: `Coordinating Your Buy & Sell Transaction

Hi ${lead.name},

COORDINATION STRATEGIES:

1. Rent-Back Agreements - Stay in your sold home while finding the next one

2. Bridge Loans - Buy before you sell with short-term financing

3. Contingent Offers - Make purchase contingent on your sale

4. Flexible Closing Dates - Align both transactions

THE KEY: Communication and contingency planning.

Let's plan your coordination: ${SITE_URL}/contact/

Best,
Steven

---
Unsubscribe: ${unsubscribeUrl}`,
    };
  },

  // Both track - Day 14 (Consultation)
  "both-6-consultation": (lead, zipData, unsubscribeUrl) => {
    const town = lead.town || "your area";

    return {
      subject: `Let's Plan Your ${town} Move Together`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f6f6f6;">
  <div style="background: #ffffff; border-radius: 8px; overflow: hidden;">
    <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #C99C33;">
      <h1 style="color: #1a1a1a; margin: 0;">Steven Frato</h1>
      <p style="color: #C99C33; margin: 5px 0 0; font-weight: 600;">CENTURY 21</p>
    </div>

    <div style="padding: 30px;">
      <h2 style="color: #1a1a1a;">Let's Plan Your ${town} Move Together</h2>

      <p>Hi ${lead.name},</p>

      <p>Over the past two weeks, I've shared strategies for timing, valuation, searching, and coordinating a buy-and-sell transaction. Now let's put it all together for your specific situation.</p>

      <div style="background: linear-gradient(135deg, rgba(201, 156, 51, 0.1) 0%, rgba(201, 156, 51, 0.2) 100%); padding: 25px; border-radius: 8px; border-left: 4px solid #C99C33; margin: 25px 0;">
        <h3 style="margin: 0 0 15px; color: #1a1a1a;">Free Strategy Session</h3>
        <p style="margin: 0 0 15px;">In this personalized consultation, we'll:</p>
        <ul style="margin: 0; padding-left: 20px;">
          <li style="margin-bottom: 8px;">Evaluate your current home's market position</li>
          <li style="margin-bottom: 8px;">Discuss your next home requirements and budget</li>
          <li style="margin-bottom: 8px;">Determine the best timing strategy for your situation</li>
          <li style="margin-bottom: 8px;">Create a coordination plan that minimizes stress</li>
          <li style="margin-bottom: 8px;">Answer all your questions about the process</li>
        </ul>
      </div>

      <p>Every buy-and-sell situation is unique. A strategy that works for one family might not work for another. That's why a personalized approach matters.</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${SITE_URL}/contact/" style="display: inline-block; background: #C99C33; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 18px;">Schedule Your Strategy Session</a>
      </div>

      <p>You can also reach me directly:</p>
      <ul style="list-style: none; padding: 0;">
        <li style="margin-bottom: 8px;"><strong>Phone:</strong> <a href="tel:6097890126" style="color: #C99C33;">(609) 789-0126</a></li>
        <li style="margin-bottom: 8px;"><strong>Email:</strong> <a href="mailto:sf@stevenfrato.com" style="color: #C99C33;">sf@stevenfrato.com</a></li>
        <li><strong>Text:</strong> Same number - I respond quickly!</li>
      </ul>

      <p style="margin-top: 25px;">Looking forward to helping you make your move,</p>
      <p><strong>Steven Frato</strong><br>Century 21<br>Your ${town} Real Estate Partner</p>

      <p style="margin-top: 25px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666;">
        <strong>P.S.</strong> The most successful buy-and-sell transactions start with a solid plan. Let's create yours together - no obligation, just good advice.
      </p>
    </div>

    <div style="border-top: 1px solid #ddd; padding: 20px; font-size: 12px; color: #666; text-align: center;">
      <p style="margin: 0 0 10px;">136 Farnsworth Ave, Bordentown, NJ 08505 | (609) 789-0126</p>
      <p style="margin: 0;"><a href="${unsubscribeUrl}" style="color: #999;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>
      `,
      text: `Let's Plan Your ${town} Move Together

Hi ${lead.name},

FREE STRATEGY SESSION

In this personalized consultation, we'll:
- Evaluate your current home's market position
- Discuss your next home requirements and budget
- Determine the best timing strategy
- Create a coordination plan
- Answer all your questions

Schedule your strategy session: ${SITE_URL}/contact/

Phone: (609) 789-0126
Email: sf@stevenfrato.com
Text: Same number!

Looking forward to helping you make your move,
Steven Frato
Century 21

P.S. The most successful buy-and-sell transactions start with a solid plan.

---
Unsubscribe: ${unsubscribeUrl}`,
    };
  },

  // ============================================
  // INVESTOR TRACK TEMPLATES
  // ============================================

  // Investor track - Day 0 (Welcome)
  "investor-1-welcome": (lead, zipData, unsubscribeUrl) => {
    const county = lead.county || "your county";
    const medianPrice = formatCurrency(zipData?.median_sale_price ?? null);
    const priceChange = formatPercentChange(zipData?.median_sale_price_yoy ?? null);
    const inventory = zipData?.inventory ?? 45;
    const isPositive = (zipData?.median_sale_price_yoy ?? 0) >= 0;

    return {
      subject: `${county} Investment Property Overview`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f6f6f6;">
  <div style="background: #ffffff; border-radius: 8px; overflow: hidden;">
    <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #C99C33;">
      <h1 style="color: #1a1a1a; margin: 0;">Steven Frato</h1>
      <p style="color: #C99C33; margin: 5px 0 0; font-weight: 600;">CENTURY 21</p>
    </div>

    <div style="padding: 30px;">
      <h2 style="color: #1a1a1a;">${county} Investment Property Overview</h2>

      <p>Hi ${lead.name},</p>

      <p>Thank you for your interest in ${county} investment properties. This area offers solid opportunities for investors who understand the local market dynamics.</p>

      <table style="width: 100%; border-collapse: collapse; margin: 25px 0;">
        <tr>
          <td style="width: 32%; background: #1a1a1a; padding: 20px 15px; border-radius: 8px 0 0 8px; text-align: center;">
            <p style="font-size: 11px; color: #999; text-transform: uppercase; margin: 0 0 8px;">Median Price</p>
            <p style="font-size: 22px; font-weight: bold; color: #C99C33; margin: 0;">${medianPrice}</p>
          </td>
          <td style="width: 2%; background: #333;"></td>
          <td style="width: 32%; background: #1a1a1a; padding: 20px 15px; text-align: center;">
            <p style="font-size: 11px; color: #999; text-transform: uppercase; margin: 0 0 8px;">YoY Change</p>
            <p style="font-size: 22px; font-weight: bold; color: ${isPositive ? '#4CAF50' : '#f44336'}; margin: 0;">${priceChange}</p>
          </td>
          <td style="width: 2%; background: #333;"></td>
          <td style="width: 32%; background: #1a1a1a; padding: 20px 15px; border-radius: 0 8px 8px 0; text-align: center;">
            <p style="font-size: 11px; color: #999; text-transform: uppercase; margin: 0 0 8px;">Inventory</p>
            <p style="font-size: 22px; font-weight: bold; color: #C99C33; margin: 0;">${inventory}</p>
          </td>
        </tr>
      </table>

      <h3 style="color: #1a1a1a;">Why ${county} for Investment?</h3>
      <ul style="padding-left: 20px;">
        <li style="margin-bottom: 10px;"><strong>Strong rental demand:</strong> Proximity to Philadelphia and major employers creates consistent tenant interest</li>
        <li style="margin-bottom: 10px;"><strong>Appreciation potential:</strong> Year-over-year price growth indicates a healthy market trajectory</li>
        <li style="margin-bottom: 10px;"><strong>Diverse property types:</strong> From single-family rentals to multi-unit opportunities</li>
        <li style="margin-bottom: 10px;"><strong>Lower entry points:</strong> More accessible than Philadelphia metro while maintaining strong fundamentals</li>
      </ul>

      <div style="background: linear-gradient(135deg, rgba(201, 156, 51, 0.1) 0%, rgba(201, 156, 51, 0.2) 100%); padding: 20px; border-radius: 8px; border-left: 4px solid #C99C33; margin: 25px 0;">
        <p style="margin: 0 0 10px; font-weight: 600;">Over the Coming Weeks</p>
        <p style="margin: 0; font-size: 14px; color: #666;">I'll share more detailed analysis including ROI frameworks, local hotspots, and tax considerations for New Jersey investors.</p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${SITE_URL}/contact/" style="display: inline-block; background: #C99C33; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600;">Discuss Investment Opportunities</a>
      </div>

      <p>Looking forward to helping you invest wisely,<br><strong>Steven Frato</strong><br>Century 21<br>(609) 789-0126</p>
    </div>

    <div style="border-top: 1px solid #ddd; padding: 20px; font-size: 12px; color: #666; text-align: center;">
      <p style="margin: 0 0 10px;">136 Farnsworth Ave, Bordentown, NJ 08505</p>
      <p style="margin: 0;"><a href="${unsubscribeUrl}" style="color: #999;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>
      `,
      text: `${county} Investment Property Overview

Hi ${lead.name},

MARKET METRICS:
- Median Price: ${medianPrice}
- Year-over-Year Change: ${priceChange}
- Active Inventory: ${inventory}

WHY ${county.toUpperCase()} FOR INVESTMENT?
- Strong rental demand near Philadelphia
- Solid appreciation potential
- Diverse property types
- Lower entry points than Philly metro

Discuss investment opportunities: ${SITE_URL}/contact/

Looking forward to helping you invest wisely,
Steven Frato
Century 21
(609) 789-0126

---
Unsubscribe: ${unsubscribeUrl}`,
    };
  },

  // Investor track - Day 3 (ROI)
  "investor-2-roi": (lead, zipData, unsubscribeUrl) => {
    const town = lead.town || "your area";
    const medianPrice = formatCurrency(zipData?.median_sale_price ?? null);

    return {
      subject: `ROI Analysis: What to Expect in ${town}`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f6f6f6;">
  <div style="background: #ffffff; border-radius: 8px; overflow: hidden;">
    <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #C99C33;">
      <h1 style="color: #1a1a1a; margin: 0;">Steven Frato</h1>
      <p style="color: #C99C33; margin: 5px 0 0; font-weight: 600;">CENTURY 21</p>
    </div>

    <div style="padding: 30px;">
      <h2 style="color: #1a1a1a;">ROI Analysis: What to Expect in ${town}</h2>

      <p>Hi ${lead.name},</p>

      <p>Understanding potential returns is crucial before any investment. Here's a framework for evaluating ${town} investment properties.</p>

      <h3 style="color: #1a1a1a; margin-top: 25px;">Key ROI Metrics</h3>

      <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 15px 0;">
        <p style="margin: 0 0 8px; font-weight: 600; color: #C99C33;">Cash-on-Cash Return</p>
        <p style="margin: 0; font-size: 14px; color: #666;">Annual pre-tax cash flow divided by total cash invested. Target 8-12% for single-family rentals in this area.</p>
      </div>

      <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 15px 0;">
        <p style="margin: 0 0 8px; font-weight: 600; color: #C99C33;">Cap Rate</p>
        <p style="margin: 0; font-size: 14px; color: #666;">Net Operating Income / Property Value. Expect 5-8% for well-located properties in ${town}.</p>
      </div>

      <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 15px 0;">
        <p style="margin: 0 0 8px; font-weight: 600; color: #C99C33;">1% Rule</p>
        <p style="margin: 0; font-size: 14px; color: #666;">Monthly rent should be ~1% of purchase price. With ${medianPrice} median, target $${Math.round((zipData?.median_sale_price ?? 350000) * 0.01).toLocaleString()}/month.</p>
      </div>

      <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 15px 0;">
        <p style="margin: 0 0 8px; font-weight: 600; color: #C99C33;">Total Return</p>
        <p style="margin: 0; font-size: 14px; color: #666;">Cash flow + appreciation + principal paydown + tax benefits. The full picture of investment performance.</p>
      </div>

      <div style="background: linear-gradient(135deg, rgba(201, 156, 51, 0.1) 0%, rgba(201, 156, 51, 0.2) 100%); padding: 20px; border-radius: 8px; border-left: 4px solid #C99C33; margin: 25px 0;">
        <p style="margin: 0 0 10px; font-weight: 600;">Pro Tip</p>
        <p style="margin: 0; font-size: 14px; color: #666;">Don't chase the highest cap rate. Properties with lower caps in better locations often outperform long-term through appreciation and tenant quality.</p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${SITE_URL}/contact/" style="display: inline-block; background: #C99C33; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600;">Analyze a Specific Property</a>
      </div>

      <p>Next, I'll share the specific neighborhoods and property types offering the best opportunities right now.</p>

      <p>Best,<br><strong>Steven</strong></p>
    </div>

    <div style="border-top: 1px solid #ddd; padding: 20px; font-size: 12px; color: #666; text-align: center;">
      <p style="margin: 0 0 10px;">136 Farnsworth Ave, Bordentown, NJ 08505 | (609) 789-0126</p>
      <p style="margin: 0;"><a href="${unsubscribeUrl}" style="color: #999;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>
      `,
      text: `ROI Analysis: What to Expect in ${town}

Hi ${lead.name},

KEY ROI METRICS:

1. Cash-on-Cash Return: Target 8-12% for single-family rentals

2. Cap Rate: Expect 5-8% for well-located properties

3. 1% Rule: Monthly rent ~1% of purchase price

4. Total Return: Cash flow + appreciation + principal paydown + tax benefits

PRO TIP: Don't chase highest cap rates. Better locations often outperform long-term.

Analyze a specific property: ${SITE_URL}/contact/

Best,
Steven

---
Unsubscribe: ${unsubscribeUrl}`,
    };
  },

  // Investor track - Day 7 (Opportunities)
  "investor-3-opportunities": (lead, zipData, unsubscribeUrl) => {
    const county = lead.county || "your county";

    return {
      subject: `Investment Hotspots in ${county}`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f6f6f6;">
  <div style="background: #ffffff; border-radius: 8px; overflow: hidden;">
    <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #C99C33;">
      <h1 style="color: #1a1a1a; margin: 0;">Steven Frato</h1>
      <p style="color: #C99C33; margin: 5px 0 0; font-weight: 600;">CENTURY 21</p>
    </div>

    <div style="padding: 30px;">
      <h2 style="color: #1a1a1a;">Investment Hotspots in ${county}</h2>

      <p>Hi ${lead.name},</p>

      <p>Not all areas offer the same investment potential. Here's where I'm seeing the best opportunities in ${county} right now.</p>

      <h3 style="color: #1a1a1a; margin-top: 25px;">Property Types to Consider</h3>

      <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 15px 0;">
        <p style="margin: 0 0 8px; font-weight: 600; color: #C99C33;">Single-Family Rentals</p>
        <p style="margin: 0; font-size: 14px; color: #666;">Lower maintenance, longer tenant stays, easier financing. Ideal for newer investors.</p>
      </div>

      <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 15px 0;">
        <p style="margin: 0 0 8px; font-weight: 600; color: #C99C33;">Small Multi-Family (2-4 units)</p>
        <p style="margin: 0; font-size: 14px; color: #666;">Still qualifies for residential financing. Multiple income streams reduce vacancy risk.</p>
      </div>

      <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 15px 0;">
        <p style="margin: 0 0 8px; font-weight: 600; color: #C99C33;">Value-Add Properties</p>
        <p style="margin: 0; font-size: 14px; color: #666;">Properties needing updates that can be bought below market, improved, and rented at higher rates.</p>
      </div>

      <h3 style="color: #1a1a1a; margin-top: 25px;">What I Look For</h3>
      <ul style="padding-left: 20px;">
        <li style="margin-bottom: 10px;">Strong school districts (attracts family renters who stay longer)</li>
        <li style="margin-bottom: 10px;">Proximity to employment centers and transit</li>
        <li style="margin-bottom: 10px;">Areas with improving infrastructure or development</li>
        <li style="margin-bottom: 10px;">Properties below replacement cost</li>
      </ul>

      <div style="background: linear-gradient(135deg, rgba(201, 156, 51, 0.1) 0%, rgba(201, 156, 51, 0.2) 100%); padding: 20px; border-radius: 8px; border-left: 4px solid #C99C33; margin: 25px 0;">
        <p style="margin: 0 0 10px; font-weight: 600;">Off-Market Opportunities</p>
        <p style="margin: 0; font-size: 14px; color: #666;">Some of the best deals never hit the public market. I can connect you with motivated sellers and pre-market opportunities.</p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${SITE_URL}/contact/" style="display: inline-block; background: #C99C33; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600;">Get Investment Property Alerts</a>
      </div>

      <p>Next time, I'll cover the tax considerations every New Jersey investor should know.</p>

      <p>Best,<br><strong>Steven</strong></p>
    </div>

    <div style="border-top: 1px solid #ddd; padding: 20px; font-size: 12px; color: #666; text-align: center;">
      <p style="margin: 0 0 10px;">136 Farnsworth Ave, Bordentown, NJ 08505 | (609) 789-0126</p>
      <p style="margin: 0;"><a href="${unsubscribeUrl}" style="color: #999;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>
      `,
      text: `Investment Hotspots in ${county}

Hi ${lead.name},

PROPERTY TYPES TO CONSIDER:

1. Single-Family Rentals - Lower maintenance, easier financing

2. Small Multi-Family (2-4 units) - Multiple income streams

3. Value-Add Properties - Buy below market, improve, rent higher

WHAT I LOOK FOR:
- Strong school districts
- Proximity to employment and transit
- Areas with improving infrastructure
- Properties below replacement cost

OFF-MARKET: Some best deals never hit public market. I can connect you with pre-market opportunities.

Get investment property alerts: ${SITE_URL}/contact/

Best,
Steven

---
Unsubscribe: ${unsubscribeUrl}`,
    };
  },

  // Investor track - Day 11 (Tax)
  "investor-4-tax": (lead, zipData, unsubscribeUrl) => {
    const county = lead.county || "your county";

    return {
      subject: `Tax Considerations for ${county} Investors`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f6f6f6;">
  <div style="background: #ffffff; border-radius: 8px; overflow: hidden;">
    <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #C99C33;">
      <h1 style="color: #1a1a1a; margin: 0;">Steven Frato</h1>
      <p style="color: #C99C33; margin: 5px 0 0; font-weight: 600;">CENTURY 21</p>
    </div>

    <div style="padding: 30px;">
      <h2 style="color: #1a1a1a;">Tax Considerations for ${county} Investors</h2>

      <p>Hi ${lead.name},</p>

      <p>New Jersey has specific tax considerations that can significantly impact your investment returns. Here's what to keep in mind.</p>

      <h3 style="color: #1a1a1a; margin-top: 25px;">Key Tax Benefits</h3>

      <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 15px 0;">
        <p style="margin: 0 0 8px; font-weight: 600; color: #C99C33;">Depreciation</p>
        <p style="margin: 0; font-size: 14px; color: #666;">Deduct the cost of the building (not land) over 27.5 years. This paper loss offsets rental income.</p>
      </div>

      <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 15px 0;">
        <p style="margin: 0 0 8px; font-weight: 600; color: #C99C33;">Deductible Expenses</p>
        <p style="margin: 0; font-size: 14px; color: #666;">Mortgage interest, property taxes, insurance, repairs, property management, and travel to the property.</p>
      </div>

      <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 15px 0;">
        <p style="margin: 0 0 8px; font-weight: 600; color: #C99C33;">1031 Exchange</p>
        <p style="margin: 0; font-size: 14px; color: #666;">Defer capital gains by reinvesting proceeds into another investment property within specific timeframes.</p>
      </div>

      <h3 style="color: #1a1a1a; margin-top: 25px;">NJ-Specific Considerations</h3>
      <ul style="padding-left: 20px;">
        <li style="margin-bottom: 10px;"><strong>Property taxes:</strong> NJ has high property taxes. Factor this into your cash flow calculations.</li>
        <li style="margin-bottom: 10px;"><strong>State income tax:</strong> Rental income is taxable at NJ state rates.</li>
        <li style="margin-bottom: 10px;"><strong>LLC considerations:</strong> NJ has specific requirements for LLCs holding real estate.</li>
      </ul>

      <div style="background: linear-gradient(135deg, rgba(201, 156, 51, 0.1) 0%, rgba(201, 156, 51, 0.2) 100%); padding: 20px; border-radius: 8px; border-left: 4px solid #C99C33; margin: 25px 0;">
        <p style="margin: 0 0 10px; font-weight: 600;">Important</p>
        <p style="margin: 0; font-size: 14px; color: #666;">I always recommend working with a CPA who specializes in real estate investments. I can provide referrals to professionals I trust.</p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${SITE_URL}/contact/" style="display: inline-block; background: #C99C33; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600;">Get CPA Recommendations</a>
      </div>

      <p>In my final email, I'll offer to discuss your specific investment goals and strategy.</p>

      <p>Best,<br><strong>Steven</strong></p>
    </div>

    <div style="border-top: 1px solid #ddd; padding: 20px; font-size: 12px; color: #666; text-align: center;">
      <p style="margin: 0 0 10px;">136 Farnsworth Ave, Bordentown, NJ 08505 | (609) 789-0126</p>
      <p style="margin: 0;"><a href="${unsubscribeUrl}" style="color: #999;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>
      `,
      text: `Tax Considerations for ${county} Investors

Hi ${lead.name},

KEY TAX BENEFITS:

1. Depreciation - Deduct building cost over 27.5 years

2. Deductible Expenses - Interest, taxes, insurance, repairs, management

3. 1031 Exchange - Defer capital gains by reinvesting

NJ-SPECIFIC CONSIDERATIONS:
- High property taxes - factor into cash flow
- State income tax on rental income
- LLC requirements for real estate

IMPORTANT: Work with a CPA who specializes in real estate. I can provide referrals.

Get CPA recommendations: ${SITE_URL}/contact/

Best,
Steven

---
Unsubscribe: ${unsubscribeUrl}`,
    };
  },

  // Investor track - Day 14 (Consultation)
  "investor-5-consultation": (lead, zipData, unsubscribeUrl) => {
    const county = lead.county || "your county";

    return {
      subject: "Let's Discuss Your Investment Strategy",
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f6f6f6;">
  <div style="background: #ffffff; border-radius: 8px; overflow: hidden;">
    <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #C99C33;">
      <h1 style="color: #1a1a1a; margin: 0;">Steven Frato</h1>
      <p style="color: #C99C33; margin: 5px 0 0; font-weight: 600;">CENTURY 21</p>
    </div>

    <div style="padding: 30px;">
      <h2 style="color: #1a1a1a;">Let's Discuss Your Investment Strategy</h2>

      <p>Hi ${lead.name},</p>

      <p>Over the past two weeks, I've shared market data, ROI frameworks, local opportunities, and tax considerations. Now let's talk about your specific investment goals.</p>

      <div style="background: linear-gradient(135deg, rgba(201, 156, 51, 0.1) 0%, rgba(201, 156, 51, 0.2) 100%); padding: 25px; border-radius: 8px; border-left: 4px solid #C99C33; margin: 25px 0;">
        <h3 style="margin: 0 0 15px; color: #1a1a1a;">Free Investor Consultation</h3>
        <p style="margin: 0 0 15px;">In this strategy session, we'll discuss:</p>
        <ul style="margin: 0; padding-left: 20px;">
          <li style="margin-bottom: 8px;">Your investment criteria and budget</li>
          <li style="margin-bottom: 8px;">Cash flow vs. appreciation priorities</li>
          <li style="margin-bottom: 8px;">Current opportunities matching your goals</li>
          <li style="margin-bottom: 8px;">Financing strategies for investors</li>
          <li style="margin-bottom: 8px;">Building or expanding your portfolio</li>
        </ul>
      </div>

      <p>Whether you're buying your first investment property or adding to an existing portfolio, I can help you identify opportunities that match your criteria.</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${SITE_URL}/contact/" style="display: inline-block; background: #C99C33; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 18px;">Schedule Investor Consultation</a>
      </div>

      <p>You can also reach me directly:</p>
      <ul style="list-style: none; padding: 0;">
        <li style="margin-bottom: 8px;"><strong>Phone:</strong> <a href="tel:6097890126" style="color: #C99C33;">(609) 789-0126</a></li>
        <li style="margin-bottom: 8px;"><strong>Email:</strong> <a href="mailto:sf@stevenfrato.com" style="color: #C99C33;">sf@stevenfrato.com</a></li>
        <li><strong>Text:</strong> Same number - I respond quickly!</li>
      </ul>

      <p style="margin-top: 25px;">Looking forward to helping you build wealth through real estate,</p>
      <p><strong>Steven Frato</strong><br>Century 21<br>Your ${county} Investment Partner</p>

      <p style="margin-top: 25px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666;">
        <strong>P.S.</strong> Investment-grade properties don't stay on the market long. Let me know your criteria and I'll alert you when matching opportunities arise.
      </p>
    </div>

    <div style="border-top: 1px solid #ddd; padding: 20px; font-size: 12px; color: #666; text-align: center;">
      <p style="margin: 0 0 10px;">136 Farnsworth Ave, Bordentown, NJ 08505 | (609) 789-0126</p>
      <p style="margin: 0;"><a href="${unsubscribeUrl}" style="color: #999;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>
      `,
      text: `Let's Discuss Your Investment Strategy

Hi ${lead.name},

FREE INVESTOR CONSULTATION

In this strategy session, we'll discuss:
- Your investment criteria and budget
- Cash flow vs. appreciation priorities
- Current opportunities matching your goals
- Financing strategies for investors
- Building or expanding your portfolio

Schedule investor consultation: ${SITE_URL}/contact/

Phone: (609) 789-0126
Email: sf@stevenfrato.com
Text: Same number!

Looking forward to helping you build wealth through real estate,
Steven Frato
Century 21

P.S. Investment-grade properties don't stay on the market long. Let me know your criteria.

---
Unsubscribe: ${unsubscribeUrl}`,
    };
  },

  // ============================================
  // GENERAL TRACK TEMPLATES
  // ============================================

  // General track - Day 0 (Welcome)
  "general-1-welcome": (lead, zipData, unsubscribeUrl) => {
    const town = lead.town || "your area";
    const county = lead.county || "your county";

    return {
      subject: `Thank You for Your Interest in ${town} Real Estate`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f6f6f6;">
  <div style="background: #ffffff; border-radius: 8px; overflow: hidden;">
    <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #C99C33;">
      <h1 style="color: #1a1a1a; margin: 0;">Steven Frato</h1>
      <p style="color: #C99C33; margin: 5px 0 0; font-weight: 600;">CENTURY 21</p>
    </div>

    <div style="padding: 30px;">
      <h2 style="color: #1a1a1a;">Thank You for Your Interest in ${town} Real Estate</h2>

      <p>Hi ${lead.name},</p>

      <p>Thank you for reaching out about real estate in ${town}. Whether you're just starting to explore your options or have specific questions, I'm here to help.</p>

      <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 3px solid #C99C33;">
        <p style="font-size: 14px; font-weight: 600; color: #C99C33; text-transform: uppercase; margin: 0 0 10px;">A Bit About Me</p>
        <p style="margin: 0; font-size: 15px; color: #666;">I'm a local real estate agent with Century 21, serving ${county} and the surrounding areas. I believe in providing honest, straightforward advice - no pressure, just helpful information to guide your decisions.</p>
      </div>

      <h3 style="color: #1a1a1a;">How I Can Help</h3>

      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="width: 48%; background: #f9f9f9; padding: 20px; border-radius: 8px; vertical-align: top;">
            <p style="margin: 0 0 8px; font-weight: 600;">Selling Your Home</p>
            <p style="margin: 0; font-size: 14px; color: #666;">From pricing strategy to closing day, I'll guide you through the entire process.</p>
          </td>
          <td style="width: 4%;"></td>
          <td style="width: 48%; background: #f9f9f9; padding: 20px; border-radius: 8px; vertical-align: top;">
            <p style="margin: 0 0 8px; font-weight: 600;">Buying a Home</p>
            <p style="margin: 0; font-size: 14px; color: #666;">Whether first-time or experienced, I'll help you find the right home at the right price.</p>
          </td>
        </tr>
        <tr><td colspan="3" style="height: 15px;"></td></tr>
        <tr>
          <td style="width: 48%; background: #f9f9f9; padding: 20px; border-radius: 8px; vertical-align: top;">
            <p style="margin: 0 0 8px; font-weight: 600;">Market Information</p>
            <p style="margin: 0; font-size: 14px; color: #666;">Curious about values, trends, or what's happening in your neighborhood?</p>
          </td>
          <td style="width: 4%;"></td>
          <td style="width: 48%; background: #f9f9f9; padding: 20px; border-radius: 8px; vertical-align: top;">
            <p style="margin: 0 0 8px; font-weight: 600;">Just Questions</p>
            <p style="margin: 0; font-size: 14px; color: #666;">Not sure where to start? I'm glad to answer questions with no obligation.</p>
          </td>
        </tr>
      </table>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${SITE_URL}/contact/" style="display: inline-block; background: #C99C33; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600;">Let's Connect</a>
      </div>

      <p>Over the next couple of weeks, I'll share some helpful information about the ${county} real estate market. If you have specific questions before then, don't hesitate to reach out.</p>

      <p>Looking forward to helping you,<br><strong>Steven Frato</strong><br>Century 21<br>(609) 789-0126</p>
    </div>

    <div style="border-top: 1px solid #ddd; padding: 20px; font-size: 12px; color: #666; text-align: center;">
      <p style="margin: 0 0 10px;">136 Farnsworth Ave, Bordentown, NJ 08505</p>
      <p style="margin: 0;"><a href="${unsubscribeUrl}" style="color: #999;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>
      `,
      text: `Thank You for Your Interest in ${town} Real Estate

Hi ${lead.name},

Thank you for reaching out about real estate in ${town}. Whether you're exploring options or have specific questions, I'm here to help.

HOW I CAN HELP:
- Selling Your Home
- Buying a Home
- Market Information
- Just Questions - no obligation

Let's connect: ${SITE_URL}/contact/

Looking forward to helping you,
Steven Frato
Century 21
(609) 789-0126

---
Unsubscribe: ${unsubscribeUrl}`,
    };
  },

  // General track - Day 4 (Overview)
  "general-2-overview": (lead, zipData, unsubscribeUrl) => {
    const county = lead.county || "your county";
    const medianPrice = formatCurrency(zipData?.median_sale_price ?? null);
    const priceChange = formatPercentChange(zipData?.median_sale_price_yoy ?? null);
    const marketType = getMarketTypeLabel(zipData?.market_type ?? "balanced");

    return {
      subject: `${county} Market Overview: What You Should Know`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f6f6f6;">
  <div style="background: #ffffff; border-radius: 8px; overflow: hidden;">
    <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #C99C33;">
      <h1 style="color: #1a1a1a; margin: 0;">Steven Frato</h1>
      <p style="color: #C99C33; margin: 5px 0 0; font-weight: 600;">CENTURY 21</p>
    </div>

    <div style="padding: 30px;">
      <h2 style="color: #1a1a1a;">${county} Market Overview</h2>

      <p>Hi ${lead.name},</p>

      <p>Whether you're considering buying, selling, or just curious about the market, here's what's happening in ${county} right now.</p>

      <div style="background: #f9f9f9; padding: 25px; border-radius: 8px; margin: 25px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #e0e0e0;">
              <span style="color: #666;">Median Sale Price</span>
            </td>
            <td style="padding: 10px 0; border-bottom: 1px solid #e0e0e0; text-align: right; font-weight: 600;">
              ${medianPrice}
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #e0e0e0;">
              <span style="color: #666;">Year-over-Year Change</span>
            </td>
            <td style="padding: 10px 0; border-bottom: 1px solid #e0e0e0; text-align: right; font-weight: 600; color: ${(zipData?.median_sale_price_yoy ?? 0) >= 0 ? '#4CAF50' : '#f44336'};">
              ${priceChange}
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 0;">
              <span style="color: #666;">Market Conditions</span>
            </td>
            <td style="padding: 10px 0; text-align: right; font-weight: 600;">
              ${marketType}
            </td>
          </tr>
        </table>
      </div>

      <h3 style="color: #1a1a1a;">What This Means</h3>

      <p><strong>For Sellers:</strong> ${zipData?.market_type === "seller"
        ? "Strong conditions with homes selling quickly. It's a good time to list if you're considering selling."
        : zipData?.market_type === "buyer"
        ? "More competition means pricing strategy is crucial. Well-prepared homes still sell well."
        : "Balanced conditions mean realistic pricing and good presentation lead to successful sales."}</p>

      <p><strong>For Buyers:</strong> ${zipData?.market_type === "seller"
        ? "Be prepared to act quickly when you find the right home. Pre-approval is essential."
        : zipData?.market_type === "buyer"
        ? "You have more options and negotiating power. Take time to find the right fit."
        : "A balanced market gives you room to make thoughtful decisions without excessive pressure."}</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${SITE_URL}/contact/" style="display: inline-block; background: #C99C33; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600;">Ask Me Anything</a>
      </div>

      <p>Next time, I'll share more about how I can help with your specific real estate goals.</p>

      <p>Best,<br><strong>Steven</strong></p>
    </div>

    <div style="border-top: 1px solid #ddd; padding: 20px; font-size: 12px; color: #666; text-align: center;">
      <p style="margin: 0 0 10px;">136 Farnsworth Ave, Bordentown, NJ 08505 | (609) 789-0126</p>
      <p style="margin: 0;"><a href="${unsubscribeUrl}" style="color: #999;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>
      `,
      text: `${county} Market Overview

Hi ${lead.name},

CURRENT MARKET:
- Median Sale Price: ${medianPrice}
- Year-over-Year Change: ${priceChange}
- Market Conditions: ${marketType}

Ask me anything: ${SITE_URL}/contact/

Best,
Steven

---
Unsubscribe: ${unsubscribeUrl}`,
    };
  },

  // General track - Day 8 (Services)
  "general-3-services": (lead, zipData, unsubscribeUrl) => {
    return {
      subject: "How I Can Help With Your Real Estate Goals",
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f6f6f6;">
  <div style="background: #ffffff; border-radius: 8px; overflow: hidden;">
    <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #C99C33;">
      <h1 style="color: #1a1a1a; margin: 0;">Steven Frato</h1>
      <p style="color: #C99C33; margin: 5px 0 0; font-weight: 600;">CENTURY 21</p>
    </div>

    <div style="padding: 30px;">
      <h2 style="color: #1a1a1a;">How I Can Help With Your Real Estate Goals</h2>

      <p>Hi ${lead.name},</p>

      <p>Every real estate situation is different. Here's a bit more about my approach and how I work with clients.</p>

      <h3 style="color: #1a1a1a; margin-top: 25px;">My Approach</h3>

      <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 15px 0;">
        <p style="margin: 0 0 8px; font-weight: 600; color: #C99C33;">Education First</p>
        <p style="margin: 0; font-size: 14px; color: #666;">I believe informed clients make better decisions. I'll explain everything clearly so you understand your options.</p>
      </div>

      <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 15px 0;">
        <p style="margin: 0 0 8px; font-weight: 600; color: #C99C33;">No Pressure</p>
        <p style="margin: 0; font-size: 14px; color: #666;">Real estate decisions are big ones. I'm here to advise, not to push. Your timeline is your timeline.</p>
      </div>

      <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 15px 0;">
        <p style="margin: 0 0 8px; font-weight: 600; color: #C99C33;">Local Expertise</p>
        <p style="margin: 0; font-size: 14px; color: #666;">I live and work in this community. I know the neighborhoods, the market trends, and the local considerations that matter.</p>
      </div>

      <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 15px 0;">
        <p style="margin: 0 0 8px; font-weight: 600; color: #C99C33;">Full Service</p>
        <p style="margin: 0; font-size: 14px; color: #666;">From first conversation to closing and beyond, I'm here to help with whatever you need.</p>
      </div>

      <div style="background: linear-gradient(135deg, rgba(201, 156, 51, 0.1) 0%, rgba(201, 156, 51, 0.2) 100%); padding: 20px; border-radius: 8px; border-left: 4px solid #C99C33; margin: 25px 0;">
        <p style="margin: 0 0 10px; font-weight: 600;">Not Sure What You Need?</p>
        <p style="margin: 0; font-size: 14px; color: #666;">That's okay. Sometimes a conversation is the best way to figure out next steps. I'm happy to chat with no agenda.</p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${SITE_URL}/contact/" style="display: inline-block; background: #C99C33; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600;">Let's Have a Conversation</a>
      </div>

      <p>Best,<br><strong>Steven</strong></p>
    </div>

    <div style="border-top: 1px solid #ddd; padding: 20px; font-size: 12px; color: #666; text-align: center;">
      <p style="margin: 0 0 10px;">136 Farnsworth Ave, Bordentown, NJ 08505 | (609) 789-0126</p>
      <p style="margin: 0;"><a href="${unsubscribeUrl}" style="color: #999;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>
      `,
      text: `How I Can Help With Your Real Estate Goals

Hi ${lead.name},

MY APPROACH:

1. Education First - Informed clients make better decisions

2. No Pressure - Your timeline is your timeline

3. Local Expertise - I know the neighborhoods and market

4. Full Service - From first conversation to closing

Not sure what you need? Let's have a conversation with no agenda.

Let's talk: ${SITE_URL}/contact/

Best,
Steven

---
Unsubscribe: ${unsubscribeUrl}`,
    };
  },

  // General track - Day 14 (Available)
  "general-4-available": (lead, zipData, unsubscribeUrl) => {
    return {
      subject: "I'm Here When You're Ready",
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f6f6f6;">
  <div style="background: #ffffff; border-radius: 8px; overflow: hidden;">
    <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #C99C33;">
      <h1 style="color: #1a1a1a; margin: 0;">Steven Frato</h1>
      <p style="color: #C99C33; margin: 5px 0 0; font-weight: 600;">CENTURY 21</p>
    </div>

    <div style="padding: 30px;">
      <h2 style="color: #1a1a1a;">I'm Here When You're Ready</h2>

      <p>Hi ${lead.name},</p>

      <p>I wanted to reach out one more time to let you know I'm here whenever you have questions or decide to take the next step with your real estate goals.</p>

      <p>There's no expiration date on my offer to help. Whether you reach out tomorrow, next month, or next year, I'll be happy to hear from you.</p>

      <div style="background: linear-gradient(135deg, rgba(201, 156, 51, 0.1) 0%, rgba(201, 156, 51, 0.2) 100%); padding: 25px; border-radius: 8px; border-left: 4px solid #C99C33; margin: 25px 0;">
        <p style="margin: 0 0 15px; font-weight: 600;">How to Reach Me</p>
        <ul style="margin: 0; padding-left: 20px;">
          <li style="margin-bottom: 8px;"><strong>Phone:</strong> <a href="tel:6097890126" style="color: #C99C33;">(609) 789-0126</a></li>
          <li style="margin-bottom: 8px;"><strong>Email:</strong> <a href="mailto:sf@stevenfrato.com" style="color: #C99C33;">sf@stevenfrato.com</a></li>
          <li><strong>Text:</strong> Same phone number - I respond quickly!</li>
        </ul>
      </div>

      <p>In the meantime, if you'd like to stay updated on the local market, feel free to visit my website anytime for current market data.</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${SITE_URL}/market/" style="display: inline-block; background: #C99C33; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600;">View Market Data</a>
      </div>

      <p>Wishing you all the best,</p>
      <p><strong>Steven Frato</strong><br>Century 21<br>(609) 789-0126</p>

      <p style="margin-top: 25px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666;">
        <strong>P.S.</strong> This is my last scheduled email, but I'm always just a phone call or email away. Don't hesitate to reach out with any questions.
      </p>
    </div>

    <div style="border-top: 1px solid #ddd; padding: 20px; font-size: 12px; color: #666; text-align: center;">
      <p style="margin: 0 0 10px;">136 Farnsworth Ave, Bordentown, NJ 08505 | (609) 789-0126</p>
      <p style="margin: 0;"><a href="${unsubscribeUrl}" style="color: #999;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>
      `,
      text: `I'm Here When You're Ready

Hi ${lead.name},

I'm here whenever you have questions or decide to take the next step with your real estate goals. There's no expiration date on my offer to help.

HOW TO REACH ME:
- Phone: (609) 789-0126
- Email: sf@stevenfrato.com
- Text: Same phone number!

View market data: ${SITE_URL}/market/

Wishing you all the best,
Steven Frato
Century 21

P.S. This is my last scheduled email, but I'm always just a phone call away.

---
Unsubscribe: ${unsubscribeUrl}`,
    };
  },
};

// Default template for any missing template IDs
function defaultTemplate(
  lead: ScheduledEmailWithDetails["lead"],
  step: ScheduledEmailWithDetails["campaign_step"],
  zipData: ZipcodeData | null,
  unsubscribeUrl: string
): { subject: string; html: string; text: string } {
  const town = lead.town || "your area";
  const county = lead.county || "your county";

  // Replace template variables in subject
  const subject = step.subject_template
    .replace(/\{town\}/g, town)
    .replace(/\{county\}/g, county)
    .replace(/\{name\}/g, lead.name);

  return {
    subject,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f6f6f6;">
  <div style="background: #ffffff; border-radius: 8px; overflow: hidden;">
    <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #C99C33;">
      <h1 style="color: #1a1a1a; margin: 0;">Steven Frato</h1>
      <p style="color: #C99C33; margin: 5px 0 0; font-weight: 600;">CENTURY 21</p>
    </div>

    <div style="padding: 30px;">
      <h2 style="color: #1a1a1a;">${subject}</h2>
      <p>Hi ${lead.name},</p>
      <p>I wanted to reach out with more information about ${town}'s real estate market. If you have any questions or would like to discuss your options, please don't hesitate to contact me.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${SITE_URL}/contact/" style="display: inline-block; background: #C99C33; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600;">Get in Touch</a>
      </div>
      <p>Best regards,<br><strong>Steven Frato</strong><br>Century 21<br>(609) 789-0126</p>
    </div>

    <div style="border-top: 1px solid #ddd; padding: 20px; font-size: 12px; color: #666; text-align: center;">
      <p style="margin: 0;"><a href="${unsubscribeUrl}" style="color: #999;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>
    `,
    text: `${subject}

Hi ${lead.name},

I wanted to reach out with more information about ${town}'s real estate market. If you have any questions or would like to discuss your options, please don't hesitate to contact me.

Get in touch: ${SITE_URL}/contact/

Best regards,
Steven Frato
Century 21
(609) 789-0126

---
Unsubscribe: ${unsubscribeUrl}`,
  };
}

// Send a single email
async function sendEmail(
  scheduledEmail: ScheduledEmailWithDetails,
  zipData: ZipcodeData | null
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const unsubscribeUrl = generateUnsubscribeUrl(scheduledEmail.lead.id);

  // Get the template renderer
  const templateRenderer = emailTemplates[scheduledEmail.campaign_step.template_id];

  // Render the email
  const emailContent = templateRenderer
    ? templateRenderer(scheduledEmail.lead, zipData, unsubscribeUrl)
    : defaultTemplate(scheduledEmail.lead, scheduledEmail.campaign_step, zipData, unsubscribeUrl);

  try {
    const command = new SendEmailCommand({
      Source: `Steven Frato <${SES_SENDER_EMAIL}>`,
      Destination: {
        ToAddresses: [scheduledEmail.lead.email],
      },
      Message: {
        Subject: {
          Data: emailContent.subject,
          Charset: "UTF-8",
        },
        Body: {
          Html: { Data: emailContent.html, Charset: "UTF-8" },
          Text: { Data: emailContent.text, Charset: "UTF-8" },
        },
      },
      ReplyToAddresses: [STEVEN_EMAIL],
      ConfigurationSetName: SES_CONFIGURATION_SET,
    });

    const result = await sesClient.send(command);
    return { success: true, messageId: result.MessageId };
  } catch (error) {
    console.error(`Failed to send email ${scheduledEmail.id}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
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

  console.log("Starting scheduled email processing...");

  const stats = {
    processed: 0,
    sent: 0,
    failed: 0,
    errors: [] as string[],
  };

  try {
    // Query pending emails that are due
    const { data: pendingEmails, error: queryError } = await supabase
      .from("scheduled_emails")
      .select(`
        id,
        lead_id,
        campaign_step_id,
        scheduled_for,
        status,
        attempts,
        max_attempts,
        lead:leads!inner(
          id,
          email,
          name,
          address,
          town,
          zipcode,
          county,
          status,
          campaign_id,
          current_step
        ),
        campaign_step:campaign_steps!inner(
          id,
          step_number,
          template_id,
          subject_template,
          delay_days,
          send_hour,
          campaign_id
        )
      `)
      .eq("status", "pending")
      .lte("scheduled_for", new Date().toISOString())
      .lt("attempts", 3)
      .limit(BATCH_SIZE);

    if (queryError) {
      throw new Error(`Failed to query pending emails: ${queryError.message}`);
    }

    if (!pendingEmails || pendingEmails.length === 0) {
      console.log("No pending emails to process");
      return new Response(
        JSON.stringify({
          success: true,
          message: "No pending emails to process",
          ...stats,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Processing ${pendingEmails.length} pending emails...`);

    // Process each email
    for (const email of pendingEmails as unknown as ScheduledEmailWithDetails[]) {
      stats.processed++;

      // Skip if lead is no longer active
      if (email.lead.status !== "active") {
        console.log(`Skipping email ${email.id} - lead is ${email.lead.status}`);
        await supabase
          .from("scheduled_emails")
          .update({ status: "failed", error_message: `Lead is ${email.lead.status}` })
          .eq("id", email.id);
        continue;
      }

      // Mark as sending
      await supabase
        .from("scheduled_emails")
        .update({ status: "sending", attempts: email.attempts + 1 })
        .eq("id", email.id);

      // Fetch zipcode data for personalization
      let zipData: ZipcodeData | null = null;
      if (email.lead.zipcode) {
        const { data } = await supabase
          .from("zipcode_data")
          .select("*")
          .eq("zipcode", email.lead.zipcode)
          .single();
        zipData = data;
      }

      // Send the email
      const result = await sendEmail(email, zipData);

      if (result.success) {
        stats.sent++;

        // Update scheduled email
        await supabase
          .from("scheduled_emails")
          .update({
            status: "sent",
            ses_message_id: result.messageId,
            sent_at: new Date().toISOString(),
          })
          .eq("id", email.id);

        // Update lead's current step
        await supabase
          .from("leads")
          .update({
            current_step: email.campaign_step.step_number,
          })
          .eq("id", email.lead.id);

        // Find and update next email time
        const { data: nextStep } = await supabase
          .from("campaign_steps")
          .select("id, delay_days, send_hour")
          .eq("campaign_id", email.campaign_step.campaign_id)
          .eq("step_number", email.campaign_step.step_number + 1)
          .single();

        if (nextStep) {
          const nextEmailAt = new Date();
          nextEmailAt.setDate(nextEmailAt.getDate() + (nextStep.delay_days - email.campaign_step.delay_days));
          nextEmailAt.setUTCHours(nextStep.send_hour + 5, 0, 0, 0);

          await supabase
            .from("leads")
            .update({ next_email_at: nextEmailAt.toISOString() })
            .eq("id", email.lead.id);
        } else {
          // No more emails in sequence
          await supabase
            .from("leads")
            .update({ next_email_at: null })
            .eq("id", email.lead.id);
        }

        console.log(`Successfully sent email ${email.id} to ${email.lead.email}`);
      } else {
        stats.failed++;
        stats.errors.push(`Email ${email.id}: ${result.error}`);

        // Update as failed if max attempts reached
        const newStatus = email.attempts + 1 >= email.max_attempts ? "failed" : "pending";

        await supabase
          .from("scheduled_emails")
          .update({
            status: newStatus,
            failed_at: newStatus === "failed" ? new Date().toISOString() : null,
            error_message: result.error,
          })
          .eq("id", email.id);

        console.error(`Failed to send email ${email.id}: ${result.error}`);
      }

      // Rate limiting
      await sleep(SES_RATE_LIMIT_MS);
    }

    console.log(`Processing complete: ${stats.sent} sent, ${stats.failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        ...stats,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error processing scheduled emails:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        ...stats,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
