/**
 * Signed Lead Tokens (Deno / edge functions)
 *
 * Replaces the previous `btoa(leadId:timestamp)` scheme, which was unsigned and
 * trivially enumerable — anyone could unsubscribe anyone by guessing a UUID.
 *
 * Format: `<base64url(payload)>.<base64url(hmac-sha256(purpose:payload))>`
 *
 * Tokens are namespaced by purpose so an unsubscribe link cannot be replayed as
 * an activity-tracking credential, and vice versa.
 *
 * The Node equivalent used by the Netlify functions lives in
 * `netlify/functions/_shared/tokens.ts` — the two MUST stay in sync.
 */

export type TokenPurpose = "unsubscribe" | "visitor";

const SECRET = Deno.env.get("LEAD_TOKEN_SECRET") ?? "";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function sign(purpose: TokenPurpose, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${purpose}:${payload}`),
  );
  return base64UrlEncode(new Uint8Array(signature));
}

/** Constant-time comparison so a wrong signature leaks no timing information. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Mint a signed token for a lead. */
export async function createToken(purpose: TokenPurpose, leadId: string): Promise<string> {
  if (!SECRET) {
    // Fail loudly in logs rather than silently issuing forgeable tokens.
    console.error("LEAD_TOKEN_SECRET is not set — tokens will not verify.");
  }
  const payload = base64UrlEncode(new TextEncoder().encode(leadId));
  return `${payload}.${await sign(purpose, payload)}`;
}

/**
 * Verify a token and return the lead id it carries, or null.
 *
 * `allowLegacy` accepts the old unsigned `btoa(leadId:timestamp)` format so
 * unsubscribe links already sitting in people's inboxes keep working. Legacy
 * acceptance is logged; drop it once the oldest sent campaign has aged out.
 */
export async function verifyToken(
  purpose: TokenPurpose,
  token: string,
  allowLegacy = false,
): Promise<string | null> {
  if (!token) return null;

  const dot = token.lastIndexOf(".");
  if (dot > 0) {
    const payload = token.slice(0, dot);
    const signature = token.slice(dot + 1);

    try {
      const expected = await sign(purpose, payload);
      if (!timingSafeEqual(signature, expected)) return null;

      const leadId = new TextDecoder().decode(base64UrlDecode(payload));
      return UUID_RE.test(leadId) ? leadId : null;
    } catch {
      return null;
    }
  }

  if (!allowLegacy) return null;

  // Legacy: base64(leadId:timestamp), unsigned.
  try {
    const [leadId] = atob(token).split(":");
    if (!UUID_RE.test(leadId)) return null;
    console.warn(`Accepted legacy unsigned ${purpose} token for lead ${leadId}`);
    return leadId;
  } catch {
    return null;
  }
}
