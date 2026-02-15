/**
 * Lead Scoring System
 *
 * Calculates lead scores based on qualification responses to help
 * prioritize follow-up and route leads appropriately.
 *
 * Score ranges:
 * - Hot (80-100): Ready to act within 30 days - immediate follow-up
 * - Warm (50-79): Active in 1-3 months - same-day follow-up
 * - Nurture (25-49): Planning 3-6 months - add to drip campaign
 * - Cold (0-24): Just browsing - auto-nurture only
 */

export type LeadTemperature = 'hot' | 'warm' | 'nurture' | 'cold';
export type LeadPriority = 'immediate' | 'same-day' | 'nurture' | 'drip';
export type Intent = 'selling' | 'buying' | 'both' | 'home-value' | 'browsing';
export type Timeline = 'within-30-days' | '1-3-months' | '3-6-months' | '6-plus-months';
export type PropertyType = 'single-family' | 'condo' | 'townhouse' | 'multi-family';
export type ImportantFactor = 'speed' | 'price' | 'convenience';
export type ContactPreference = 'asap' | 'morning' | 'afternoon' | 'evening';

export interface QualificationData {
  // Step 1: Interest & Timeline
  intent: Intent;
  timeline: Timeline;

  // Step 2: Property Details
  propertyType?: PropertyType;
  valueRange?: string;
  budgetRange?: string;
  importantFactor?: ImportantFactor;
  preApproved?: boolean | null;

  // Step 3: Contact Info
  contactPreference?: ContactPreference;
}

export interface LeadScore {
  score: number;           // 0-100
  temperature: LeadTemperature;
  priority: LeadPriority;
  breakdown: {
    timeline: number;
    intent: number;
    propertyDetails: number;
    contactReadiness: number;
  };
}

// Scoring weights by timeline
const TIMELINE_SCORES: Record<Timeline, number> = {
  'within-30-days': 40,
  '1-3-months': 25,
  '3-6-months': 15,
  '6-plus-months': 5,
};

// Scoring weights by intent
const INTENT_SCORES: Record<Intent, number> = {
  'selling': 20,
  'buying': 15,
  'both': 25,        // Higher score for dual transaction - bigger opportunity
  'home-value': 10,
  'browsing': 0,
};

// Property type indicates seriousness
const PROPERTY_TYPE_SCORES: Record<PropertyType, number> = {
  'single-family': 10,
  'townhouse': 10,
  'condo': 8,
  'multi-family': 12, // Investment potential
};

// Important factor scoring (price-focused sellers are typically more motivated)
const IMPORTANT_FACTOR_SCORES: Record<ImportantFactor, number> = {
  'speed': 8,        // Urgent sellers are hot leads
  'price': 5,        // Price-focused but patient
  'convenience': 3,  // Less urgency
};

// Contact preference indicates readiness
const CONTACT_PREFERENCE_SCORES: Record<ContactPreference, number> = {
  'asap': 10,
  'morning': 5,
  'afternoon': 5,
  'evening': 3,
};

// Pre-approval for buyers shows seriousness
const PRE_APPROVAL_SCORE = 15;
const NO_PRE_APPROVAL_SCORE = 5;

/**
 * Calculate lead score based on qualification data
 */
export function calculateLeadScore(data: QualificationData): LeadScore {
  let score = 0;
  const breakdown = {
    timeline: 0,
    intent: 0,
    propertyDetails: 0,
    contactReadiness: 0,
  };

  // Timeline scoring (max 40 points)
  breakdown.timeline = TIMELINE_SCORES[data.timeline] || 0;
  score += breakdown.timeline;

  // Intent scoring (max 25 points)
  breakdown.intent = INTENT_SCORES[data.intent] || 0;
  score += breakdown.intent;

  // Property details scoring (max 25 points)
  if (data.propertyType) {
    breakdown.propertyDetails += PROPERTY_TYPE_SCORES[data.propertyType] || 0;
  }

  if (data.importantFactor) {
    breakdown.propertyDetails += IMPORTANT_FACTOR_SCORES[data.importantFactor] || 0;
  }

  // Pre-approval for buyers
  if (data.intent === 'buying' || data.intent === 'both') {
    if (data.preApproved === true) {
      breakdown.propertyDetails += PRE_APPROVAL_SCORE;
    } else if (data.preApproved === false) {
      breakdown.propertyDetails += NO_PRE_APPROVAL_SCORE;
    }
  }

  // Value/budget range adds points (if they specified, they're serious)
  if (data.valueRange || data.budgetRange) {
    breakdown.propertyDetails += 5;
  }

  score += breakdown.propertyDetails;

  // Contact readiness scoring (max 10 points)
  if (data.contactPreference) {
    breakdown.contactReadiness = CONTACT_PREFERENCE_SCORES[data.contactPreference] || 0;
  }
  score += breakdown.contactReadiness;

  // Ensure score is within bounds
  score = Math.min(100, Math.max(0, score));

  // Determine temperature and priority
  const temperature = getTemperature(score);
  const priority = getPriority(temperature);

  return {
    score,
    temperature,
    priority,
    breakdown,
  };
}

