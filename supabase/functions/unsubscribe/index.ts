/**
 * Unsubscribe Edge Function
 *
 * Handles unsubscribe link clicks from emails:
 * 1. Validates the token containing lead_id
 * 2. Updates lead status to 'unsubscribed'
 * 3. Cancels all pending scheduled emails
 * 4. Returns a confirmation page
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = Deno.env.get("SITE_URL") || "https://stevenfrato.com";

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Helper: Parse token to get lead ID
function parseToken(token: string): string | null {
  try {
    // Token format: base64(leadId:timestamp)
    const decoded = atob(token);
    const [leadId] = decoded.split(":");

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(leadId)) {
      return null;
    }

    return leadId;
  } catch {
    return null;
  }
}

// Generate the confirmation HTML page
function generateConfirmationPage(success: boolean, message: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${success ? "Unsubscribed" : "Error"} - Steven Frato Real Estate</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      background: linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
      max-width: 500px;
      width: 100%;
      overflow: hidden;
    }

    .header {
      background: #1a1a1a;
      color: white;
      padding: 30px;
      text-align: center;
    }

    .header h1 {
      font-size: 24px;
      margin-bottom: 5px;
    }

    .header p {
      color: #C99C33;
      font-weight: 600;
      font-size: 14px;
      letter-spacing: 1px;
    }

    .content {
      padding: 40px 30px;
      text-align: center;
    }

    .icon {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 25px;
      font-size: 40px;
    }

    .icon.success {
      background: #e8f5e9;
      color: #4CAF50;
    }

    .icon.error {
      background: #ffebee;
      color: #f44336;
    }

    .content h2 {
      font-size: 24px;
      margin-bottom: 15px;
      color: #1a1a1a;
    }

    .content p {
      color: #666;
      margin-bottom: 20px;
    }

    .btn {
      display: inline-block;
      background: #C99C33;
      color: white;
      padding: 12px 30px;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 600;
      transition: background 0.2s;
    }

    .btn:hover {
      background: #B38A1F;
    }

    .footer {
      border-top: 1px solid #eee;
      padding: 20px 30px;
      text-align: center;
      font-size: 14px;
      color: #999;
    }

    .footer a {
      color: #C99C33;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Steven Frato</h1>
      <p>CENTURY 21</p>
    </div>

    <div class="content">
      <div class="icon ${success ? "success" : "error"}">
        ${success ? "&#10003;" : "&#10007;"}
      </div>

      <h2>${success ? "You've Been Unsubscribed" : "Something Went Wrong"}</h2>

      <p>${message}</p>

      <a href="${SITE_URL}" class="btn">Visit Our Website</a>
    </div>

    <div class="footer">
      <p>Questions? Contact us at <a href="mailto:sf@stevenfrato.com">sf@stevenfrato.com</a></p>
      <p style="margin-top: 10px;">136 Farnsworth Ave, Bordentown, NJ 08505</p>
    </div>
  </div>
</body>
</html>
  `;
}

// Main handler
serve(async (req) => {
  // Allow both GET (from email link clicks) and POST
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Get token from query parameters
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response(
        generateConfirmationPage(
          false,
          "Invalid unsubscribe link. The link may have expired or been modified."
        ),
        {
          status: 400,
          headers: { "Content-Type": "text/html" },
        }
      );
    }

    // Parse the token to get lead ID
    const leadId = parseToken(token);

    if (!leadId) {
      return new Response(
        generateConfirmationPage(
          false,
          "Invalid unsubscribe link. The link may have expired or been modified."
        ),
        {
          status: 400,
          headers: { "Content-Type": "text/html" },
        }
      );
    }

    // Look up the lead
    const { data: lead, error: lookupError } = await supabase
      .from("leads")
      .select("id, email, name, status")
      .eq("id", leadId)
      .single();

    if (lookupError || !lead) {
      console.error("Lead not found:", leadId);
      return new Response(
        generateConfirmationPage(
          false,
          "We couldn't find your subscription. It may have already been removed."
        ),
        {
          status: 404,
          headers: { "Content-Type": "text/html" },
        }
      );
    }

    // Check if already unsubscribed
    if (lead.status === "unsubscribed") {
      return new Response(
        generateConfirmationPage(
          true,
          "You were already unsubscribed from our mailing list. You won't receive any more emails from us."
        ),
        {
          status: 200,
          headers: { "Content-Type": "text/html" },
        }
      );
    }

    // Update lead status to unsubscribed
    const { error: updateError } = await supabase
      .from("leads")
      .update({
        status: "unsubscribed",
        unsubscribed_at: new Date().toISOString(),
        next_email_at: null,
      })
      .eq("id", leadId);

    if (updateError) {
      console.error("Failed to update lead status:", updateError);
      return new Response(
        generateConfirmationPage(
          false,
          "We encountered an error processing your request. Please try again or contact us directly."
        ),
        {
          status: 500,
          headers: { "Content-Type": "text/html" },
        }
      );
    }

    // Cancel all pending scheduled emails
    const { error: cancelError } = await supabase
      .from("scheduled_emails")
      .update({
        status: "failed",
        error_message: "Cancelled - user unsubscribed",
        failed_at: new Date().toISOString(),
      })
      .eq("lead_id", leadId)
      .eq("status", "pending");

    if (cancelError) {
      console.error("Failed to cancel pending emails:", cancelError);
      // Don't fail the request - lead is already unsubscribed
    }

    console.log(`Lead ${leadId} (${lead.email}) unsubscribed successfully`);

    return new Response(
      generateConfirmationPage(
        true,
        "You've been successfully unsubscribed from our mailing list. You won't receive any more marketing emails from us. If you ever want to hear from us again, just visit our website or give us a call."
      ),
      {
        status: 200,
        headers: { "Content-Type": "text/html" },
      }
    );
  } catch (error) {
    console.error("Error processing unsubscribe:", error);
    return new Response(
      generateConfirmationPage(
        false,
        "An unexpected error occurred. Please try again or contact us at sf@stevenfrato.com."
      ),
      {
        status: 500,
        headers: { "Content-Type": "text/html" },
      }
    );
  }
});
