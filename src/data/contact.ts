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

export const PHONE = '(609) 789-0126';
export const PHONE_HREF = 'tel:+16097890126';

export const EMAIL = 'sf@stevenfrato.com';
export const EMAIL_HREF = 'mailto:sf@stevenfrato.com';

/** NJ licence disclosure. Required in advertising; do not drop. */
export const LICENSE_NUMBER = '2567370';
export const LICENSE_LINE = `${AGENT_NAME}, NJ Licensed Real Estate Salesperson, License #${LICENSE_NUMBER}.`;

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