/**
 * Get lead temperature from score
 */
export function getTemperature(score: number): LeadTemperature {
  if (score >= 80) return 'hot';
  if (score >= 50) return 'warm';
  if (score >= 25) return 'nurture';
  return 'cold';
}

/**
 * Get follow-up priority from temperature
 */
export function getPriority(temperature: LeadTemperature): LeadPriority {
  switch (temperature) {
    case 'hot': return 'immediate';
    case 'warm': return 'same-day';
    case 'nurture': return 'nurture';
    case 'cold': return 'drip';
  }
}

/**
 * Get display label for temperature
 */
export function getTemperatureLabel(temperature: LeadTemperature): string {
  switch (temperature) {
    case 'hot': return 'HOT LEAD - CALL NOW';
    case 'warm': return 'Warm Lead - Follow Up Today';
    case 'nurture': return 'Nurture Lead - Add to Drip';
    case 'cold': return 'Cold Lead - Auto-Nurture';
  }
}

/**
 * Get emoji for temperature (for notifications)
 */
export function getTemperatureEmoji(temperature: LeadTemperature): string {
  switch (temperature) {
    case 'hot': return '🔥';
    case 'warm': return '🟠';
    case 'nurture': return '🟡';
    case 'cold': return '⚪';
  }
}

/**
 * Get color for temperature (hex codes)
 */
export function getTemperatureColor(temperature: LeadTemperature): string {
  switch (temperature) {
    case 'hot': return '#E53935';     // Red
    case 'warm': return '#FB8C00';     // Orange
    case 'nurture': return '#FDD835';  // Yellow
    case 'cold': return '#9E9E9E';     // Gray
  }
}

/**
 * Format timeline for display
 */
export function formatTimeline(timeline: Timeline): string {
  switch (timeline) {
    case 'within-30-days': return 'Within 30 days';
    case '1-3-months': return '1-3 months';
    case '3-6-months': return '3-6 months';
    case '6-plus-months': return '6+ months';
  }
}

/**
 * Format intent for display
 */
export function formatIntent(intent: Intent): string {
  switch (intent) {
    case 'selling': return 'Selling a Home';
    case 'buying': return 'Buying a Home';
    case 'both': return 'Buying & Selling';
    case 'home-value': return 'Home Value Inquiry';
    case 'browsing': return 'Just Browsing';
  }
}

/**
 * Format property type for display
 */
export function formatPropertyType(type: PropertyType): string {
  switch (type) {
    case 'single-family': return 'Single Family Home';
    case 'condo': return 'Condo';
    case 'townhouse': return 'Townhouse';
    case 'multi-family': return 'Multi-Family';
  }
}

/**
 * Format important factor for display
 */
export function formatImportantFactor(factor: ImportantFactor): string {
  switch (factor) {
    case 'speed': return 'Speed (Sell Quickly)';
    case 'price': return 'Price (Maximize Value)';
    case 'convenience': return 'Convenience (Minimal Hassle)';
  }
}

/**
 * Determine if this is a seller-focused lead
 */
export function isSellerLead(intent: Intent): boolean {
  return intent === 'selling' || intent === 'both' || intent === 'home-value';
}

/**
 * Determine if this is a buyer-focused lead
 */
export function isBuyerLead(intent: Intent): boolean {
  return intent === 'buying' || intent === 'both';
}
