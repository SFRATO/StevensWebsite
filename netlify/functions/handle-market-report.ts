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
  interest?: string | undefined;
  "source-location": string;

  /** "1" when this is step 2 of the exit-intent popup completing an existing signup. */
  qualify?: string;

  /**
   * "contact" for the general contact form, "market-report" (default) otherwise.
   * Contact submissions are a question, not a report request: zipcode is optional
   * and no PDF is generated for them.
   */
  "submission-type"?: string;

  /** Free-text message body from the contact form. */
  message?: string;

  /** Pathname the form was submitted from, used to build an accurate source_url. */
  "source-path"?: string;

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

    // Server-side honeypot: if the hidden bot-field is filled, silently drop the
    // submission (bots get a success-shaped response so they don't retry; no lead
    // is created and no downstream SES/Supabase work is done).
    if (params.get("bot-field")) {
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, message: "Your market report is being prepared." }),
      };
    }
    // TODO(security): add per-IP / per-email rate limiting here before launch.

    const formData: FormSubmission = {
      "form-name": params.get("form-name") || "",
      name: params.get("name") || "",
      address: params.get("address") || "",
      town: params.get("town") || "",
      zipcode: params.get("zipcode") || "",
      email: params.get("email") || "",
      phone: params.get("phone") || undefined,
      // Deliberately NOT defaulted to "selling" here. The Supabase function
      // applies that fallback itself, and it needs to distinguish "the visitor
      // chose an intent" from "nothing was submitted" — step 2 of the popup
      // leaves the question blank when it goes unanswered.
      interest: params.get("interest") || undefined,
      "source-location": params.get("source-location") || "",
      qualify: params.get("qualify") || undefined,

      // Qualification fields
      intent: params.get("intent") || undefined,
      timeline: params.get("timeline") || undefined,
      "property-type": params.get("property-type") || undefined,
      "value-range": params.get("value-range") || undefined,
      "budget-range": params.get("budget-range") || undefined,
      "important-factor": params.get("important-factor") || undefined,
      "pre-approved": params.get("pre-approved") || undefined,
      "contact-preference": params.get("contact-preference") || undefined,
      "lead-score": params.get("lead-score") || undefined,
      "lead-temperature": params.get("lead-temperature") || undefined,

      "submission-type": params.get("submission-type") || undefined,
      "source-path": params.get("source-path") || undefined,
      // Deliberately NOT run through the 200-char sanitizer the other fields use —
      // this is a prose body. The edge function caps and sanitizes it.
      message: params.get("message") || undefined,
    };

    const submissionType =
      formData["submission-type"] === "contact" ? "contact" : "market-report";

    // Validate required fields. town/address are OPTIONAL — the Supabase edge
    // function derives town from zipcode (zipcode_data). Requiring a non-empty town
    // here previously rejected the exit-intent popup (which sends town='') 100% of
    // the time, so the only pipeline-connected form created zero leads.
    if (!formData.email || !formData.name) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing required fields (name, email)." }),
      };
    }
    // Zipcode drives the zipcode_data lookup, the PDF, and every {town} token in
    // the drip subjects, so it stays required for report requests. The contact
    // form presents it as optional, so requiring it there returned 400 on every
    // submission that skipped it.
    if (submissionType === "market-report" && !formData.zipcode) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing required field (zipcode)." }),
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

    // Track whether the lead was durably persisted. We must NOT report success to
    // the visitor unless the lead actually landed (this handler previously always
    // returned 200, showing a "thank you" even when the lead was lost).
    let leadPersisted = false;
    // Signed, opaque handle for the browser (never the raw lead UUID). The
    // client stores it so step 2 of the popup and activity tracking can refer
    // back to this lead. See netlify/functions/_shared/tokens.ts.
    let leadToken: string | undefined;

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
              qualify: formData.qualify,
              utm_source: utmSource,
              utm_medium: utmMedium,
              utm_campaign: utmCampaign,
              // Qualification fields
              intent: formData.intent,
              timeline: formData.timeline,
              "property-type": formData["property-type"],
              "value-range": formData["value-range"],
              "budget-range": formData["budget-range"],
              "important-factor": formData["important-factor"],
              "pre-approved": formData["pre-approved"],
              "contact-preference": formData["contact-preference"],
              "lead-score": formData["lead-score"],
              "lead-temperature": formData["lead-temperature"],
              // Contact-form additions
              submission_type: submissionType,
              message: formData.message,
              source_path: formData["source-path"],
            }),
          }
        );

        if (!supabaseResponse.ok) {
          const errorText = await supabaseResponse.text();
          console.error("Supabase edge function error:", errorText);
        } else {
          const result = await supabaseResponse.json();
          console.log("Lead created in Supabase:", result);
          leadPersisted = true;
          leadToken = result?.lead_token;
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
        // NOTE: leadPersisted is deliberately NOT set here.
        //
        // trigger-email-sequence writes to no database — it sends two emails and
        // console.logs the sequence it "would" schedule. It also swallows its own
        // SES errors and returns 200 regardless, so `emailResponse.ok` says nothing
        // about whether the lead was stored. Treating it as persistence produced a
        // "thank you" for leads that existed nowhere, which is the exact failure the
        // leadPersisted guard below was written to prevent.
        //
        // Reaching this branch at all means SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
        // are unset, which is a misconfiguration. Returning 502 surfaces it instead
        // of hiding it behind a success message.
      } catch (emailError) {
        console.error("Error calling trigger-email-sequence:", emailError);
      }
    }

    // Trigger PDF generation (runs independently of email system).
    // Skipped for qualification follow-ups — step 2 of the popup is updating a
    // lead whose report was already generated seconds earlier — and for contact
    // submissions, which asked a question rather than requesting a report and may
    // carry no address or zipcode to build one from.
    if (formData.qualify !== "1" && submissionType !== "contact") {
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
    }

    // Only report success if the lead was durably persisted. Otherwise return a
    // non-2xx so the client shows a real error and the visitor can retry — never a
    // "thank you" while the lead is silently lost.
    if (!leadPersisted) {
      console.error("Lead NOT persisted — returning 502 so the client surfaces an error.", {
        email: formData.email,
        zipcode: formData.zipcode,
      });
      // TODO(reliability): enqueue this payload to a durable store (Netlify Blobs /
      // a failed_submissions table) and alert ops so no lead is ever dropped.
      return {
        statusCode: 502,
        body: JSON.stringify({
          success: false,
          error: "We couldn't save your request just now. Please try again in a moment.",
        }),
      };
    }

    // Return success
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        lead_token: leadToken,
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
