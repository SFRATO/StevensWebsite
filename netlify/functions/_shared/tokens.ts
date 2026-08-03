/**
 * Signed Lead Tokens (Node / Netlify functions)
 *
 * Node counterpart of `supabase/functions/_shared/tokens.ts`. The two produce
 * and accept byte-identical tokens — keep them in sync.
 *
 * Format: `<base64url(payload)>.<base64url(hmac-sha256(purpose:payload))>`
 */

import { createHmac, timingSafeEqual as nodeTimingSafeEqual } from "node:crypto";

export type TokenPurpose = "unsubscribe" | "visitor";

const SECRET = process.env.LEAD_TOKEN_SECRET ?? "";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sign(purpose: TokenPurpose, payload: string): string {
  return createHmac("sha256", SECRET).update(`${purpose}:${payload}`).digest("base64url");
}

/** Mint a signed token for a lead. */
export function createToken(purpose: TokenPurpose, leadId: string): string {
  if (!SECRET) {
    console.error("LEAD_TOKEN_SECRET is not set — tokens will not verify.");
  }
  const payload = Buffer.from(leadId, "utf8").toString("base64url");
  return `${payload}.${sign(purpose, payload)}`;
}

/**
 * Verify a token and return the lead id it carries, or null.
 *
 * `allowLegacy` accepts the old unsigned `btoa(leadId:timestamp)` format so
 * links already sent out keep working.
 */
export function verifyToken(
  purpose: TokenPurpose,
  token: string,
  allowLegacy = false,
): string | null {
  if (!token) return null;

  const dot = token.lastIndexOf(".");
  if (dot > 0) {
    const payload = token.slice(0, dot);
    const signature = token.slice(dot + 1);

    try {
      const expected = sign(purpose, payload);
      const a = Buffer.from(signature, "utf8");
      const b = Buffer.from(expected, "utf8");
      if (a.length !== b.length || !nodeTimingSafeEqual(a, b)) return null;

      const leadId = Buffer.from(payload, "base64url").toString("utf8");
      return UUID_RE.test(leadId) ? leadId : null;
    } catch {
      return null;
    }
  }

  if (!allowLegacy) return null;

  try {
    const [leadId] = Buffer.from(token, "base64").toString("utf8").split(":");
    if (!UUID_RE.test(leadId)) return null;
    console.warn(`Accepted legacy unsigned ${purpose} token for lead ${leadId}`);
    return leadId;
  } catch {
    return null;
  }
}
