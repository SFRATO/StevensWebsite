/**
 * Handle Market Report Form Submission
 *
 * This function handles form submissions from market pages,
 * forwards data to Supabase for lead management and email campaigns,
 * and triggers PDF generation.
 */

import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";

interface FormSubmission {
  "form-name": string;
  name: string;
  address: string;
  town: string;
  zipcode: string;
  email: string;
  phone?: string;
  interest?: string;
  "source-location": string;
}

// Supabase Edge Function URL for form handling
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    // Parse form data
    const body = event.body;
    if (!body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing form data" }),
      };
    }

    // Parse URL-encoded form data
    const params = new URLSearchParams(body);
    const formData: FormSubmission = {
      "form-name": params.get("form-name") || "",
      name: params.get("name") || "",
      address: params.get("address") || "",
      town: params.get("town") || "",
      zipcode: params.get("zipcode") || "",
      email: params.get("email") || "",
      phone: params.get("phone") || undefined,
      interest: params.get("interest") || "selling",
      "source-location": params.get("source-location") || "",
    };

    // Validate required fields
    if (!formData.email || !formData.name || !formData.address || !formData.town || !formData.zipcode) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing required fields" }),
      };
    }

    // Extract UTM parameters from referrer if available
    let utmSource: string | undefined;
    let utmMedium: string | undefined;
    let utmCampaign: string | undefined;

    const referer = event.headers.referer || event.headers.Referer;
    if (referer) {
      try {
        const refererUrl = new URL(referer);
        utmSource = refererUrl.searchParams.get("utm_source") || undefined;
        utmMedium = refererUrl.searchParams.get("utm_medium") || undefined;
        utmCampaign = refererUrl.searchParams.get("utm_campaign") || undefined;
      } catch {
        // Ignore URL parsing errors
      }
    }

    console.log("Market report request received:", {
      name: formData.name,
      location: formData["source-location"],
      email: formData.email,
      town: formData.town,
      zipcode: formData.zipcode,
      interest: formData.interest,
    });

    // Forward to Supabase Edge Function for lead management and email campaigns
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const supabaseResponse = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-form-submission`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              email: formData.email,
              name: formData.name,
              phone: formData.phone,
              address: formData.address,
              town: formData.town,
              zipcode: formData.zipcode,
              interest: formData.interest,
              "source-location": formData["source-location"],
              utm_source: utmSource,
              utm_medium: utmMedium,
              utm_campaign: utmCampaign,
            }),
          }
        );

        if (!supabaseResponse.ok) {
          const errorText = await supabaseResponse.text();
          console.error("Supabase edge function error:", errorText);
        } else {
          const result = await supabaseResponse.json();
          console.log("Lead created in Supabase:", result);
        }
      } catch (supabaseError) {
        console.error("Failed to call Supabase edge function:", supabaseError);
        // Continue with PDF generation even if Supabase fails
      }
    } else {
      console.warn("Supabase not configured - skipping lead management");

      // Fallback: Call the legacy trigger-email-sequence function
      try {
        const emailResponse = await fetch(
          `${process.env.URL}/.netlify/functions/trigger-email-sequence`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: formData.email,
              name: formData.name,
              location: formData["source-location"],
              address: formData.address,
              town: formData.town,
              zipcode: formData.zipcode,
              phone: formData.phone,
            }),
          }
        );

        if (!emailResponse.ok) {
          console.error("Failed to trigger email sequence:", await emailResponse.text());
        }
      } catch (emailError) {
        console.error("Error calling trigger-email-sequence:", emailError);
      }
    }

    // Trigger PDF generation (runs independently of email system)
    try {
      const pdfResponse = await fetch(
        `${process.env.URL}/.netlify/functions/generate-pdf`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            location: formData["source-location"],
            email: formData.email,
            name: formData.name,
            address: formData.address,
            town: formData.town,
            zipcode: formData.zipcode,
          }),
        }
      );

      if (!pdfResponse.ok) {
        console.error("Failed to generate PDF:", await pdfResponse.text());
      }
    } catch (pdfError) {
      console.error("Error calling generate-pdf:", pdfError);
    }

    // Return success
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: "Your market report is being prepared and will be sent to your email shortly.",
      }),
    };
  } catch (error) {
    console.error("Error handling form submission:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};

export { handler };
