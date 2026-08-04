/**
 * Net Proceeds Calculator Island
 * Estimates seller's take-home after all NJ closing costs.
 */

import { theme } from '@utils/theme';
import { useState, useEffect, useCallback } from 'react';
import type { ZipData } from '../../utils/market-analysis';
import type { TownZipMapping } from '../../data/town-mappings';
import { calcNetProceeds, fmtCurrency, fmtPct } from '../../utils/toolsCalc';
import { trackEvent } from '@utils/analytics';
import { trackActivity } from '@utils/leadActivity';
import LocationPickerIsland from './LocationPickerIsland';

interface Props {
  mappings: TownZipMapping[];
  zipcodes: ZipData[];
}


function parseNum(s: string): number {
  return parseFloat(s.replace(/[^0-9.]/g, '')) || 0;
}

function fmtInput(n: number): string {
  if (n === 0) return '';
  return n.toLocaleString('en-US');
}

const s = {
  card: { background: theme.surface1, border: `1px solid ${theme.rule}`, borderRadius: '1rem', boxShadow: theme.shadowLg, overflow: 'hidden' as const },
  header: { padding: '1.5rem 2rem', borderBottom: `1px solid ${theme.ruleStrong}` },
  stepLabel: { fontSize: '0.75rem', fontWeight: 700, color: theme.textMuted, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: '0.25rem' },
  heading: { fontSize: '1.25rem', fontWeight: 700, color: theme.textPrimary, margin: 0 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', padding: '1.5rem 2rem' },
  gridFull: { display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', padding: '0 2rem 1.5rem' },
  formGroup: { display: 'flex', flexDirection: 'column' as const, gap: '0.4rem' },
  label: { fontSize: '0.8rem', fontWeight: 600, color: theme.textSecondary },
  input: {
    padding: '0.75rem 1rem',
    border: `1.5px solid ${theme.ruleStrong}`,
    borderRadius: '0.5rem',
    fontSize: '1rem',
    width: '100%',
    boxSizing: 'border-box' as const,
    outline: 'none',
  },
  sliderRow: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  slider: { flex: 1, accentColor: theme.accent },
  sliderVal: { fontSize: '0.9rem', fontWeight: 600, color: theme.textPrimary, width: '3rem', textAlign: 'right' as const },
  toggleRow: { display: 'flex', gap: '0.5rem' },
  toggleBtn: (active: boolean) => ({
    flex: 1,
    padding: '0.6rem',
    border: `2px solid ${active ? theme.accent : theme.ruleStrong}`,
    borderRadius: '0.5rem',
    background: active ? theme.accentWash : theme.surface2,
    color: active ? theme.textPrimary : theme.textSecondary,
    fontWeight: active ? 700 : 400,
    cursor: 'pointer',
    fontSize: '0.85rem',
  }),
  divider: { height: '1px', background: theme.ruleStrong, margin: '0 2rem' },
  resultsHeader: { padding: '1.5rem 2rem 0.5rem', background: theme.surface2 },
  netProceeds: { padding: '1rem 2rem', background: theme.surface2 },
  netValue: { fontSize: '2.25rem', fontWeight: 800, color: theme.textPrimary },
  netNegative: { fontSize: '2.25rem', fontWeight: 800, color: theme.red },
  netLabel: { fontSize: '0.8rem', color: theme.textSecondary, marginBottom: '0.25rem' },
  breakdown: { padding: '0 2rem 1.5rem', background: theme.surface2 },
  bkRow: { display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: `1px solid ${theme.ruleStrong}`, fontSize: '0.9rem' },
  bkLabel: { color: theme.textSecondary },
  bkValue: { fontWeight: 600, color: theme.textPrimary },
  bkNegative: { fontWeight: 600, color: theme.red },
  bkTotal: { display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', fontSize: '1rem', fontWeight: 700, color: theme.textPrimary, borderTop: `2px solid ${theme.ruleStrong}`, marginTop: '0.5rem' },
  note: { margin: '0.5rem 2rem 1rem', padding: '0.75rem 1rem', background: theme.accentWash, borderRadius: '0.5rem', fontSize: '0.8rem', color: theme.accentBright, lineHeight: 1.5 },
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
  },
};

export default function ProceedsCalculatorIsland({ mappings, zipcodes }: Props) {
  const [selectedZip, setSelectedZip] = useState<ZipData | null>(null);
  const [townName, setTownName] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [mortgage, setMortgage] = useState('');
  const [commission, setCommission] = useState(5.0);
  const [purchasePrice, setPurchasePrice] = useState('');
  const [isPrimary, setIsPrimary] = useState(true);
  const [hasTrackedStart, setHasTrackedStart] = useState(false);

  const handleSelect = (zipData: ZipData, town: string) => {
    setSelectedZip(zipData);
    setTownName(town);
    if (zipData.median_sale_price && !salePrice) {
      setSalePrice(fmtInput(zipData.median_sale_price));
    }
  };

  const salePriceNum = parseNum(salePrice);
  const mortgageNum = parseNum(mortgage);
  const purchasePriceNum = parseNum(purchasePrice);

  const result = salePriceNum > 0
    ? calcNetProceeds(salePriceNum, mortgageNum, commission, purchasePriceNum || salePriceNum * 0.7, isPrimary)
    : null;

  const trackStart = useCallback(() => {
    if (!hasTrackedStart) {
      setHasTrackedStart(true);
      trackEvent('Engagement', 'Tool Start', 'Proceeds Calculator');
    }
  }, [hasTrackedStart]);

  useEffect(() => {
    if (result) {
      const t = setTimeout(() => {
        trackEvent('Engagement', 'Tool Calculated', 'Net Proceeds', Math.round(result.netProceeds / 1000));
        // Behaviour trigger signal. No-ops for anonymous or non-consenting
        // visitors; records only which tool was used, never the figures entered.
        trackActivity('tool_use', { tool: 'proceeds-calculator' });
      }, 600);
      return () => clearTimeout(t);
    }
  }, [result?.netProceeds]);

  const handleCTA = () => {
    trackEvent('Lead', 'Tool CTA Click', 'Proceeds - Get Consultation', result ? Math.round(result.netProceeds / 1000) : 0);
    document.dispatchEvent(
      new CustomEvent('tool:lead-ready', {
        detail: { town: townName, zipcode: selectedZip?.zipcode ?? '', toolName: 'Proceeds Calculator' },
      }),
    );
  };

  return (
    <div style={s.card}>
      <div style={s.header}>
        <div style={s.stepLabel}>NJ Home Sale Calculator</div>
        <h2 style={s.heading}>How Much Will You Walk Away With?</h2>
      </div>

      {/* Location */}
      <div style={{ padding: '1.5rem 2rem 0' }}>
        <LocationPickerIsland
          mappings={mappings}
          zipcodes={zipcodes}
          onSelect={handleSelect}
          label="Property Location (auto-fills median price)"
          placeholder="Town or zip code..."
        />
      </div>

      {/* Inputs grid */}
      <div style={s.grid}>
        <div style={s.formGroup}>
          <label style={s.label} htmlFor="proc-sale">Expected Sale Price</label>
          <input
            id="proc-sale"
            style={s.input}
            type="text"
            placeholder="$500,000"
            value={salePrice}
            onFocus={trackStart}
            onChange={(e) => setSalePrice(e.target.value)}
          />
        </div>
        <div style={s.formGroup}>
          <label style={s.label} htmlFor="proc-mortgage">Mortgage Balance (if any)</label>
          <input
            id="proc-mortgage"
            style={s.input}
            type="text"
            placeholder="$0"
            value={mortgage}
            onChange={(e) => setMortgage(e.target.value)}
          />
        </div>
        <div style={s.formGroup}>
          <label style={s.label} htmlFor="proc-purchase">Original Purchase Price</label>
          <input
            id="proc-purchase"
            style={s.input}
            type="text"
            placeholder="$400,000"
            value={purchasePrice}
            onChange={(e) => setPurchasePrice(e.target.value)}
          />
        </div>
        <div style={s.formGroup}>
          <span style={s.label} id="proc-primary-label">Primary Residence?</span>
          <div style={s.toggleRow} role="group" aria-labelledby="proc-primary-label">
            <button style={s.toggleBtn(isPrimary)} aria-pressed={isPrimary} onClick={() => setIsPrimary(true)}>Yes</button>
            <button style={s.toggleBtn(!isPrimary)} aria-pressed={!isPrimary} onClick={() => setIsPrimary(false)}>No</button>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 2rem 1.5rem' }}>
        <div style={s.formGroup}>
          <label style={s.label} htmlFor="proc-commission">Agent Commission: {fmtPct(commission)}</label>
          <div style={s.sliderRow}>
            <input
              id="proc-commission"
              type="range"
              min={1}
              max={7}
              step={0.25}
              value={commission}
              onChange={(e) => setCommission(parseFloat(e.target.value))}
              style={s.slider}
            />
            <span style={s.sliderVal}>{fmtPct(commission)}</span>
          </div>
        </div>
      </div>

      {/* Results */}
      {result && (
        <>
          <div style={s.divider} />
          <div style={s.netProceeds}>
            <div style={s.netLabel}>Estimated Net Proceeds</div>
            <div style={result.underwater ? s.netNegative : s.netValue}>
              {fmtCurrency(result.netProceeds)}
            </div>
            <div style={{ fontSize: '0.8rem', color: theme.textSecondary, marginTop: '0.25rem' }}>
              {fmtPct(result.netPct)} of sale price
            </div>
          </div>

          <div style={s.breakdown}>
            <div style={s.bkRow}>
              <span style={s.bkLabel}>Sale Price</span>
              <span style={s.bkValue}>{fmtCurrency(result.salePrice)}</span>
            </div>
            <div style={s.bkRow}>
              <span style={s.bkLabel}>Agent Commission ({fmtPct(commission)})</span>
              <span style={s.bkNegative}>−{fmtCurrency(result.agentCommission)}</span>
            </div>
            <div style={s.bkRow}>
              <span style={s.bkLabel}>NJ Realty Transfer Fee</span>
              <span style={s.bkNegative}>−{fmtCurrency(result.realtyTransferFee)}</span>
            </div>
            <div style={s.bkRow}>
              <span style={s.bkLabel}>NJ Exit Tax / GIT Withholding</span>
              <span style={s.bkNegative}>−{fmtCurrency(result.njExitTax)}</span>
            </div>
            <div style={s.bkRow}>
              <span style={s.bkLabel}>Title Insurance (~0.4%)</span>
              <span style={s.bkNegative}>−{fmtCurrency(result.titleInsurance)}</span>
            </div>
            <div style={s.bkRow}>
              <span style={s.bkLabel}>Attorney Fee (NJ required)</span>
              <span style={s.bkNegative}>−{fmtCurrency(result.attorneyFee)}</span>
            </div>
            <div style={s.bkRow}>
              <span style={s.bkLabel}>Misc. Closing Costs (~0.5%)</span>
              <span style={s.bkNegative}>−{fmtCurrency(result.miscClosingCosts)}</span>
            </div>
            {result.mortgagePayoff > 0 && (
              <div style={s.bkRow}>
                <span style={s.bkLabel}>Mortgage Payoff</span>
                <span style={s.bkNegative}>−{fmtCurrency(result.mortgagePayoff)}</span>
              </div>
            )}
            <div style={s.bkTotal}>
              <span>Net Proceeds</span>
              <span>{fmtCurrency(result.netProceeds)}</span>
            </div>
          </div>

          <div style={s.note}>
            <strong>NJ Exit Tax Note:</strong> {result.exitTaxNote}
          </div>

          <div style={s.cta}>
            <div style={s.ctaText}>
              {result.underwater
                ? "If you owe more than your home is worth, there are still options. Let's talk."
                : "Want to maximize your proceeds? Steven's pricing strategy has helped sellers get top results."}
            </div>
            <button style={s.ctaBtn} onClick={handleCTA}>
              {result.underwater ? 'Get a Free Consultation' : 'Get a Free Pricing Consultation'}
            </button>
          </div>
        </>
      )}

      {!result && (
        <div style={{ padding: '1rem 2rem 2rem', fontSize: '0.875rem', color: theme.textSecondary, textAlign: 'center' as const }}>
          Enter your expected sale price above to see your estimated net proceeds.
        </div>
      )}
    </div>
  );
}
