/**
 * Unsubscribe Proxy
 *
 * Every email we have ever sent links to `/.netlify/functions/unsubscribe`,
 * but the handler only ever existed as a Supabase edge function and no redirect
 * pointed at it — so every unsubscribe link 404'd. This proxies the request to
 * the real handler and returns its confirmation page verbatim.
 *
 * Proxying rather than rewriting the email templates is deliberate: it repairs
 * the links in messages that are already sitting in people's inboxes.
 */

import type { Handler, HandlerEvent } from "@netlify/functions";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CONTACT_EMAIL = "sf@stevenfrato.com";

/** Minimal standalone page for the cases where we can't reach the real handler. */
function fallbackPage(message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribe - Steven Frato Real Estate</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
           background: #f5f5f5; color: #333; display: flex; align-items: center;
           justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
    .card { background: #fff; border-radius: 12px; padding: 40px 30px; max-width: 500px;
            text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,.1); }
    h1 { font-size: 22px; margin: 0 0 15px; color: #1a1a1a; }
    p { color: #666; line-height: 1.6; }
    a { color: #8A6A12; }
  </style>
</head>
<body>
  <div class="card">
    <h1>We couldn't process that right now</h1>
    <p>${message}</p>
    <p>Email <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> and we'll remove you manually — you will not be emailed again either way.</p>
  </div>
</body>
</html>`;
}

const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== "GET" && event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const token = event.queryStringParameters?.token;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Unsubscribe proxy: Supabase env vars are not configured.");
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
      body: fallbackPage("Our unsubscribe service is temporarily unavailable."),
    };
  }

  if (!token) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
      body: fallbackPage("That unsubscribe link is missing its token."),
    };
  }

  try {
    const target = new URL(`${SUPABASE_URL}/functions/v1/unsubscribe`);
    target.searchParams.set("token", token);

    const response = await fetch(target.toString(), {
      method: "GET",
      headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
    });

    const body = await response.text();

    return {
      statusCode: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") ?? "text/html; charset=utf-8",
        // Never let a CDN or inbox proxy cache an unsubscribe result.
        "Cache-Control": "no-store",
      },
      body,
    };
  } catch (error) {
    console.error("Unsubscribe proxy failed:", error);
    return {
      statusCode: 502,
      headers: { "Content-Type": "text/html; charset=utf-8" },
      body: fallbackPage("We couldn't reach our unsubscribe service."),
    };
  }
};

export { handler };
