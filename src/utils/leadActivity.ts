/**
 * Lead Activity Tracking
 *
 * Beacons on-site page views and tool completions for leads who have both given
 * us their email and accepted cookies. Everything downstream (the behaviour
 * trigger emails) reads from what this writes.
 *
 * Hard preconditions, checked on every send:
 *   1. cookie consent granted, and
 *   2. a signed visitor token exists (i.e. they are a known lead).
 * Anonymous or declined visitors produce zero requests. The server re-verifies
 * the token independently — this is convenience, not the security boundary.
 *
 * Geography comes from the `sf:town` / `sf:zip` / `sf:county` meta tags that
 * BaseLayout emits, so zipcodes.json never has to ship to the browser.
 */

import { hasConsent } from './consent';
import { getLeadToken } from './leadIdentity';

const ENDPOINT = '/api/track';

/** Don't re-send the same path twice inside this window (bfcache, quick back/forward). */
const DEDUPE_MS = 10_000;

const isBrowser = typeof window !== 'undefined';
const DEBUG = import.meta.env.PUBLIC_ANALYTICS_DEBUG === 'true';
const ENABLED = import.meta.env.PROD || DEBUG;

export type ActivityEvent = 'page_view' | 'tool_use' | 'form_start';

interface ActivityPayload {
  token: string;
  event: ActivityEvent;
  path: string;
  town?: string;
  zipcode?: string;
  county?: string;
  metadata?: Record<string, unknown>;
}

function meta(name: string): string | undefined {
  const el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  return el?.content || undefined;
}

const lastSent = new Map<string, number>();

function send(payload: ActivityPayload): void {
  const body = JSON.stringify(payload);

  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.debug('[activity]', payload);
  }
  if (!ENABLED) return;

  // sendBeacon survives the page unloading mid-navigation; fetch+keepalive is
  // the fallback for the handful of browsers without it.
  if (navigator.sendBeacon) {
    navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
    return;
  }

  void fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {
    /* best-effort telemetry — never surface a failure to the visitor */
  });
}

/**
 * Record an event. No-ops unless the visitor is a known lead who accepted
 * cookies. Exported so tool pages can log completions.
 */
export function trackActivity(
  event: ActivityEvent,
  metadata?: Record<string, unknown>
): void {
  if (!isBrowser) return;

  const token = getLeadToken();
  if (!token || !hasConsent()) return;

  const path = window.location.pathname;
  const key = `${event}:${path}`;
  const now = Date.now();
  const previous = lastSent.get(key);
  if (previous !== undefined && now - previous < DEDUPE_MS) return;
  lastSent.set(key, now);

  send({
    token,
    event,
    path,
    town: meta('sf:town'),
    zipcode: meta('sf:zip'),
    county: meta('sf:county'),
    metadata,
  });
}

let activityInit = false;

/**
 * Start page-view tracking. Call once from BaseLayout — it binds to
 * `astro:page-load`, which fires on the initial load and after every
 * view-transition navigation.
 */
export function initLeadActivityTracking(): void {
  if (!isBrowser || activityInit) return;
  activityInit = true;

  document.addEventListener('astro:page-load', () => trackActivity('page_view'));
}
