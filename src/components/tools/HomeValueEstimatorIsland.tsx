/**
 * Home Value Estimator Island
 * Instant home value estimate using local median sale price + adjustment factors.
 */

import { useState } from 'react';
import type { ZipData } from '../../utils/market-analysis';
import type { TownZipMapping } from '../../data/town-mappings';
import { estimateHomeValue, fmtCurrency } from '../../utils/toolsCalc';
import { DISCLOSURE } from '../../data/brokerage';
import { trackEvent } from '@utils/analytics';
import LocationPickerIsland from './LocationPickerIsland';

interface Props {
  mappings: TownZipMapping[];
  zipcodes: ZipData[];
}

const PROPERTY_TYPES = [
  { value: 'single-family', label: 'Single Family', icon: '🏠' },
  { value: 'townhouse', label: 'Townhouse', icon: '🏘️' },
  { value: 'condo', label: 'Condo', icon: '🏢' },
  { value: 'multi-family', label: 'Multi-Family', icon: '🏗️' },
];

const BED_OPTIONS = ['1', '2', '3', '4', '5+'];
const BATH_OPTIONS = ['1', '1.5', '2', '2.5', '3+'];

const gold = '#C99C33';
const charcoal = '#1a1a1a';

const s = {
  card: { background: '#fff', borderRadius: '1rem', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', overflow: 'hidden' as const },
  section: { padding: '2rem' },
  stepLabel: { fontSize: '0.75rem', fontWeight: 700, color: gold, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: '0.5rem' },
  heading: { fontSize: '1.25rem', fontWeight: 700, color: charcoal, margin: '0 0 1.5rem' },
  optionGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' },
  option: (active: boolean) => ({
    padding: '0.875rem 0.5rem',
    border: `2px solid ${active ? gold : '#e2e8f0'}`,
    borderRadius: '0.5rem',
    background: active ? '#fef9ee' : '#fff',
    cursor: 'pointer',
    textAlign: 'center' as const,
    transition: 'all 0.15s',
    fontSize: '0.875rem',
    fontWeight: active ? 600 : 400,
    color: active ? charcoal : '#64748b',
  }),
  optionIcon: { display: 'block', fontSize: '1.5rem', marginBottom: '0.25rem' },
  pillRow: { display: 'flex', flexWrap: 'wrap' as const, gap: '0.5rem', marginBottom: '1.25rem' },
  pill: (active: boolean) => ({
    padding: '0.5rem 1rem',
    borderRadius: '999px',
    border: `2px solid ${active ? gold : '#e2e8f0'}`,
    background: active ? gold : '#fff',
    color: active ? '#fff' : charcoal,
    cursor: 'pointer',
    fontWeight: active ? 600 : 400,
    fontSize: '0.9rem',
    transition: 'all 0.15s',
  }),
  pillLabel: { fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem', fontWeight: 500 },
  btn: {
    width: '100%',
    padding: '1rem',
    background: gold,
    color: '#fff',
    border: 'none',
    borderRadius: '0.5rem',
    fontSize: '1rem',
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: '1rem',
  },
  resultBand: { background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)', padding: '2rem', color: '#fff' },
  resultLabel: { fontSize: '0.8rem', color: '#aaa', textTransform: 'uppercase' as const, letterSpacing: '0.08em' },
  resultValue: { fontSize: '2rem', fontWeight: 800, color: gold, margin: '0.25rem 0' },
  rangeRow: { display: 'flex', gap: '2rem', marginTop: '1rem' },
  rangeItem: { flex: 1 },
  rangeItemLabel: { fontSize: '0.75rem', color: '#aaa' },
  rangeItemValue: { fontSize: '1.1rem', fontWeight: 600, color: '#e2e8f0' },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', padding: '1.5rem 2rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0' },
  stat: { textAlign: 'center' as const },
  statValue: { fontSize: '1.25rem', fontWeight: 700, color: charcoal },
  statLabel: { fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' },
  cta: { padding: '1.5rem 2rem', borderTop: '1px solid #e2e8f0', background: '#fff' },
  ctaText: { fontSize: '1rem', fontWeight: 600, color: charcoal, marginBottom: '0.5rem' },
  ctaSub: { fontSize: '0.875rem', color: '#64748b', marginBottom: '1rem' },
  ctaBtn: {
    display: 'inline-block',
    padding: '0.875rem 2rem',
    background: gold,
    color: '#fff',
    borderRadius: '0.5rem',
    fontWeight: 700,
    textDecoration: 'none',
    cursor: 'pointer',
    border: 'none',
    fontSize: '1rem',
  },
  basisNote: { fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.75rem', fontStyle: 'italic' as const },
  noDataNote: { padding: '1rem', background: '#fef2f2', borderRadius: '0.5rem', color: '#991b1b', fontSize: '0.9rem' },
};

export default function HomeValueEstimatorIsland({ mappings, zipcodes }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedZip, setSelectedZip] = useState<ZipData | null>(null);
  const [townName, setTownName] = useState('');
  const [propType, setPropType] = useState('single-family');
  const [beds, setBeds] = useState('3');
  const [baths, setBaths] = useState('2');

  const handleLocationSelect = (zipData: ZipData, town: string) => {
    setSelectedZip(zipData);
    setTownName(town);
    setStep(2);
    trackEvent('Engagement', 'Tool Step Complete', 'Home Value - Location', 1);
  };

  const handleCalculate = () => {
    setStep(3);
    trackEvent('Engagement', 'Tool Step Complete', 'Home Value - Details', 2);
    if (selectedZip) {
      const est = estimateHomeValue(selectedZip, beds, baths, propType);
      if (est.hasData) {
        trackEvent('Lead', 'Tool Result Shown', 'Home Value Estimate', Math.round(est.mid / 1000));
      }
    }
  };

  const handleCTAClick = () => {
    if (selectedZip) {
      const est = estimateHomeValue(selectedZip, beds, baths, propType);
      trackEvent('Lead', 'Tool CTA Click', 'Home Value - Get CMA', Math.round(est.mid / 1000));
    }
    document.dispatchEvent(
      new CustomEvent('tool:lead-ready', {
        detail: {
          town: townName,
          zipcode: selectedZip?.zipcode ?? '',
          toolName: 'Home Value Estimator',
        },
      }),
    );
  };

  const estimate = selectedZip ? estimateHomeValue(selectedZip, beds, baths, propType) : null;

  return (
    <div style={s.card}>
      {/* Step 1: Location */}
      {step === 1 && (
        <div style={s.section}>
          <div style={s.stepLabel}>Step 1 of 3</div>
          <p style={s.heading}>Where is your property located?</p>
          <LocationPickerIsland
            mappings={mappings}
            zipcodes={zipcodes}
            onSelect={handleLocationSelect}
            label="Town or Zip Code"
            placeholder="e.g., Cherry Hill, Marlton, 08053..."
          />
        </div>
      )}

      {/* Step 2: Property Details */}
      {step === 2 && (
        <div style={s.section}>
          <div style={s.stepLabel}>Step 2 of 3 — {townName}</div>
          <p style={s.heading}>Tell us about your property</p>

          <p style={s.pillLabel}>Property Type</p>
          <div style={s.optionGrid}>
            {PROPERTY_TYPES.map((pt) => (
              <button
                key={pt.value}
                onClick={() => setPropType(pt.value)}
                style={s.option(propType === pt.value)}
              >
                <span style={s.optionIcon}>{pt.icon}</span>
                {pt.label}
              </button>
            ))}
          </div>

          <p style={s.pillLabel}>Bedrooms</p>
          <div style={s.pillRow}>
            {BED_OPTIONS.map((b) => (
              <button key={b} onClick={() => setBeds(b)} style={s.pill(beds === b)}>{b}</button>
            ))}
          </div>

          <p style={s.pillLabel}>Bathrooms</p>
          <div style={s.pillRow}>
            {BATH_OPTIONS.map((b) => (
              <button key={b} onClick={() => setBaths(b)} style={s.pill(baths === b)}>{b}</button>
            ))}
          </div>

          <button style={s.btn} onClick={handleCalculate}>
            Get My Estimate →
          </button>
        </div>
      )}

      {/* Step 3: Results */}
      {step === 3 && estimate && (
        <>
          {estimate.hasData ? (
            <>
              <div style={s.resultBand}>
                <div style={s.resultLabel}>Estimated Home Value</div>
                <div style={s.resultValue}>{fmtCurrency(estimate.mid)}</div>
                <div style={s.rangeRow}>
                  <div style={s.rangeItem}>
                    <div style={s.rangeItemLabel}>Conservative</div>
                    <div style={s.rangeItemValue}>{fmtCurrency(estimate.low)}</div>
                  </div>
                  <div style={s.rangeItem}>
                    <div style={s.rangeItemLabel}>Optimistic</div>
                    <div style={s.rangeItemValue}>{fmtCurrency(estimate.high)}</div>
                  </div>
                </div>
                <p style={s.basisNote}>{estimate.basis}</p>
                {/* N.J.A.C. 11:5-6.1(m)1.i: this automated estimate is not an appraisal. */}
                <p style={{ fontSize: '0.95rem', fontWeight: 600, marginTop: '0.75rem' }}>
                  {DISCLOSURE.estimateNotAppraisal}
                </p>
              </div>

              {selectedZip && (
                <div style={s.statsRow}>
                  <div style={s.stat}>
                    <div style={s.statValue}>{fmtCurrency(selectedZip.median_sale_price)}</div>
                    <div style={s.statLabel}>Area Median</div>
                  </div>
                  <div style={s.stat}>
                    <div style={s.statValue}>{selectedZip.median_dom ?? 'N/A'}</div>
                    <div style={s.statLabel}>Days on Market</div>
                  </div>
                  <div style={s.stat}>
                    <div style={s.statValue}>{selectedZip.sold_above_list_pct != null ? `${selectedZip.sold_above_list_pct.toFixed(0)}%` : 'N/A'}</div>
                    <div style={s.statLabel}>Sell Above List</div>
                  </div>
                </div>
              )}

              <div style={s.cta}>
                <div style={s.ctaText}>Want a precise number? Get a free Comparative Market Analysis.</div>
                <div style={s.ctaSub}>Steven will review your specific property details and provide an exact pricing recommendation — no obligation.</div>
                <button style={s.ctaBtn} onClick={handleCTAClick}>
                  Get My Free CMA Report
                </button>
              </div>
            </>
          ) : (
            <div style={{ padding: '2rem' }}>
              <div style={s.noDataNote}>
                We don't have enough sales data for this specific zip code yet.
                {selectedZip?.nearby_zips?.length ? (
                  <span> Try a nearby area or contact Steven directly for a personalized analysis.</span>
                ) : null}
              </div>
              <button style={{ ...s.btn, marginTop: '1rem' }} onClick={handleCTAClick}>
                Get a Personalized Analysis
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
