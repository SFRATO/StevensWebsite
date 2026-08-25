/**
 * Fair Housing screening for generated real-estate advertising copy.
 *
 * WHY THIS EXISTS
 * ---------------
 * The Fair Housing Act prohibits advertising that states a preference,
 * limitation, or discrimination based on race, color, religion, sex, familial
 * status, national origin, or disability — and HUD has long read that to cover
 * language that *implies* a preference, not just language that states one. An
 * agent is liable for the ad regardless of who (or what) drafted it.
 *
 * The model is instructed not to produce this language, but an instruction is a
 * request, not a guarantee. This module is the second layer: it inspects the
 * generated text and refuses to hand back copy that trips a known pattern.
 *
 * WHAT THIS IS NOT
 * ----------------
 * This is not legal review and it cannot be. It catches the well-documented
 * phrasings that a generator plausibly reaches for; it cannot judge context, and
 * it will miss novel wording. It is a backstop that keeps obvious violations out
 * of a one-click publish flow — a human still reads the ad before it runs.
 *
 * Deliberately biased toward false positives: a blocked ad costs Steven ten
 * seconds, a published discriminatory ad costs him a HUD complaint.
 */

export type FairHousingCategory =
  | 'familial-status'
  | 'religion'
  | 'race-or-national-origin'
  | 'disability'
  | 'sex'
  | 'proxy';

export interface FairHousingFinding {
  /** The exact text that matched, as it appeared in the copy. */
  matched: string;
  category: FairHousingCategory;
  /** Plain-language reason, written to be shown to Steven, not to a developer. */
  why: string;
}

interface Rule {
  pattern: RegExp;
  category: FairHousingCategory;
  why: string;
}

/**
 * Describe the PROPERTY, never the PERSON.
 *
 * That single rule explains every entry below: "four bedrooms" is a fact about
 * the house, "perfect for a growing family" is a statement about who should live
 * in it. The former is fine at any length; the latter is the violation.
 */
