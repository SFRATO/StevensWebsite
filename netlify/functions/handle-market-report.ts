/**
 * Handle Market Report Form Submission
 *
 * This function handles form submissions from market pages,
 * generates a PDF report, and triggers the email sequence.
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
      name: params.get("name") || "",
      address: params.get("address") || "",
      town: params.get("town") || "",
      zipcode: params.get("zipcode") || "",
      email: params.get("email") || "",
      phone: params.get("phone") || undefined,
      "source-location": params.get("source-location") || "",
    };

    // Validate required fields
    if (!formData.email || !formData.name || !formData.address || !formData.town || !formData.zipcode) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing required fields" }),
      };
    }

    // Log submission (in production, you'd store this)
    console.log("Market report request received:", {
      name: formData.name,
      location: formData["source-location"],
      email: formData.email,
      town: formData.town,
      zipcode: formData.zipcode,
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
