/**
 * Common email domains, for typo detection.
 *
 * ORDER MATTERS: on a distance tie the earlier entry wins, so this list is
 * roughly by prevalence. It is deliberately NJ-weighted — Comcast, Verizon and
 * Optimum (optonline) are heavily represented in Burlington, Mercer and
 * Middlesex counties, which is who actually fills in these forms.
 *
 * Keep it SHORT. Every entry is a potential false suggestion: a long tail of
 * obscure domains makes it likelier that some real address sits one edit away
 * from a listed one and gets a wrong "did you mean". ~50 is the sweet spot.
 */
export const COMMON_DOMAINS: readonly string[] = [
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'aol.com',
  'icloud.com',
  'comcast.net',
  'verizon.net',
  'optonline.net',
  'me.com',
  'msn.com',
  'live.com',
  'att.net',
  'sbcglobal.net',
  'ymail.com',
  'mac.com',
  'protonmail.com',
  'proton.me',
  'earthlink.net',
  'rcn.com',
  'juno.com',
  'netzero.net',
  'bellsouth.net',
  'cox.net',
  'charter.net',
  'roadrunner.com',
  'frontier.com',
  'windstream.net',
  'embarqmail.com',
  'mail.com',
  'gmx.com',
  'zoho.com',
  'yandex.com',
  'fastmail.com',
  'hushmail.com',
  'outlook.co.uk',
  'yahoo.co.uk',
  'hotmail.co.uk',
  'btinternet.com',
  'shaw.ca',
  'rogers.com',
  'sympatico.ca',
  'verizon.com',
  'gmail.co.uk',
];

/** Second-level labels, for catching a good SLD with a mangled TLD. */
export const COMMON_SLDS: readonly string[] = Array.from(
  new Set(COMMON_DOMAINS.map((d) => d.split('.')[0])),
);

/** Valid TLD tails seen above, for the reverse case: good TLD, mangled SLD. */
export const COMMON_TLDS: readonly string[] = Array.from(
  new Set(COMMON_DOMAINS.map((d) => d.split('.').slice(1).join('.'))),
);

/**
 * Damerau-Levenshtein distance (Optimal String Alignment).
 *
 * Transposition-aware, which plain Levenshtein is not — and transposition is by
 * far the most common email typo. "gmial" -> "gmail" is ONE edit here and two
 * under plain Levenshtein, which is the difference between offering a correction
 * and silently failing.
 *
 * Bails out early once every cell in a row exceeds `max`; these strings are
 * short, but this runs on every submission.
 */
export function damerauLevenshtein(a: string, b: string, max = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;

  const rows: number[][] = [];
  for (let i = 0; i <= a.length; i++) rows.push(new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) rows[i][0] = i;
  for (let j = 0; j <= b.length; j++) rows[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(
        rows[i - 1][j] + 1, // deletion
        rows[i][j - 1] + 1, // insertion
        rows[i - 1][j - 1] + cost, // substitution
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, rows[i - 2][j - 2] + 1); // transposition
      }
      rows[i][j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
  }
  return rows[a.length][b.length];
}

/**
 * Suggest a correction for a mistyped domain, or null.
 *
 * Returns null for anything already in COMMON_DOMAINS — suggesting "gmail.com"
 * to someone who typed "gmail.com" is the classic bug in this kind of checker.
 * Also returns null for anything not close to a known domain, because a wrong
 * suggestion is worse than none: it tells a real person their real address is a
 * mistake.
 */
export function suggestDomain(domain: string): string | null {
  const d = domain.toLowerCase();
  if (COMMON_DOMAINS.includes(d)) return null;

  // Threshold scales with length — 1 edit on a short domain, 2 on a long one.
  // Fixed thresholds either miss "sbcgloball.net" or over-suggest on "aol.com".
  let best: { domain: string; dist: number } | null = null;
  for (const candidate of COMMON_DOMAINS) {
    const limit = candidate.length < 10 ? 1 : 2;
    const dist = damerauLevenshtein(d, candidate, limit);
    if (dist <= limit && (best === null || dist < best.dist)) {
      best = { domain: candidate, dist };
      if (dist === 1) break; // ordered by prevalence, so the first 1 is the best 1
    }
  }
  if (best) return best.domain;

  // Split check: a correct SLD with a mangled TLD ("gmail.con", "gmail.co",
  // "yahoo.cm"). The whole-domain pass above can miss these when the TLD edit
  // pushes the total over the limit for a short domain.
  const dot = d.indexOf('.');
  if (dot > 0) {
    const sld = d.slice(0, dot);
    const tld = d.slice(dot + 1);
    if (COMMON_SLDS.includes(sld) && !COMMON_TLDS.includes(tld)) {
      for (const candidate of COMMON_DOMAINS) {
        if (candidate.split('.')[0] !== sld) continue;
        const candTld = candidate.split('.').slice(1).join('.');
        if (damerauLevenshtein(tld, candTld, 2) <= 2) return candidate;
      }
    }
  }

  return null;
}
