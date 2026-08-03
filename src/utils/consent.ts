/**
 * Cookie Consent
 *
 * Single source of truth for the visitor's tracking-cookie decision.
 *
 * Model: opt-in gate.
 *   - Matomo boots with `requireCookieConsent`, so it tracks *cookieless* until
 *     the visitor accepts — pageviews still count, no visitor cookie is set.
 *     (Deliberately NOT `requireConsent`, which would drop tracking entirely.)
 *   - GA4 is not loaded at all until consent is granted; its script is injected
 *     on demand from here.
 *
 * The decision is stored in localStorage (durable, readable before any network
 * call) and mirrored to a first-party cookie so Netlify/Supabase functions can
 * read it off the request when needed.
 */

export type ConsentStatus = 'granted' | 'denied';

const STORAGE_KEY = 'sf_consent_v1';
const COOKIE_NAME = 'sf_consent';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/** Bumped only when the disclosure materially changes and re-consent is required. */
const CONSENT_VERSION = 1;

interface StoredConsent {
  status: ConsentStatus;
  ts: number;
  version: number;
}

const isBrowser = typeof window !== 'undefined';

/** Matomo's buffering array — pushes before matomo.js attaches are replayed on load. */
function paq(): unknown[] {
  window._paq = window._paq || [];
  return window._paq;
}

/**
 * The visitor's decision, or `null` if they have not decided yet
 * (or decided against an older consent version).
 */
export function getConsent(): ConsentStatus | null {
  if (!isBrowser) return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StoredConsent;
    if (parsed.version !== CONSENT_VERSION) return null;
    if (parsed.status !== 'granted' && parsed.status !== 'denied') return null;

    return parsed.status;
  } catch {
    // Private mode / corrupt value — treat as undecided rather than throwing.
    return null;
  }
}

/** Convenience: has the visitor allowed tracking cookies? */
export function hasConsent(): boolean {
  return getConsent() === 'granted';
}

function writeCookie(status: ConsentStatus): void {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${COOKIE_NAME}=${status}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

let ga4Loaded = false;

/** Inject GA4 on demand. No-op unless PUBLIC_GA4_ID is configured. */
function loadGA4(): void {
  const gaId = import.meta.env.PUBLIC_GA4_ID;
  if (!gaId || ga4Loaded || typeof window.gtag === 'function') return;
  ga4Loaded = true;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  function gtag(...args: unknown[]) {
    window.dataLayer!.push(args);
  }
  window.gtag = gtag as typeof window.gtag;
  gtag('js', new Date());
  gtag('config', gaId);
}

/**
 * Apply the current decision to the loaded trackers.
 *
 * Safe to call repeatedly and before the trackers attach — `_paq` buffers.
 * Called on every page load so a decision made in another tab is honoured here.
 */
export function applyConsent(status: ConsentStatus | null): void {
  if (!isBrowser) return;

  if (status === 'granted') {
    paq().push(['rememberCookieConsentGiven']);
    loadGA4();
  } else if (status === 'denied') {
    // Clears any Matomo cookie already set and keeps tracking cookieless.
    paq().push(['forgetCookieConsentGiven']);
  }
  // status === null: leave Matomo in its cookieless default, no GA4.
}

/** Record a decision, apply it immediately, and notify listeners. */
export function setConsent(status: ConsentStatus): void {
  if (!isBrowser) return;

  const record: StoredConsent = { status, ts: Date.now(), version: CONSENT_VERSION };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Storage unavailable — the cookie mirror below still carries the decision.
  }
  writeCookie(status);
  applyConsent(status);

  window.dispatchEvent(new CustomEvent<ConsentStatus>('sf:consent', { detail: status }));
}

/** Clear the decision so the banner reappears (the "change my mind" path on /privacy/). */
export function resetConsent(): void {
  if (!isBrowser) return;

  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
  paq().push(['forgetCookieConsentGiven']);

  window.dispatchEvent(new CustomEvent('sf:consent-reset'));
}

/**
 * Subscribe to consent decisions. Fires immediately if a decision already
 * exists, then on every subsequent change. Returns an unsubscribe function.
 */
export function onConsent(callback: (status: ConsentStatus) => void): () => void {
  if (!isBrowser) return () => {};

  const existing = getConsent();
  if (existing) callback(existing);

  const handler = (e: Event) => callback((e as CustomEvent<ConsentStatus>).detail);
  window.addEventListener('sf:consent', handler);
  return () => window.removeEventListener('sf:consent', handler);
}
