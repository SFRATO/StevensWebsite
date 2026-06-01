/**
 * Tool Calculation Utilities
 *
 * Pure client-safe functions for the interactive data tools.
 * All calculations run client-side using the existing zipcodes.json data.
 * No side effects, no DOM access — safe to import anywhere.
 */

import type { ZipData } from './market-analysis';

// ─── Home Value Estimator ───────────────────────────────────────────────────

export interface HomeValueEstimate {
  low: number;
  mid: number;
  high: number;
  basis: string;
  hasData: boolean;
}

const PROPERTY_TYPE_MULTIPLIER: Record<string, number> = {
  'single-family': 1.00,
  'townhouse': 0.88,
  'condo': 0.82,
  'multi-family': 1.15,
};

const BEDROOM_DELTA: Record<string, number> = {
  '1': -0.18,
  '2': -0.09,
  '3': 0.00,
  '4': 0.08,
  '5+': 0.14,
};

const BATHROOM_DELTA: Record<string, number> = {
  '1': -0.06,
  '1.5': -0.03,
  '2': 0.00,
  '2.5': 0.04,
  '3+': 0.08,
};

export function estimateHomeValue(
  zipData: ZipData,
  beds: string,
  baths: string,
  propertyType: string,
): HomeValueEstimate {
  if (!zipData.median_sale_price) {
    return { low: 0, mid: 0, high: 0, basis: '', hasData: false };
  }

  const base = zipData.median_sale_price;
  const typeMult = PROPERTY_TYPE_MULTIPLIER[propertyType] ?? 1.0;
  const bedDelta = BEDROOM_DELTA[beds] ?? 0;
  const bathDelta = BATHROOM_DELTA[baths] ?? 0;

  const mid = Math.round(base * typeMult * (1 + bedDelta) * (1 + bathDelta) / 1000) * 1000;
  const low = Math.round(mid * 0.92 / 1000) * 1000;
  const high = Math.round(mid * 1.08 / 1000) * 1000;

  const salesCount = zipData.homes_sold ?? 'recent';
  const basis = `Based on ${salesCount} recent sales in ${zipData.zipcode}, where the median is $${base.toLocaleString()}`;

  return { low, mid, high, basis, hasData: true };
}

// ─── Market Timing Tool ─────────────────────────────────────────────────────

export interface MarketTimingScore {
  score: number;
  verdict: 'great' | 'good' | 'neutral' | 'challenging';
  label: string;
  color: string;
  reasons: string[];
  warnings: string[];
}

export function scoreMarketTiming(zipData: ZipData): MarketTimingScore {
  let score = 0;
  const reasons: string[] = [];
  const warnings: string[] = [];

  // Market type (0–30 pts)
  if (zipData.market_type === 'seller') {
    score += 30;
    reasons.push("Seller's market — inventory is tight");
  } else if (zipData.market_type === 'balanced') {
    score += 15;
    reasons.push('Balanced market — reasonable conditions');
  } else {
    warnings.push("Buyer's market — more competition from other sellers");
  }

  // Price trend (0–25 pts)
  const yoy = zipData.median_sale_price_yoy;
  if (yoy !== null) {
    if (yoy > 8) {
      score += 25;
      reasons.push(`Prices up ${yoy.toFixed(1)}% year-over-year — strong appreciation`);
    } else if (yoy > 3) {
      score += 15;
      reasons.push(`Prices rising ${yoy.toFixed(1)}% year-over-year`);
    } else if (yoy > 0) {
      score += 8;
      reasons.push(`Prices up slightly ${yoy.toFixed(1)}% year-over-year`);
    } else {
      warnings.push(`Prices down ${Math.abs(yoy).toFixed(1)}% from last year`);
    }
  }

  // Days on market (0–20 pts)
  const dom = zipData.median_dom;
  if (dom !== null) {
    if (dom < 30) {
      score += 20;
      reasons.push(`Homes selling in just ${Math.round(dom)} days — very fast market`);
    } else if (dom < 45) {
      score += 12;
      reasons.push(`Homes selling in ${Math.round(dom)} days on average`);
    } else if (dom < 60) {
      score += 6;
    } else {
      warnings.push(`Homes taking ${Math.round(dom)} days to sell — slower pace`);
    }
  }

  // Sold above list (0–15 pts)
  const aboveList = zipData.sold_above_list_pct;
  if (aboveList !== null) {
    if (aboveList > 50) {
      score += 15;
      reasons.push(`${aboveList.toFixed(0)}% of homes sell above asking price`);
    } else if (aboveList > 35) {
      score += 8;
      reasons.push(`${aboveList.toFixed(0)}% of homes sell at or above asking`);
    } else if (aboveList > 20) {
      score += 3;
    }
  }

  // Inventory trend (0–10 pts)
  const invYoy = zipData.inventory_yoy;
  if (invYoy !== null) {
    if (invYoy < -10) {
      score += 10;
      reasons.push(`Inventory down ${Math.abs(invYoy).toFixed(0)}% — fewer homes competing`);
    } else if (invYoy < 0) {
      score += 5;
    } else if (invYoy > 15) {
      warnings.push(`Inventory rising ${invYoy.toFixed(0)}% — more homes on market`);
    }
  }

  let verdict: MarketTimingScore['verdict'];
  let label: string;
  let color: string;

  if (score >= 70) {
    verdict = 'great';
    label = 'Great Time to Sell';
    color = '#16a34a';
  } else if (score >= 45) {
    verdict = 'good';
    label = 'Good Time to Sell';
    color = '#C99C33';
  } else if (score >= 25) {
    verdict = 'neutral';
    label = 'Neutral Market';
    color = '#64748b';
  } else {
    verdict = 'challenging';
    label = 'Challenging Market';
    color = '#dc2626';
  }

  return { score, verdict, label, color, reasons, warnings };
}

