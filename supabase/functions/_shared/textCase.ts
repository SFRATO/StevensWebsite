/**
 * Display formatting for homeowner-facing text.
 *
 * People type their name and address into a phone in a hurry: "jOhN", "SMITH",
 * "123 MAIN STREET", "mount holly". None of that should appear in an email we
 * send them. These helpers produce a presentable version WITHOUT destroying the
 * original — callers keep the raw value for records and use these only for
 * display.
 *
 * DELIBERATELY CONSERVATIVE. Every rule here can damage a real name if it tries
 * too hard, so each one below exists because the naive version is wrong:
 *
 *   - Splitting on spaces alone breaks "o'connor" and "mary-jane".
 *   - Handling "Mac" like "Mc" turns "macey" into "MacEy" and "mack" into
 *     "MacK". Both are real surnames. So Mc is handled and Mac is not.
 *   - Lowercasing all-caps tokens turns "NJ" into "Nj" and "JFK" into "Jfk".
 *   - Touching tokens with digits breaks "1st", "08060-1234" and unit numbers.
 *   - Expanding abbreviations requires guessing whether "St" means Street or
 *     Saint, which is how you get "Saint Louis Avenue". Nothing is expanded.
 *
 * When in doubt these functions leave the input alone. A slightly odd-looking
 * name the homeowner actually typed is far better than a confidently mangled one.
 */

/**
 * Initialisms rendered upper in a STREET line. Directionals, states, PO.
 *
 * Notably absent, both deliberately:
 *   CT — in a New Jersey address "Ct" is Court far more often than Connecticut.
 *   DE — would wreck "de" inside a surname such as "de la Cruz".
 * Neither state is worth the collision on a funnel restricted to NJ property.
 */
const STREET_UPPER = new Set([
  "N", "S", "E", "W", "NE", "NW", "SE", "SW",
  "NJ", "NY", "PA", "US", "USA", "PO",
  "LLC", "LLP", "INC",
]);

/**
 * Initialisms rendered upper in a PERSON'S NAME — generational suffixes only.
 *
 * Names use a much smaller set than streets on purpose. Applying the street
 * list to a name turns "de la Cruz" into "DE La Cruz" and a middle name "Po"
 * into "PO". A name has no directionals, so it needs none of them.
 */
const NAME_UPPER = new Set(["II", "III", "IV"]);

/** Capitalise one atom: first letter up, rest down. */
function capAtom(atom: string): string {
  if (!atom) return atom;
  return atom[0].toUpperCase() + atom.slice(1).toLowerCase();
}

/**
 * Capitalise a single whitespace-delimited token, respecting internal
 * apostrophes and hyphens so "o'connor-smith" becomes "O'Connor-Smith".
 */
function capToken(token: string, upperSet: Set<string>): string {
  if (!token) return token;

  // Contains a digit: a house number, "1st", a ZIP, a unit. Leave it exactly.
  if (/\d/.test(token)) return token;

  // Genuine initialisms, forced upper REGARDLESS of how they were typed, so
  // "nw" becomes "NW" and "SE" stays "SE".
  //
  // This is an explicit list rather than a rule like "preserve short all-caps
  // tokens", which was the first attempt and was badly wrong: it protected
  // MACK, MAIN, CITY and BLVD from being fixed. Length cannot distinguish an
  // initialism from someone leaving caps lock on — ANN, BOB and LEE are all
  // three letters. Only a list can.
  //
  // Consequence accepted: an initialism NOT on this list gets title-cased
  // ("JFK Blvd" -> "Jfk Blvd"). Rare in residential addresses, and far less
  // damaging than leaving every caps-locked word untouched.
  if (upperSet.has(token.toUpperCase())) return token.toUpperCase();

  // Split on apostrophes and hyphens, keeping the separators.
  const parts = token.split(/([''\-])/);
  let out = parts
    .map((part, i) => {
      // Odd indices are the separators themselves.
      if (i % 2 === 1) return part;
      return capAtom(part);
    })
    .join("");

  // "mcdonald" -> "McDonald". Not applied to Mac: "macey"/"mack" are real names
  // that MacEy/MacK would ruin, and there is no safe way to tell them apart.
  out = out.replace(/^Mc([a-z])/, (_m, c: string) => `Mc${c.toUpperCase()}`);

  return out;
}

function titleCase(raw: string, upperSet: Set<string>): string {
  return String(raw ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((t) => capToken(t, upperSet))
    .join(" ");
}

/**
 * A person's name for display: "jOhN" -> "John", "o'connor" -> "O'Connor",
 * "mary-jane" -> "Mary-Jane". Returns '' for empty input so callers can fall
 * back to a greeting without a name rather than printing a placeholder.
 */
export function toDisplayName(raw: string): string {
  return titleCase(raw, NAME_UPPER);
}

/**
 * A street line for display: "123 MAIN st" -> "123 Main St".
 *
 * Abbreviations are tidied in case, never expanded — "St" stays "St". Numbers,
 * ordinals and directionals pass through capToken untouched or preserved.
 */
export function toDisplayStreet(raw: string): string {
  return titleCase(raw, STREET_UPPER);
}

/**
 * Compose the full property line: "123 Main Street, Mount Holly, NJ 08060".
 *
 * The ZIP is passed through as a STRING and never parsed — that is what keeps
 * the leading zero on an 08060. The state is hardcoded to NJ only because the
 * funnel validates the ZIP into the New Jersey range before this is reached, so
 * it is established by validation rather than assumed.
 */
export function formatPropertyAddress(
  street: string,
  city: string,
  zip: string,
  state = "NJ",
): string {
  const parts = [toDisplayStreet(street), toDisplayName(city)].filter(Boolean);
  const tail = [state, String(zip ?? "").trim()].filter(Boolean).join(" ");
  return [...parts, tail].filter(Boolean).join(", ");
}
