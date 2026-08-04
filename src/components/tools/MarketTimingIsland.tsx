/**
 * Market Timing Island
 * Data-driven verdict on whether now is a good time to sell.
 */

import { theme } from '@utils/theme';
import { useState } from 'react';
import type { ZipData } from '../../utils/market-analysis';
import type { TownZipMapping } from '../../data/town-mappings';
import { scoreMarketTiming, fmtCurrency } from '../../utils/toolsCalc';
import { trackEvent } from '@utils/analytics';
import { trackActivity } from '@utils/leadActivity';
import LocationPickerIsland from './LocationPickerIsland';

interface Props {
  mappings: TownZipMapping[];
  zipcodes: ZipData[];
}


const s = {
  card: { background: theme.surface1, border: `1px solid ${theme.rule}`, borderRadius: '1rem', boxShadow: theme.shadowLg, overflow: 'hidden' as const },
  section: { padding: '2rem' },
  stepLabel: { fontSize: '0.75rem', fontWeight: 700, color: theme.textMuted, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: '0.5rem' },
  heading: { fontSize: '1.25rem', fontWeight: 700, color: theme.textPrimary, margin: '0 0 1.5rem' },
  verdictBand: (color: string) => ({
    background: color,
    padding: '2rem',
    color: theme.accentInk,
    textAlign: 'center' as const,
  }),
  verdictLabel: { fontSize: '0.8rem', textTransform: 'uppercase' as const, letterSpacing: '0.1em', opacity: 0.85 },
  verdictTitle: { fontSize: '2rem', fontWeight: 800, margin: '0.5rem 0' },
  scoreBar: { display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1rem', justifyContent: 'center' },
  scoreTrack: { width: '160px', height: '8px', background: 'rgba(255,255,255,0.3)', borderRadius: '999px', overflow: 'hidden' as const },
  scoreFill: (score: number) => ({
    height: '100%',
    width: `${score}%`,
    background: theme.surface1,
    borderRadius: '999px',
  }),
  scoreNum: { fontSize: '1.1rem', fontWeight: 700 },
  reasonsSection: { padding: '1.5rem 2rem' },
  reasonsList: { listStyle: 'none', padding: 0, margin: 0 },
  reasonItem: { display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.5rem 0', fontSize: '0.95rem', color: theme.textPrimary },
  reasonIcon: { flexShrink: 0, width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', marginTop: '0.1rem' },
  checkIcon: { background: theme.greenWash, color: theme.green },
  warnIcon: { background: theme.accentWash, color: theme.accentBright },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', padding: '1rem 2rem', background: theme.surface2, borderTop: `1px solid ${theme.ruleStrong}` },
  stat: { padding: '0.75rem', background: theme.surface1, borderRadius: '0.5rem', border: `1px solid ${theme.ruleStrong}` },
  statValue: { fontSize: '1.25rem', fontWeight: 700, color: theme.textPrimary },
  statLabel: { fontSize: '0.75rem', color: theme.textSecondary, marginTop: '0.25rem' },
  cta: { padding: '1.5rem 2rem', borderTop: `1px solid ${theme.ruleStrong}` },
  ctaText: { fontSize: '1rem', fontWeight: 600, color: theme.textPrimary, marginBottom: '0.5rem' },
  ctaBtn: {
    display: 'block',
    width: '100%',
    padding: '0.875rem',
    background: theme.accent,
    color: theme.accentInk,
    border: 'none',
    borderRadius: '0.5rem',
    fontWeight: 700,
    fontSize: '1rem',
    cursor: 'pointer',
    textAlign: 'center' as const,
  },
};

export default function MarketTimingIsland({ mappings, zipcodes }: Props) {
  const [selectedZip, setSelectedZip] = useState<ZipData | null>(null);
  const [townName, setTownName] = useState('');

  const handleSelect = (zipData: ZipData, town: string) => {
    setSelectedZip(zipData);
    setTownName(town);
    const score = scoreMarketTiming(zipData);
    trackEvent('Engagement', 'Tool Result Shown', 'Market Timing Score', score.score);
    trackEvent('Lead', 'Tool Result Shown', `Timing Verdict - ${score.verdict}`);
    // Behaviour trigger signal — tool identity only, never their inputs.
    trackActivity('tool_use', { tool: 'should-i-sell-now' });
  };

  const handleCTA = () => {
    trackEvent('Lead', 'Tool CTA Click', 'Market Timing - Get Report');
    document.dispatchEvent(
      new CustomEvent('tool:lead-ready', {
        detail: { town: townName, zipcode: selectedZip?.zipcode ?? '', toolName: 'Market Timing' },
      }),
    );
  };

  const result = selectedZip ? scoreMarketTiming(selectedZip) : null;

  return (
    <div style={s.card}>
      <div style={s.section}>
        <div style={s.stepLabel}>{selectedZip ? `Results for ${townName}` : 'Enter Your Location'}</div>
        <p style={s.heading}>
          {selectedZip ? 'Your Market Timing Analysis' : 'Which area are you considering selling in?'}
        </p>
        <LocationPickerIsland
          mappings={mappings}
          zipcodes={zipcodes}
          onSelect={handleSelect}
          label="Town or Zip Code"
          placeholder="e.g., Marlton, Princeton, 08053..."
        />
      </div>

      {result && selectedZip && (
        <>
          <div style={s.verdictBand(result.color)}>
            <div style={s.verdictLabel}>Market Timing Verdict</div>
            <div style={s.verdictTitle}>{result.label}</div>
            <div style={s.scoreBar}>
              <div style={s.scoreTrack}>
                <div style={s.scoreFill(result.score)} />
              </div>
              <span style={s.scoreNum}>{result.score}/100</span>
            </div>
          </div>

          <div style={s.reasonsSection}>
            <ul style={s.reasonsList}>
              {result.reasons.map((r, i) => (
                <li key={i} style={s.reasonItem}>
                  <span style={{ ...s.reasonIcon, ...s.checkIcon }}>✓</span>
                  {r}
                </li>
              ))}
              {result.warnings.map((w, i) => (
                <li key={`w${i}`} style={s.reasonItem}>
                  <span style={{ ...s.reasonIcon, ...s.warnIcon }}>!</span>
                  {w}
                </li>
              ))}
            </ul>
          </div>

          <div style={s.statsRow}>
            <div style={s.stat}>
              <div style={s.statValue}>{fmtCurrency(selectedZip.median_sale_price)}</div>
              <div style={s.statLabel}>Median Sale Price</div>
            </div>
            <div style={s.stat}>
              <div style={s.statValue}>{selectedZip.median_dom != null ? `${Math.round(selectedZip.median_dom)} days` : 'N/A'}</div>
              <div style={s.statLabel}>Median Days on Market</div>
            </div>
            <div style={s.stat}>
              <div style={s.statValue}>
                {selectedZip.median_sale_price_yoy != null
                  ? `${selectedZip.median_sale_price_yoy > 0 ? '+' : ''}${selectedZip.median_sale_price_yoy.toFixed(1)}%`
                  : 'N/A'}
              </div>
              <div style={s.statLabel}>Price Change YoY</div>
            </div>
            <div style={s.stat}>
              <div style={{ ...s.statValue, textTransform: 'capitalize' as const }}>{selectedZip.market_type}</div>
              <div style={s.statLabel}>Market Type</div>
            </div>
          </div>

          <div style={s.cta}>
            <div style={s.ctaText}>
              {result.verdict === 'great' || result.verdict === 'good'
                ? `The ${townName} market favors sellers right now. Find out what your home could sell for.`
                : 'Even in a slower market, the right strategy makes all the difference.'}
            </div>
            <button style={s.ctaBtn} onClick={handleCTA}>
              {result.verdict === 'great' || result.verdict === 'good'
                ? 'Get My Free Home Value Report'
                : 'Schedule a Free Consultation'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
