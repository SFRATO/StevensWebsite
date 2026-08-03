/**
 * Lead Identity
 *
 * Durable, consent-aware identification of a visitor who has given us their
 * email through one of the site forms.
 *
 * The server issues an HMAC-signed opaque token (never the raw lead UUID) on a
 * successful submission. Where we keep it depends on the cookie decision:
 *
 *   consent granted -> first-party cookie, 1 year. Recognised on return visits,
 *                      which is what lets behaviour-triggered follow-ups work.
 *   consent denied  -> sessionStorage only. The current session still benefits
 *                      (popup suppression, step 2 of the form), but nothing
 *                      persists once the tab closes.
 *
 * Also sets Matomo's User ID to a SHA-256 hash of the email so a lead's whole
 * on-site history links up without a raw address ever reaching analytics.
 */

import { hasConsent, onConsent } from './consent';

const COOKIE_NAME = 'sf_lead';
const SESSION_KEY = 'sf_lead_token';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

const isBrowser = typeof window !== 'undefined';

function paq(): unknown[] {
  window._paq = window._paq || [];
  return window._paq;
}

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string): void {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

function clearCookie(name: string): void {
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}

/** The current lead token, or null if this visitor is not a known lead. */
export function getLeadToken(): string | null {
  if (!isBrowser) return null;

  const fromCookie = readCookie(COOKIE_NAME);
  if (fromCookie) return fromCookie;

  try {
    return window.sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

/** Has this visitor already given us their email? Used to suppress the popup. */
export function isKnownLead(): boolean {
  return getLeadToken() !== null;
}

/** Persist a token to whichever store the visitor's cookie decision allows. */
function setLeadToken(token: string): void {
  if (!isBrowser || !token) return;

  // Always keep a session copy so multi-step forms work regardless of consent.
  try {
    window.sessionStorage.setItem(SESSION_KEY, token);
  } catch {
    /* private mode — the cookie path below may still work */
  }

  if (hasConsent()) writeCookie(COOKIE_NAME, token);
}

/** Lowercase + SHA-256 an email. Returns null where WebCrypto is unavailable (non-HTTPS). */
async function hashEmail(email: string): Promise<string | null> {
  if (!isBrowser || !window.crypto?.subtle) return null;

  try {
    const data = new TextEncoder().encode(email.trim().toLowerCase());
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return null;
  }
}

/**
 * Record a successful signup: store the token and, if cookies were accepted,
 * attach a hashed User ID to the Matomo session.
 *
 * The User ID is only set with consent — without it Matomo is running
 * cookieless and stitching sessions to a person would defeat that.
 */
export async function identifyLead(email: string, token: string | null): Promise<void> {
  if (!isBrowser) return;

  if (token) setLeadToken(token);
  if (!hasConsent()) return;

  const hashed = await hashEmail(email);
  if (hashed) paq().push(['setUserId', hashed]);
}

let identityInit = false;

/**
 * Keep the token store in sync with the cookie decision. Call once per page load.
 *
 * Accepting after signing up promotes the session-only token to a cookie;
 * withdrawing consent drops the cookie so we stop recognising them.
 */
export function initLeadIdentity(): void {
  if (!isBrowser || identityInit) return;
  identityInit = true;

  onConsent((status) => {
    if (status === 'granted') {
      const token = getLeadToken();
      if (token) writeCookie(COOKIE_NAME, token);
    } else {
      clearCookie(COOKIE_NAME);
      paq().push(['resetUserId']);
    }
  });

  window.addEventListener('sf:consent-reset', () => {
    clearCookie(COOKIE_NAME);
    paq().push(['resetUserId']);
  });
}
