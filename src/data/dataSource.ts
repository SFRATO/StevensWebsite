/**
 * How the market data is described to visitors.
 *
 * Deliberately vague about timing: the site states that data is refreshed
 * `monthly` and never shows a specific date. Stamping "March 31, 2026" on a
 * page makes it look stale the moment the refresh slips, and invites visitors
 * to reason about how current the figures are rather than what they say.
 *
 * This is the ONLY place that phrasing lives, so it cannot drift between the
 * hero, the About page, the county pages, and MarketHero.
 *
 * Note: `src/pages/privacy.astro` has its own "Last updated" date. That is the
 * policy's revision date — legally meaningful, unrelated to market data, and
 * must keep showing a real date.
 */

export const DATA_SOURCE = 'Redfin';

/** Slots into "Updated {DATA_FRESHNESS}" and "updated {DATA_FRESHNESS}". */
export const DATA_FRESHNESS = 'monthly';

/** Ready-made attribution line for footers and data-source notes. */
export const DATA_ATTRIBUTION = `Market data provided by ${DATA_SOURCE}, updated ${DATA_FRESHNESS}.`;

/**
 * Strip date fields from rows before they are serialized into the page.
 *
 * The four tool pages hydrate React islands with the full zipcode dataset,
 * which Astro writes into the HTML as island props. `period_end` and
 * `last_updated` were riding along in that payload — invisible on screen, but
 * plainly readable in view-source. Nothing reads either field, so they are
 * dropped: it honours the no-dates rule and shrinks the payload.
 */
export function withoutDates<T extends Record<string, unknown>>(rows: T[]): T[] {
  return rows.map(({ period_end, last_updated, ...rest }) => rest as unknown as T);
}