const RULES: Rule[] = [
  // --- Familial status -----------------------------------------------------
  // The most common way a well-meaning real-estate ad goes wrong. "Family" as a
  // descriptor of the intended occupant is a preference; describing a room as a
  // "family room" is not, so the patterns below require an occupant sense.
  {
    pattern: /\b(perfect|ideal|great|wonderful|suited?)\s+for\s+(a\s+)?(growing\s+)?famil(y|ies)\b/gi,
    category: 'familial-status',
    why: 'States a preference for families. Describe the property (bedrooms, yard, layout) and let buyers decide if it fits.',
  },
  {
    pattern: /\bfamily[-\s]?(friendly|oriented)\b/gi,
    category: 'familial-status',
    why: 'Implies a preference for households with children. Describe the specific features instead — yard, cul-de-sac, square footage.',
  },
  {
    pattern: /\b(no|not?\s+suitable\s+for)\s+(kids|children)\b/gi,
    category: 'familial-status',
    why: 'Excludes households with children, which is prohibited.',
  },
  {
    pattern: /\b(empty[-\s]?nester|childless|singles?\s+only|couples?\s+(only|without\s+kids))\b/gi,
    category: 'familial-status',
    why: 'Targets or excludes a household composition.',
  },
  {
    pattern: /\b(bachelor|mature)\s+(pad|couple|adults?)\b/gi,
    category: 'familial-status',
    why: 'Describes the intended occupant rather than the property.',
  },
  {
    // The lead-in verb varies a lot ("perfect for", "ideal for", "great for",
    // "made for"), so match the whole family rather than one phrasing.
    pattern:
      /\b(perfect|ideal|great|wonderful|made|built|tailored|suited?)\s+for\s+(young\s+|active\s+|busy\s+)?(professionals?|couples?|retirees?|students?|singles?|newlyweds?)\b/gi,
    category: 'familial-status',
    why: 'Describes who should live here. Describe the home instead.',
  },
  {
    pattern: /\badult\s+(living|community)\b/gi,
    category: 'familial-status',
    why: 'Age-restricted framing. Lawful 55+ housing has a narrow statutory exemption — confirm the community actually qualifies before using this.',
  },

  // --- Religion ------------------------------------------------------------
  // Proximity to a place of worship is a real amenity, but naming it in an ad
  // signals who the housing is "for". Say "walkable to shops and services".
  {
    pattern: /\b(christian|catholic|jewish|muslim|hindu|buddhist|mormon)\b/gi,
    category: 'religion',
    why: 'Names a religious group. Remove it — religion cannot appear in housing advertising.',
  },
  {
    pattern: /\b(church|synagogue|mosque|temple|parish)\b/gi,
    category: 'religion',
    why: 'Naming a place of worship implies a religious preference. Use a neutral phrase like "close to local amenities".',
  },
  {
    pattern: /\b(holiday|christmas|easter)\s+(spirit|charm)\b/gi,
    category: 'religion',
    why: 'Religious framing in a property description.',
  },

  // --- Race / national origin ---------------------------------------------
  {
    pattern: /\b(exclusive|restricted|private)\s+(community|neighborhood|enclave)\b/gi,
    category: 'race-or-national-origin',
    why: '"Exclusive"/"restricted" carries a history of racial exclusion in housing. Use "established" or describe the amenities.',
  },
  {
    pattern: /\b(integrated|diverse|ethnic|traditional)\s+(neighborhood|community)\b/gi,
    category: 'race-or-national-origin',
    why: 'Characterizing the demographics of a neighborhood is steering, even when framed positively.',
  },
  {
    pattern: /\b(english|spanish)[-\s]?speaking\s+(only|preferred|community)\b/gi,
    category: 'race-or-national-origin',
    why: 'Language preference operates as a national-origin proxy.',
  },

  // --- Disability ----------------------------------------------------------
  // Factual accessibility features are encouraged; statements about the
  // occupant's ability are not.
  {
    pattern: /\b(no\s+wheelchairs?|able[-\s]?bodied|not\s+(suitable|appropriate)\s+for\s+(the\s+)?(disabled|handicapped))\b/gi,
    category: 'disability',
    why: 'Excludes people with disabilities.',
  },
  {
    pattern: /\b(perfect|ideal|great)\s+for\s+(the\s+)?(disabled|handicapped|elderly|seniors?)\b/gi,
    category: 'disability',
    why: 'Describes the intended occupant. State the feature instead — "step-free entry", "first-floor primary bedroom".',
  },
  {
    pattern: /\bmust\s+be\s+(able\s+to|physically)\b/gi,
    category: 'disability',
    why: 'Imposes a physical-ability condition on occupancy.',
  },

  // --- Sex -----------------------------------------------------------------
  {
    pattern: /\b(male|female|men|women)\s+(only|preferred|tenants?)\b/gi,
    category: 'sex',
    why: 'States a preference based on sex.',
  },

  // --- Proxies -------------------------------------------------------------
  // These read as ordinary marketing but are among the most-cited proxy terms in
  // Fair Housing guidance, because "safe" and "good schools" have been used to
  // signal the racial composition of a neighborhood.
  {
    pattern: /\b(safe|secure|crime[-\s]?free|low[-\s]?crime)\s+(neighborhood|area|community|street)\b/gi,
    category: 'proxy',
    why: 'Safety claims about a neighborhood are a well-documented racial proxy — and they expose you to a misrepresentation claim. Drop it entirely.',
  },
  {
    pattern: /\b(good|great|excellent|top|desirable|best)\s+schools?\b/gi,
    category: 'proxy',
    why: 'School-quality claims act as a demographic proxy. State the district name as a neutral fact if it matters, and let buyers research ratings themselves.',
  },
  {
    pattern: /\b(desirable|nice|better)\s+(neighborhood|area|part\s+of\s+town)\b/gi,
    category: 'proxy',
    why: 'A value judgment about an area rather than a fact about the property.',
  },
];

export interface FairHousingResult {
  ok: boolean;
  findings: FairHousingFinding[];
}

/**
 * Screen a single piece of copy.
 *
 * Returns every finding rather than the first, so Steven can see the full set in
 * one pass instead of fixing one phrase and hitting the next on regenerate.
 */
export function screenFairHousing(text: string): FairHousingResult {
  if (!text) return { ok: true, findings: [] };

  const findings: FairHousingFinding[] = [];
  const seen = new Set<string>();

  for (const rule of RULES) {
    // Rules carry the /g flag and RegExp keeps lastIndex between calls, so reset
    // before each use — otherwise a rule that matched in an earlier field starts
    // mid-string on the next one and silently misses.
    rule.pattern.lastIndex = 0;

    for (const match of text.matchAll(rule.pattern)) {
      const matched = match[0].trim();
      // Same phrase twice in one ad is one problem to fix, not two.
      const key = `${rule.category}:${matched.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);

      findings.push({ matched, category: rule.category, why: rule.why });
    }
  }

  return { ok: findings.length === 0, findings };
}

/**
 * Screen every string field of a generated variant at once.
 * Field names are carried through so the UI can point at the offending input.
 */
export function screenFields(
  fields: Record<string, string | undefined>,
): Record<string, FairHousingFinding[]> {
  const byField: Record<string, FairHousingFinding[]> = {};
  for (const [name, value] of Object.entries(fields)) {
    if (!value) continue;
    const { findings } = screenFairHousing(value);
    if (findings.length) byField[name] = findings;
  }
  return byField;
}
