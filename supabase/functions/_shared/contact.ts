/**
 * Identity and contact details for the Supabase edge functions (Deno).
 *
 * Mirror of src/data/contact.ts. The duplication is deliberate: edge functions
 * run on a separate runtime and cannot import from the Astro source tree — the
 * same reason _shared/tokens.ts exists twice. Keep the two in sync.
 *
 * There is deliberately NO office address and NO brokerage here.
 */

export const AGENT_NAME = "Steven Frato";

export const PHONE = "(609) 789-0126";
export const EMAIL = "sf@stevenfrato.com";

/* ---------------------------------------------------------------------------
   Brokerage — N.J.A.C. 11:5-6.1
   ---------------------------------------------------------------------------
   Steven is a salesperson licensed through Real Broker, LLC. The site carried
   NO brokerage at all until Aug 2026, which the rule does not permit: (b)
   requires every advertisement by a salesperson to include both the name they
   are licensed under AND the broker's registered business name, across "all
   electronic media including E-mail and the Internet".

   (b)1 also requires the BROKER'S name to appear in larger print or more
   prominently than the salesperson's. That is enforced visually by
   BrandLockup.astro, and in prose by putting the brokerage first in
   LICENSE_LINE. If you restyle the lockup, keep the brokerage measurably
   larger — it is a licensing requirement, not a design preference.

   (c) requires the business name be followed by an indication that it is a
   brokerage; "realty" and "real estate" alone are expressly prohibited, which
   is why BROKERAGE_DESCRIPTOR reads "Licensed Real Estate Broker".

   (b)3 is satisfied by linking to BROKERAGE_URL at the page's predominant text
   size — chosen over publishing a main-office phone number. If that link is
   ever removed, the office telephone number becomes mandatory instead.

   (d) requires each phone number in an advertisement to be identified, hence
   PHONE_LABEL.
   -------------------------------------------------------------------------- */
export const BROKERAGE_NAME = 'Real Broker, LLC';
export const BROKERAGE_DESCRIPTOR = 'Licensed Real Estate Broker';
export const BROKERAGE_URL = 'https://www.onereal.com/';

/** Salesperson, per (e). Never "agent" — the rule names the permitted terms. */
export const LICENSE_TYPE = 'Salesperson';

/** Identifies the number below, per (d). */
export const PHONE_LABEL = 'Cell';

export const LICENSE_NUMBER = "2567370";
export const LICENSE_LINE =
  `${AGENT_NAME}, NJ Licensed Real Estate Salesperson, License #${LICENSE_NUMBER}.`;

/**
 * Postal address for email footers.
 *
 * TODO: CAN-SPAM (15 U.S.C. §7704(a)(5)) requires a valid physical postal
 * address in every commercial email. Empty until Steven supplies one; the
 * footer line is omitted entirely rather than rendered blank.
 */
export const MAILING_ADDRESS = "";

export const SERVICE_AREA = "Burlington, Mercer & Middlesex Counties, NJ";

/**
 * The shared email footer line. Returns the licence disclosure, plus the
 * postal address only once MAILING_ADDRESS is set.
 */
export function emailFooterLines(): string[] {
  const lines = [`${AGENT_NAME} · ${PHONE}`];
  if (MAILING_ADDRESS) lines.push(MAILING_ADDRESS);
  lines.push(LICENSE_LINE);
  return lines;
}
