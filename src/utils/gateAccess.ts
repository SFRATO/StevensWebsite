/**
 * Gate access — "has this browser completed the registration form FOR THIS PROPERTY?"
 *
 * Deliberately SEPARATE from leadIdentity.ts, and the distinction matters:
 *
 *   sf_lead     is an HMAC token that IDENTIFIES a person and drives
 *               behaviour-triggered email. It is correctly consent-gated, so a
 *               visitor who declines cookies gets sessionStorage only.
 *   sf_gate_ok_<slug>
 *               carries the literal string "1". No identifier, no cross-site
 *               use, nothing readable by analytics. It exists solely so we do
 *               not demand the same person register again in every new tab —
 *               a function the visitor explicitly requested. That puts it in
 *               the strictly-necessary class, alongside a login session cookie,
 *               and it is therefore consent-exempt.
 *
 * If that reasoning is ever revised, delete this file and accept per-session
 * re-gating. Do NOT relax the consent check in leadIdentity.ts instead — that
 * would leak an identifier, which is a different and much larger decision.
 *
 * WHY THE KEY IS SCOPED TO ONE LISTING
 * ------------------------------------
 * The first version wrote a single unscoped `sf_gate_ok=1` at path=/. That was
 * never a decision about scope — with one listing on the site there was nothing
 * to distinguish, and the flag simply had no property in it. The moment a second
 * Single Property Website existed it silently became: register for any house,
 * see every house. Each listing is its own advertisement with its own ad spend,
 * so each one has to earn its own lead. Hence one key per slug.
 *
 * The gate ALSO no longer opens for a bare `sf_lead`. Someone who gave an email
 * and a ZIP to the exit-intent popup has not registered for a property — they
 * never gave a phone number and never accepted the listing terms. Identifying a
 * lead and admitting them to a specific listing are different questions, and
 * conflating them cost a lead per property.
 *
 * The key SHAPE is duplicated in the blocking inline script in
 * src/pages/listings/[slug].astro, which runs before first paint and therefore
 * cannot import modules. Keep the two in sync.
 */

const COOKIE_PREFIX = 'sf_gate_ok_';
/** 90 days — deliberately shorter than sf_lead's year. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 90;

const isBrowser = typeof window !== 'undefined';

/**
 * Storage key for one property. `propertyKey` is the listing slug, which is
 * already constrained to `^[a-z0-9]+(-[a-z0-9]+)*$` by listings_slug_shape_chk,
 * so it is safe in both a cookie name and a RegExp without escaping.
 */
function keyFor(propertyKey: string): string {
  return `${COOKIE_PREFIX}${propertyKey}`;
}

/** Has this browser already registered for THIS listing? */
export function hasGateAccess(propertyKey: string): boolean {
  if (!isBrowser || !propertyKey) return false;

  const key = keyFor(propertyKey);
  if (new RegExp(`(?:^|; )${key}=1`).test(document.cookie)) return true;

  try {
    return window.sessionStorage.getItem(key) === '1';
  } catch {
    return false; // private mode
  }
}

/**
 * Record that registration completed for this listing. Writes both stores
 * unconditionally — see the consent reasoning in the file header.
 */
export function grantGateAccess(propertyKey: string): void {
  if (!isBrowser || !propertyKey) return;

  const key = keyFor(propertyKey);

  try {
    window.sessionStorage.setItem(key, '1');
  } catch {
    /* private mode — the cookie below may still work */
  }

  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${key}=1; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}
