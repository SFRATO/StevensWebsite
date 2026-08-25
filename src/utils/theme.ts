/**
 * Theme bridge for React islands.
 *
 * Islands are styled with inline style objects, which cannot pick up the
 * scoped `<style>` blocks the Astro components use. Before this existed, each
 * island hardcoded its own palette (`const gold = '#C99C33'`, plus a hand-copied
 * Tailwind slate ramp) and had already drifted from the real tokens.
 *
 * Inline styles accept CSS custom properties as plain strings, so every value
 * here resolves against the same `:root` block in `src/styles/variables.css`.
 * Add colors here, never as literals in a component.
 *
 * Accent discipline still applies: `accent`/`accentBright` are for CTAs, active
 * states and hover only — never for headings or body copy.
 */
export const theme = {
  /* Surfaces */
  surface0: 'var(--ink-900)',
  surface1: 'var(--ink-800)',
  surface2: 'var(--ink-700)',
  surface3: 'var(--ink-600)',

  /* Rules */
  rule: 'var(--rule)',
  ruleStrong: 'var(--rule-strong)',

  /* Text */
  textPrimary: 'var(--text-primary)',
  textSecondary: 'var(--text-secondary)',
  textMuted: 'var(--text-muted)',

  /* Accent */
  accent: 'var(--accent)',
  accentBright: 'var(--accent-bright)',
  accentDeep: 'var(--accent-deep)',
  accentInk: 'var(--accent-ink)',
  accentWash: 'var(--accent-wash)',
  accentWashStrong: 'var(--accent-wash-strong)',
  accentLine: 'var(--accent-line)',
  glow: 'var(--glow)',
  glowSoft: 'var(--glow-soft)',

  /* Status */
  green: 'var(--accent-green)',
  red: 'var(--accent-red)',
  greenWash: 'rgba(74, 222, 128, 0.12)',
  redWash: 'rgba(255, 107, 107, 0.12)',

  /* Elevation */
  shadowMd: 'var(--shadow-md)',
  shadowLg: 'var(--shadow-lg)',

  /* Type. Islands inherit `body`, which is Rokkitt — correct for their prose,
     wrong for their labels, inputs and buttons. See the TYPE DISCIPLINE block
     in variables.css: fontUi is for anything you operate, fontBody for
     anything you read, fontHeading for headings and display figures. */
  fontHeading: 'var(--font-heading)',
  fontUi: 'var(--font-ui)',
  fontBody: 'var(--font-body)',
} as const;

export default theme;