// ─── Net Proceeds Calculator ────────────────────────────────────────────────

export interface NetProceedsBreakdown {
  salePrice: number;
  agentCommission: number;
  realtyTransferFee: number;
  njExitTax: number;
  titleInsurance: number;
  attorneyFee: number;
  miscClosingCosts: number;
  mortgagePayoff: number;
  totalCosts: number;
  netProceeds: number;
  netPct: number;
  exitTaxNote: string;
  underwater: boolean;
}

/**
 * NJ Realty Transfer Fee — tiered formula (seller pays)
 * Rate per $500 of consideration:
 *   First $150k:  $2.00 ($4/1000)
 *   $150k–350k:   $3.35 ($6.70/1000)
 *   $350k–550k:   $3.90 ($7.80/1000)
 *   Over $550k:   $4.80 ($9.60/1000)
 * Base is per $500, so divide price by 500 then multiply by rate.
 */
function calcNJRTF(price: number): number {
  let fee = 0;
  const tiers = [
    { cap: 150_000, rate: 2.00 },
    { cap: 350_000, rate: 3.35 },
    { cap: 550_000, rate: 3.90 },
    { cap: Infinity, rate: 4.80 },
  ];

  let remaining = price;
  let prev = 0;

  for (const { cap, rate } of tiers) {
    if (remaining <= 0) break;
    const slice = Math.min(remaining, cap - prev);
    fee += (slice / 500) * rate;
    remaining -= slice;
    prev = cap;
  }

  return Math.round(fee);
}

export function calcNetProceeds(
  salePrice: number,
  mortgageBalance: number,
  commissionRate: number, // percentage, e.g. 5.0
  purchasePrice: number,
  isPrimaryResidence: boolean,
): NetProceedsBreakdown {
  const agentCommission = Math.round(salePrice * (commissionRate / 100));
  const realtyTransferFee = calcNJRTF(salePrice);

  // NJ exit tax / GIT withholding
  let njExitTax = 0;
  let exitTaxNote = '';
  if (isPrimaryResidence) {
    njExitTax = Math.round(salePrice * 0.02);
    exitTaxNote = 'NJ requires 2% of sale price withheld at closing for estimated GIT. This is refundable when you file your NJ tax return if actual tax is lower.';
  } else {
    const estimatedGain = salePrice - purchasePrice - agentCommission - realtyTransferFee - 3000;
    njExitTax = estimatedGain > 0 ? Math.round(estimatedGain * 0.0897) : 0;
    exitTaxNote = 'NJ withholds 8.97% of estimated gain for non-primary residences. Consult a tax professional for your specific situation.';
  }

  const titleInsurance = Math.round(salePrice * 0.004);
  const attorneyFee = 1500;
  const miscClosingCosts = Math.round(salePrice * 0.005);
  const mortgagePayoff = Math.max(0, mortgageBalance);

  const totalCosts = agentCommission + realtyTransferFee + njExitTax + titleInsurance + attorneyFee + miscClosingCosts + mortgagePayoff;
  const netProceeds = salePrice - totalCosts;
  const netPct = salePrice > 0 ? (netProceeds / salePrice) * 100 : 0;

  return {
    salePrice,
    agentCommission,
    realtyTransferFee,
    njExitTax,
    titleInsurance,
    attorneyFee,
    miscClosingCosts,
    mortgagePayoff,
    totalCosts,
    netProceeds,
    netPct,
    exitTaxNote,
    underwater: netProceeds < 0,
  };
}

