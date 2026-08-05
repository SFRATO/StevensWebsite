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
