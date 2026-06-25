/**
 * Brokerage / licensee identity + NJ advertising-compliance constants.
 *
 * Single source of truth for the agent/broker identity, contact info, and the
 * verbatim disclosures mandated by N.J.A.C. 11:5-6.1 (NJ Real Estate Commission
 * advertising rules, rewritten effective Jan 20, 2026). Import these everywhere
 * a disclosure or contact detail is rendered so the wording cannot drift.
 *
 * Note: (609) 789-0126 is Steven's personal/cell line; OFFICE_PHONE is the
 * CENTURY 21 Action Plus Realty brokerage office line required by 11:5-6.1(d).
 */

export const AGENT_NAME = 'Steven Frato';
export const AGENT_TITLE = 'NJ Licensed Real Estate Salesperson';
export const AGENT_LICENSE = '2567370';

/** Steven's direct/cell line (NOT the licensed brokerage office). */
export const AGENT_CELL = '(609) 789-0126';
export const AGENT_CELL_HREF = 'tel:+16097890126';
export const AGENT_EMAIL = 'sf@stevenfrato.com';
export const AGENT_EMAIL_HREF = 'mailto:sf@stevenfrato.com';

/** Full legal name of the affiliated broker (the "regular business name"). */
export const BROKER_NAME = 'CENTURY 21 Action Plus Realty';
/** Brokerage-business indicator required by 11:5-6.1(c). */
export const BROKER_LICENSE_LABEL = 'Licensed Real Estate Broker';
/** TODO: confirm broker-of-record name (used on exterior signage per (a)2). */
export const BROKER_OF_RECORD = '';

/**
 * Licensed brokerage office line. Required by 11:5-6.1(d): the brokerage office
 * number must appear wherever the salesperson's contact info appears.
 */
export const OFFICE_PHONE = '(800) 299-2129';
export const OFFICE_PHONE_HREF = 'tel:+18002992129';

export const OFFICE_ADDRESS = {
  street: '136 Farnsworth Ave',
  city: 'Bordentown',
  state: 'NJ',
  zip: '08505',
};

/** Optional: broker website. If set, enables the (b)3 prominent-link path. */
export const BROKER_WEBSITE_URL = '';

/** Complete listing-service name required by 11:5-6.1(k). */
export const MLS_NAME = 'Bright MLS';

/**
 * Verbatim mandated disclosures. Do not paraphrase — the wording is set by rule.
 */
export const DISCLOSURE = {
  /** (q) — wherever a commission rate/compensation amount is referenced. */
  commissionNegotiable:
    'In New Jersey, broker compensation is fully negotiable and not set by law.',
  /** (p) — immediately after any reference to licensure by the Commission. */
  licensureEndorsement: 'Licensure does not imply endorsement.',
  /** (j)2 — franchisor trade-name advertising. */
  franchiseIndependence: 'Each office is independently owned and operated.',
  /** (f) — financing/down payment/monthly payment/mortgage figures. */
  qualifiedBuyer:
    'Figures are estimates; financing is available to a qualified buyer, subject to lender credit approval.',
  /** (m)1.i — any written CMA / home-value report provided to a consumer. */
  notAnAppraisal:
    'This is a comparative market analysis (CMA), not an appraisal, and should not be considered the equivalent of an appraisal.',
  /** (m)1.i — short form for the automated on-page estimator (not a CMA). */
  estimateNotAppraisal: 'This is an automated estimate, not an appraisal.',
} as const;
