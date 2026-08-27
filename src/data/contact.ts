/**
 * Identity and contact details — single source of truth for the site build,
 * the React Email templates, and the Netlify functions.
 *
 * The same constants are duplicated in supabase/functions/_shared/contact.ts
 * because the edge functions run on Deno and cannot import from src/. Keep the
 * two files in sync — same rationale as _shared/tokens.ts.
 *
 * There is deliberately NO office address and NO brokerage here. Steven works
 * as a service-area agent: the site names the counties served, never a street.
 */

export const AGENT_NAME = 'Steven Frato';

export const PHONE = '(609) 496-3330';
export const PHONE_HREF = 'tel:+16094963330';

export const EMAIL = 'sf@stevenfrato.com';
export const EMAIL_HREF = 'mailto:sf@stevenfrato.com';

/** NJ licence disclosure. Required in advertising; do not drop. */
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

export const LICENSE_NUMBER = '2567370';
export const LICENSE_LINE =
  `${BROKERAGE_NAME} — ${BROKERAGE_DESCRIPTOR}. ` +
  `${AGENT_NAME}, ${LICENSE_TYPE}, NJ License #${LICENSE_NUMBER}.`;

/**
 * Postal address for EMAIL FOOTERS ONLY — never rendered on the website.
 *
 * TODO: CAN-SPAM (15 U.S.C. §7704(a)(5)) requires a valid physical postal
 * address in every commercial email. Until this is set, the drip campaign
 * ships without one. Fill in a street address or PO box and the line appears
 * automatically everywhere; nothing else needs editing.
 */
export const MAILING_ADDRESS = '';

/** Geographic identity used in place of a street address. */
export const SERVICE_AREA = 'Burlington, Mercer & Middlesex Counties, NJ';
export const LOCALITY = 'Bordentown';
export const REGION = 'NJ';
export const POSTAL_CODE = '08505';
