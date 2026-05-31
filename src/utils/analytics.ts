/**
 * Analytics Utility
 *
 * Single source of truth for custom event + pageview tracking.
 * Dual-dispatches every event to:
 *   - Matomo  (window._paq, loaded via the Matomo Tag Manager container)
 *   - GA4     (window.gtag, loaded only when PUBLIC_GA4_ID is set)
 *
 * Importable from bundled `.astro <script>` blocks and `.tsx` islands
 * via `@utils/analytics`. Always safe to call — no-ops on the server,
 * in dev (unless PUBLIC_ANALYTICS_DEBUG), or before the trackers load
 * (Matomo's `_paq` array buffers pushes and replays them on attach).
 */

declare global {
  interface Window {
    _paq?: unknown[];
    _mtm?: unknown[];
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const isBrowser = typeof window !== 'undefined';

/** When true, log every event to the console (set PUBLIC_ANALYTICS_DEBUG=true locally). */
const DEBUG = import.meta.env.PUBLIC_ANALYTICS_DEBUG === 'true';

/**
 * Whether to actually dispatch to trackers. Live in production builds, or in
 * dev when explicitly debugging (so events can be exercised via `npm run dev`).
 */
const ENABLED = import.meta.env.PROD || DEBUG;

/** Event categories — kept as a union so the taxonomy is enforced at compile time. */
export type EventCategory = 'Lead' | 'Contact' | 'Engagement' | 'Navigation';

/** Seed Matomo's buffering array. Pushes before matomo.js loads are replayed on attach. */
function paq(): unknown[] {
  window._paq = window._paq || [];
  return window._paq;
}

/**
 * Track a custom event.
 *
 * Matomo's `trackEvent` is positional: (category, action, name?, value?).
 * `value` is only meaningful when `name` is present, so we preserve that ordering.
 */
export function trackEvent(
  category: EventCategory,
  action: string,
  name?: string,
  value?: number,
): void {
  if (!isBrowser) return;

  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.debug('[analytics] trackEvent', { category, action, name, value });
  }
  if (!ENABLED) return;

  // Matomo
  const args: (string | number)[] = ['trackEvent', category, action];
  if (name !== undefined) {
    args.push(name);
    if (value !== undefined) args.push(value);
  }
  paq().push(args);

  // GA4 (only fires if a real PUBLIC_GA4_ID loaded window.gtag)
  if (typeof window.gtag === 'function') {
    window.gtag('event', action, {
      event_category: category,
      event_label: name,
      value,
    });
  }
}

/**
 * Track a site search (Matomo Site Search report).
 *
 * Use for the town/zip autocomplete so Matomo surfaces a ranked
 * "what are people searching for" report. Matomo's signature is positional:
 * (keyword, category|false, resultsCount|false).
 */
export function trackSiteSearch(keyword: string, category?: string, count?: number): void {
  if (!isBrowser) return;

  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.debug('[analytics] trackSiteSearch', { keyword, category, count });
  }
  if (!ENABLED) return;

  paq().push(['trackSiteSearch', keyword, category ?? false, count ?? false]);

  // GA4 has a conventional `search` event
  if (typeof window.gtag === 'function') {
    window.gtag('event', 'search', { search_term: keyword });
  }
}

let linkTrackingInit = false;

/** Derive a human-readable location label from where a link sits in the page. */
function linkLocation(el: Element): string {
  if (el.closest('.sticky-cta')) return 'Sticky CTA';
  if (el.closest('header')) return 'Header';
  if (el.closest('footer, .footer')) return 'Footer';
  if (el.closest('.hero, .market-hero')) return 'Hero';
  return 'Body';
}

/**
 * Site-wide click tracking for tel: and mailto: links via event delegation.
 *
 * Bound once on document (capture phase) so it automatically covers links that
 * appear/disappear across view transitions — no per-component wiring needed.
 * Fires `Contact / Phone Click | Email Click / <location>`.
 */
export function initLinkTracking(): void {
  if (!isBrowser || linkTrackingInit) return;
  linkTrackingInit = true;

  document.addEventListener(
    'click',
    (e) => {
      const target = e.target as Element | null;
      const link = target?.closest?.('a[href^="tel:"], a[href^="mailto:"]') as
        | HTMLAnchorElement
        | null;
      if (!link) return;

      const href = link.getAttribute('href') || '';
      const location = linkLocation(link);
      if (href.startsWith('tel:')) {
        trackEvent('Contact', 'Phone Click', location);
      } else if (href.startsWith('mailto:')) {
        trackEvent('Contact', 'Email Click', location);
      }
    },
    { capture: true }
  );
}

let pageviewInit = false;
let previousUrl = isBrowser ? document.referrer : '';

/**
 * Track virtual pageviews on Astro view-transition navigations.
 *
 * The initial pageview is handled by the MTM container's All-Pages tag, so this
 * only fires on subsequent client-side swaps (`astro:after-swap`) to avoid
 * double-counting. Register exactly once (guarded by `pageviewInit`).
 */
export function initPageviewTracking(): void {
  if (!isBrowser || pageviewInit) return;
  pageviewInit = true;

  document.addEventListener('astro:after-swap', () => {
    const url = window.location.href;

    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.debug('[analytics] pageview', url);
    }
    if (!ENABLED) {
      previousUrl = url;
      return;
    }

    // Matomo SPA pageview
    paq().push(['setReferrerUrl', previousUrl]);
    paq().push(['setCustomUrl', url]);
    paq().push(['setDocumentTitle', document.title]);
    paq().push(['trackPageView']);
    paq().push(['enableLinkTracking']);

    // GA4 SPA pageview
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'page_view', {
        page_location: url,
        page_title: document.title,
      });
    }

    previousUrl = url;
  });
}
