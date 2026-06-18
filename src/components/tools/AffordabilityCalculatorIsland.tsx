/**
 * Affordability Calculator Island
 * Shows max home price based on income, down payment, and local market data.
 */

import { useState, useEffect, useCallback } from 'react';
import type { ZipData } from '../../utils/market-analysis';
import type { TownZipMapping } from '../../data/town-mappings';
import { calcAffordability, fmtCurrency } from '../../utils/toolsCalc';
import { trackEvent } from '@utils/analytics';
import LocationPickerIsland from './LocationPickerIsland';

interface Props {
  mappings: TownZipMapping[];
  zipcodes: ZipData[];
}

function parseNum(s: string): number {
  return parseFloat(s.replace(/[^0-9.]/g, '')) || 0;
}

const gold = '#C99C33';
const charcoal = '#1a1a1a';

const s = {
  card: { background: '#fff', borderRadius: '1rem', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', overflow: 'hidden' as const },
  header: { padding: '1.5rem 2rem', borderBottom: '1px solid #e2e8f0' },
  stepLabel: { fontSize: '0.75rem', fontWeight: 700, color: gold, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: '0.25rem' },
  heading: { fontSize: '1.25rem', fontWeight: 700, color: charcoal, margin: 0 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', padding: '1.5rem 2rem' },
  formGroup: { display: 'flex', flexDirection: 'column' as const, gap: '0.4rem' },
  label: { fontSize: '0.8rem', fontWeight: 600, color: '#475569' },
  input: {
    padding: '0.75rem 1rem',
    border: '1.5px solid #e2e8f0',
    borderRadius: '0.5rem',
    fontSize: '1rem',
    width: '100%',
    boxSizing: 'border-box' as const,
    outline: 'none',
  },
  termRow: { display: 'flex', gap: '0.5rem' },
  termBtn: (active: boolean) => ({
    flex: 1,
    padding: '0.6rem',
    border: `2px solid ${active ? gold : '#e2e8f0'}`,
    borderRadius: '0.5rem',
    background: active ? '#fef9ee' : '#fff',
    color: active ? charcoal : '#64748b',
    fontWeight: active ? 700 : 400,
    cursor: 'pointer',
    fontSize: '0.85rem',
  }),
  divider: { height: '1px', background: '#e2e8f0', margin: '0 2rem' },
  resultBand: (verdict: string) => ({
    padding: '1.5rem 2rem',
    background: verdict === 'strong' ? '#f0fdf4' : verdict === 'good' ? '#fef9ee' : verdict === 'stretch' ? '#fef3c7' : '#fef2f2',
    borderTop: '1px solid #e2e8f0',
  }),
  verdictBadge: (verdict: string) => ({
    display: 'inline-block',
    padding: '0.3rem 0.75rem',
    borderRadius: '999px',
    background: verdict === 'strong' ? '#16a34a' : verdict === 'good' ? gold : verdict === 'stretch' ? '#d97706' : '#dc2626',
    color: '#fff',
    fontSize: '0.8rem',
    fontWeight: 700,
    marginBottom: '0.75rem',
  }),
  maxPrice: { fontSize: '2.5rem', fontWeight: 800, color: charcoal },
  maxLabel: { fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem' },
  paymentBreak: { display: 'flex', gap: '1.5rem', marginTop: '1.25rem', flexWrap: 'wrap' as const },
  payItem: {},
  payValue: { fontSize: '1.1rem', fontWeight: 700, color: charcoal },
  payLabel: { fontSize: '0.75rem', color: '#64748b' },
  context: { padding: '1rem 2rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', fontSize: '0.9rem', color: '#475569' },
  cta: { padding: '1.5rem 2rem', borderTop: '1px solid #e2e8f0' },
  ctaText: { fontSize: '1rem', fontWeight: 600, color: charcoal, marginBottom: '0.5rem' },
  ctaBtn: {
    display: 'block',
    width: '100%',
    padding: '0.875rem',
    background: gold,
    color: '#fff',
    border: 'none',
    borderRadius: '0.5rem',
    fontWeight: 700,
    fontSize: '1rem',
    cursor: 'pointer',
  },
  disclaimer: { padding: '0.75rem 2rem 1.5rem', fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' as const },
};

export default function AffordabilityCalculatorIsland({ mappings, zipcodes }: Props) {
  const [selectedZip, setSelectedZip] = useState<ZipData | null>(null);
  const [townName, setTownName] = useState('');
  const [income, setIncome] = useState('');
  const [downPayment, setDownPayment] = useState('');
  const [interestRate, setInterestRate] = useState('6.8');
  const [term, setTerm] = useState(30);
  const [debts, setDebts] = useState('');
  const [hasTracked, setHasTracked] = useState(false);

  const handleSelect = (zipData: ZipData, town: string) => {
    setSelectedZip(zipData);
    setTownName(town);
  };

  const incomeNum = parseNum(income);
  const downNum = parseNum(downPayment);
  const rateNum = parseFloat(interestRate) || 6.8;
  const debtsNum = parseNum(debts);

  const result = incomeNum > 0
    ? calcAffordability(incomeNum, downNum, rateNum, term, debtsNum, selectedZip)
    : null;

  const trackStart = useCallback(() => {
    if (!hasTracked) {
      setHasTracked(true);
      trackEvent('Engagement', 'Tool Start', 'Affordability Calculator');
    }
  }, [hasTracked]);

  useEffect(() => {
    if (result) {
      const t = setTimeout(() => {
        trackEvent('Engagement', 'Tool Calculated', 'Max Home Price', Math.round(result.maxHomePrice / 1000));
      }, 600);
      return () => clearTimeout(t);
    }
  }, [result?.maxHomePrice]);

  const handleCTA = () => {
    trackEvent('Lead', 'Tool CTA Click', 'Affordability - Connect Lender', result ? Math.round(result.maxHomePrice / 1000) : 0);
    document.dispatchEvent(
      new CustomEvent('tool:lead-ready', {
        detail: { town: townName, zipcode: selectedZip?.zipcode ?? '', toolName: 'Affordability Calculator' },
      }),
    );
  };

  return (
    <div style={s.card}>
      <div style={s.header}>
        <div style={s.stepLabel}>Buyer Affordability Calculator</div>
        <h2 style={s.heading}>How Much Home Can You Afford in NJ?</h2>
      </div>

      <div style={{ padding: '1.5rem 2rem 0' }}>
        <LocationPickerIsland
          mappings={mappings}
          zipcodes={zipcodes}
          onSelect={handleSelect}
          label="Target Area (optional — for local price comparison)"
          placeholder="Town or zip code..."
        />
      </div>

      <div style={s.grid}>
        <div style={s.formGroup}>
          <label style={s.label} htmlFor="aff-income">Household Annual Income</label>
          <input
            id="aff-income"
            style={s.input}
            type="text"
            placeholder="$120,000"
            value={income}
            onFocus={trackStart}
            onChange={(e) => setIncome(e.target.value)}
          />
        </div>
        <div style={s.formGroup}>
          <label style={s.label} htmlFor="aff-down">Down Payment Available</label>
          <input
            id="aff-down"
            style={s.input}
            type="text"
            placeholder="$60,000"
            value={downPayment}
            onChange={(e) => setDownPayment(e.target.value)}
          />
        </div>
        <div style={s.formGroup}>
          <label style={s.label} htmlFor="aff-rate">Interest Rate (%)</label>
          <input
            id="aff-rate"
            style={s.input}
            type="number"
            step="0.1"
            min="1"
            max="15"
            value={interestRate}
            onChange={(e) => setInterestRate(e.target.value)}
          />
        </div>
        <div style={s.formGroup}>
          <label style={s.label} htmlFor="aff-debts">Monthly Existing Debts</label>
          <input
            id="aff-debts"
            style={s.input}
            type="text"
            placeholder="$500 (car, student loans)"
            value={debts}
            onChange={(e) => setDebts(e.target.value)}
          />
        </div>
        <div style={{ ...s.formGroup, gridColumn: '1 / -1' }}>
          <span style={s.label} id="aff-term-label">Loan Term</span>
          <div style={s.termRow} role="group" aria-labelledby="aff-term-label">
            {[15, 20, 30].map((t) => (
              <button
                key={t}
                style={s.termBtn(term === t)}
                aria-pressed={term === t}
                aria-label={`${t}-year loan term`}
                onClick={() => setTerm(t)}
              >
                {t}-Year
              </button>
            ))}
          </div>
        </div>
      </div>

      {result && (
        <>
          <div style={s.divider} />
          <div style={s.resultBand(result.verdict)}>
            <div style={s.verdictBadge(result.verdict)}>{result.verdictLabel}</div>
            <div style={s.maxPrice}>{fmtCurrency(result.maxHomePrice)}</div>
            <div style={s.maxLabel}>Estimated Maximum Home Price</div>
            <div style={s.paymentBreak}>
              <div style={s.payItem}>
                <div style={s.payValue}>{fmtCurrency(result.monthlyPrincipalInterest)}/mo</div>
                <div style={s.payLabel}>Principal + Interest</div>
              </div>
              <div style={s.payItem}>
                <div style={s.payValue}>{fmtCurrency(result.monthlyTaxInsurance)}/mo</div>
                <div style={s.payLabel}>Est. Taxes + Insurance</div>
              </div>
              <div style={s.payItem}>
                <div style={s.payValue}>{fmtCurrency(result.monthlyTotal)}/mo</div>
                <div style={s.payLabel}>Total Est. Payment</div>
              </div>
            </div>
          </div>

          {selectedZip?.median_sale_price && (
            <div style={s.context}>
              {result.maxHomePrice >= selectedZip.median_sale_price
                ? `Your budget of ${fmtCurrency(result.maxHomePrice)} is ${fmtCurrency(result.maxHomePrice - selectedZip.median_sale_price)} above the ${townName || selectedZip.zipcode} median of ${fmtCurrency(selectedZip.median_sale_price)}. You have strong options in this market.`
                : `The ${townName || selectedZip.zipcode} median is ${fmtCurrency(selectedZip.median_sale_price)}. Your budget may benefit from exploring nearby areas. Steven can help you find the right fit.`}
              {selectedZip.inventory != null && (
                <span> There are currently {selectedZip.inventory} active listings in this area.</span>
              )}
            </div>
          )}

          <div style={s.cta}>
            <div style={s.ctaText}>Ready to start your home search? Let's connect you with the right resources.</div>
            <button style={s.ctaBtn} onClick={handleCTA}>Talk to Steven About Buying</button>
          </div>
          <div style={s.disclaimer}>
            Estimates are based on 36% back-end DTI, NJ property tax rate of ~1.8% annually, and homeowner's insurance. Actual qualification depends on credit, lender, and full financial picture.
          </div>
        </>
      )}

      {!result && (
        <div style={{ padding: '1rem 2rem 2rem', fontSize: '0.875rem', color: '#64748b', textAlign: 'center' as const }}>
          Enter your annual income above to see how much home you can afford.
        </div>
      )}
    </div>
  );
}
