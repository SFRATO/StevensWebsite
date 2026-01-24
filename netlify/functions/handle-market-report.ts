/**
 * Handle Market Report Form Submission
 *
 * This function handles form submissions from market pages,
 * generates a PDF report, and triggers the email sequence.
 */

import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";

interface FormSubmission {
  "form-name": string;
  "property-address": string;
  email: string;
  phone?: string;
  timeline?: string;
  "source-location": string;
}

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
      "property-address": params.get("property-address") || "",
      email: params.get("email") || "",
      phone: params.get("phone") || undefined,
      timeline: params.get("timeline") || undefined,
      "source-location": params.get("source-location") || "",
    };

    // Validate required fields
    if (!formData.email || !formData["property-address"]) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing required fields" }),
      };
    }

    // Log submission (in production, you'd store this)
    console.log("Market report request received:", {
      location: formData["source-location"],
      email: formData.email,
      timeline: formData.timeline,
    });

    // Trigger PDF generation (call the generate-pdf function)
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
          address: formData["property-address"],
        }),
      }
    );

    if (!pdfResponse.ok) {
      console.error("Failed to generate PDF:", await pdfResponse.text());
    }

    // Trigger email sequence (call the trigger-email-sequence function)
    const emailResponse = await fetch(
      `${process.env.URL}/.netlify/functions/trigger-email-sequence`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: formData.email,
          location: formData["source-location"],
          timeline: formData.timeline,
          propertyAddress: formData["property-address"],
        }),
      }
    );

    if (!emailResponse.ok) {
      console.error("Failed to trigger email sequence:", await emailResponse.text());
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