// ─── Affordability Calculator ────────────────────────────────────────────────

export interface AffordabilityResult {
  maxHomePrice: number;
  maxLoan: number;
  monthlyPrincipalInterest: number;
  monthlyTaxInsurance: number;
  monthlyTotal: number;
  affordabilityRatio: number; // maxHomePrice / median — 1.2 means 20% above median
  verdict: 'strong' | 'good' | 'stretch' | 'insufficient';
  verdictLabel: string;
  hasLocalData: boolean;
}

export function calcAffordability(
  annualIncome: number,
  downPayment: number,
  interestRate: number, // e.g. 6.8
  loanTermYears: number,
  monthlyDebts: number,
  zipData: ZipData | null,
): AffordabilityResult {
  const monthlyGross = annualIncome / 12;
  const maxTotalMonthlyDebt = monthlyGross * 0.36;
  const maxMonthlyDebtService = maxTotalMonthlyDebt - monthlyDebts;

  // Estimate property tax + insurance (~1.8% annually for NJ, split monthly)
  const medianPrice = zipData?.median_sale_price ?? 400_000;
  const estimatedTaxInsurance = (medianPrice * 0.018) / 12;

  const maxMonthlyPI = Math.max(0, maxMonthlyDebtService - estimatedTaxInsurance);

  // Calculate max loan: P = PMT * (1 - (1+r)^-n) / r
  const monthlyRate = interestRate / 100 / 12;
  const n = loanTermYears * 12;
  const maxLoan = monthlyRate > 0
    ? maxMonthlyPI * (1 - Math.pow(1 + monthlyRate, -n)) / monthlyRate
    : maxMonthlyPI * n;

  const maxHomePrice = Math.max(0, Math.round((maxLoan + downPayment) / 1000) * 1000);
  const monthlyPrincipalInterest = maxMonthlyPI;
  const monthlyTaxInsurance = estimatedTaxInsurance;
  const monthlyTotal = monthlyPrincipalInterest + monthlyTaxInsurance;

  const affordabilityRatio = medianPrice > 0 ? maxHomePrice / medianPrice : 1;

  let verdict: AffordabilityResult['verdict'];
  let verdictLabel: string;
  if (affordabilityRatio >= 1.2) {
    verdict = 'strong';
    verdictLabel = 'Strong Buying Power';
  } else if (affordabilityRatio >= 0.9) {
    verdict = 'good';
    verdictLabel = 'Good Buying Power';
  } else if (affordabilityRatio >= 0.7) {
    verdict = 'stretch';
    verdictLabel = 'Stretching Budget';
  } else {
    verdict = 'insufficient';
    verdictLabel = 'Consider a Different Area';
  }

  return {
    maxHomePrice,
    maxLoan: Math.round(maxLoan),
    monthlyPrincipalInterest: Math.round(monthlyPrincipalInterest),
    monthlyTaxInsurance: Math.round(monthlyTaxInsurance),
    monthlyTotal: Math.round(monthlyTotal),
    affordabilityRatio,
    verdict,
    verdictLabel,
    hasLocalData: !!zipData?.median_sale_price,
  };
}

// ─── Formatting helpers ──────────────────────────────────────────────────────

export function fmtCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

export function fmtPct(n: number, decimals = 1): string {
  return `${n.toFixed(decimals)}%`;
}
