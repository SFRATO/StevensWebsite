/**
 * Gate access — "has this browser completed the registration form FOR THIS PROPERTY?"
 *
 * Deliberately SEPARATE from leadIdentity.ts, and the distinction matters:
 *
 *   sf_lead     is an HMAC token that IDENTIFIES a person and drives
 *               behaviour-triggered email. It is correctly consent-gated, so a
 *               visitor who declines cookies gets sessionStorage only.
 *   sf_gate_ok_*
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
 * TWO KEYS, AND WHY
 * ------------------
 * `sf_gate_ok_<slug>` records the specific listing that was registered for.
 * `sf_gate_ok_all` records that this browser has registered for something.
 * A successful registration writes both; the gate opens on either.
 *
 * The per-slug key came first, when each listing was meant to earn its own
 * lead. The shared key was added with the registration confirmation email,
 * which links the recipient to the OTHER listings — with per-slug keys alone,
 * every one of those links would land them back on a gate they had already
 * passed. Portfolio-wide access is the deliberate cost of that email working,
 * and it means one lead per visitor rather than one per property.
 *
 * The per-slug key is kept because it is what any future per-property gating or
 * per-property analytics would read, and because dropping SHARED_KEY is then a
 * one-line reversal.
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
/**
 * Portfolio-wide key, written alongside the per-property one.
 *
 * The registration confirmation email links a visitor to the OTHER Single
 * Property Websites. With a per-property key only, every one of those links
 * would land them back on a gate they have already passed, which defeats the
 * email. So completing the form once admits them everywhere.
 *
 * This is the same first-party cookie mechanism, not a URL parameter or a token
 * in the link — a stranger who receives a forwarded email still meets the gate,
 * because access lives in the browser that registered, not in the URL.
 *
 * Trade-off, accepted deliberately: one lead per visitor across the portfolio
 * rather than one per property. Delete this constant and the two `|| shared`
 * branches below to go back to strict per-property gating.
 */
const SHARED_KEY = 'sf_gate_ok_all';
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

/** Has this browser registered for THIS listing, or for any listing at all? */
export function hasGateAccess(propertyKey: string): boolean {
  if (!isBrowser || !propertyKey) return false;

  for (const key of [keyFor(propertyKey), SHARED_KEY]) {
    if (new RegExp(`(?:^|; )${key}=1`).test(document.cookie)) return true;
    try {
      if (window.sessionStorage.getItem(key) === '1') return true;
    } catch {
      /* private mode — fall through to the cookie result */
    }
  }
  return false;
}

/**
 * Record that registration completed for this listing. Writes both stores
 * unconditionally — see the consent reasoning in the file header.
 */
export function grantGateAccess(propertyKey: string): void {
  if (!isBrowser || !propertyKey) return;

  const secure = window.location.protocol === 'https:' ? '; Secure' : '';

  // Both keys. The per-property one is what the analytics and any future
  // per-property gating read; the shared one is what makes the confirmation
  // email's links to the other listings work.
  for (const key of [keyFor(propertyKey), SHARED_KEY]) {
    try {
      window.sessionStorage.setItem(key, '1');
    } catch {
      /* private mode — the cookie below may still work */
    }
    document.cookie = `${key}=1; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
  }
}
