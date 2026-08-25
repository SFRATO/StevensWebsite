/**
 * Gate access — "has this browser completed the listing registration form?"
 *
 * Deliberately SEPARATE from leadIdentity.ts, and the distinction matters:
 *
 *   sf_lead     is an HMAC token that IDENTIFIES a person and drives
 *               behaviour-triggered email. It is correctly consent-gated, so a
 *               visitor who declines cookies gets sessionStorage only.
 *   sf_gate_ok  carries the literal string "1". No identifier, no cross-site
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
 * The key names are duplicated in the blocking inline script in
 * src/pages/listings/[slug].astro, which cannot import modules. Keep in sync.
 */

const COOKIE_NAME = 'sf_gate_ok';
const SESSION_KEY = 'sf_gate_ok';
/** 90 days — deliberately shorter than sf_lead's year. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 90;

const isBrowser = typeof window !== 'undefined';

/** Has this browser already registered for listing access? */
export function hasGateAccess(): boolean {
  if (!isBrowser) return false;

  if (new RegExp(`(?:^|; )${COOKIE_NAME}=1`).test(document.cookie)) return true;

  try {
    return window.sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false; // private mode
  }
}

/**
 * Record that registration completed. Writes both stores unconditionally —
 * see the consent reasoning in the file header.
 */
export function grantGateAccess(): void {
  if (!isBrowser) return;

  try {
    window.sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    /* private mode — the cookie below may still work */
  }

  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${COOKIE_NAME}=1; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}
