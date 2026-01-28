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
