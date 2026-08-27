/**
 * Submit-time email verification for /api/market-report.
 *
 * Layered, cheapest first: syntax -> typo -> disposable -> MX.
 *
 * THE GUIDING RULE IS FAIL-OPEN. A DNS timeout, a SERVFAIL, an unexpected throw
 * — all of these PASS. Only positive evidence that an address is bad produces
 * ok:false. This runs in front of the highest-intent action on the site; a false
 * reject costs a real seller, while a false accept costs one junk database row.
 *
 * KNOWN AND ACCEPTED LIMITATION: this cannot tell whether a MAILBOX exists, only
 * whether the DOMAIN can receive mail. `skdjfhwef@gmail.com` passes every check
 * here, because gmail.com is obviously a real mail domain. Catching that needs
 * an SMTP-level probe, which in practice means a paid API — see getProvider().
 * What this DOES catch is honest typos, which is where real leads are actually
 * lost: someone who types "gmial.com" wanted to reach you and currently just
 * vanishes.
 */
import { Resolver } from 'node:dns/promises';
import { isDisposableDomain } from './disposableDomains';
import { suggestDomain } from './emailDomains';

export type EmailCheckCode =
  | 'ok'
  | 'empty'
  | 'syntax'
  | 'too_long'
  | 'typo' // soft — carries `suggestion`, overridable
  | 'disposable' // hard
  | 'no_mx' // hard — NXDOMAIN, or NODATA with no A record
  | 'no_mx_has_a'; // hard by default, EMAIL_CHECK_STRICT_MX controls it

export interface EmailCheckResult {
  ok: boolean;
  /** Trimmed + lowercased. Use THIS downstream, never the raw input. */
  normalized: string;
  code: EmailCheckCode;
  /** Human copy, safe to render to the visitor verbatim. */
  message: string;
  /** Full corrected address, e.g. "steve@gmail.com". Present for `typo` only. */
  suggestion?: string;
  /** True when a deliberate re-submit of the same address should be honoured. */
  canOverride: boolean;
  /** Structured and PII-free — log this, never the address. */
  trace: {
    domain: string;
    mx: 'hit' | 'miss' | 'cached' | 'skipped' | 'unavailable';
    ms: number;
    /** True when the verdict was computed but suppressed by log mode. */
    shadowed?: boolean;
  };
}

export interface EmailCheckOptions {
  /** Visitor re-submitted the same address after a soft rejection. */
  allowOverride?: boolean;
  /** Skip the DNS layer. Used for popup step 2, verified seconds earlier. */
  syntaxOnly?: boolean;
}

/**
 * 'enforce' rejects on every verdict. 'log' computes and logs every verdict but
 * only rejects the structural ones (see ALWAYS_ENFORCED) — so the heuristic
 * layers can be measured for a few days before they are allowed to turn anyone
 * away. That is the cheap insurance against a false reject on the highest-intent
 * form on the site.
 */
const MODE = (process.env.EMAIL_CHECK_MODE ?? 'enforce').toLowerCase();

/**
 * A domain with an A record but no MX can still legally receive mail (RFC 5321
 * §5.1 implicit MX). Essentially every real mail domain publishes MX in 2026, so
 * the default is strict — but this is a separate code precisely so its frequency
 * can be watched, and flipped off if it turns out to be hitting real
 * small-business vanity domains.
 */
const STRICT_MX = (process.env.EMAIL_CHECK_STRICT_MX ?? 'true').toLowerCase() !== 'false';

const PHONE_FALLBACK = ' You can also call (609) 496-3330 directly.';

/**
 * Pragmatic, not RFC 5322-complete. A full parser accepts quoted local parts and
 * bracketed IP domains that SES will reject anyway, so being stricter than the
 * RFC is correct here.
 */
const SYNTAX_RE =
  /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/;

// --- DNS -------------------------------------------------------------------

type MxVerdict = 'has_mx' | 'nxdomain' | 'no_mx_no_a' | 'no_mx_has_a' | 'unavailable';

interface CacheEntry {
  v: MxVerdict;
  exp: number;
}

const MX_CACHE = new Map<string, CacheEntry>();
const INFLIGHT = new Map<string, Promise<MxVerdict>>();

const POSITIVE_TTL_MS = 6 * 60 * 60 * 1000; // 6h
/** Short on purpose: a newly-configured domain recovers fast, and a transient
 *  NXDOMAIN cannot poison a real domain for hours. */
const NEGATIVE_TTL_MS = 15 * 60 * 1000;
const CACHE_MAX = 2000;

/**
 * The domains that account for most submissions never need a lookup at all, so
 * the median request pays zero DNS cost. Netlify containers stay warm, so this
 * survives across invocations.
 */
for (const d of [
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
  'icloud.com', 'me.com', 'comcast.net', 'verizon.net', 'optonline.net',
  'msn.com', 'live.com', 'att.net', 'sbcglobal.net', 'ymail.com',
  'mac.com', 'protonmail.com', 'proton.me', 'cox.net', 'charter.net',
]) {
  MX_CACHE.set(d, { v: 'has_mx', exp: Number.MAX_SAFE_INTEGER });
}

function cacheSet(domain: string, v: MxVerdict): void {
  if (MX_CACHE.size >= CACHE_MAX) {
    for (const k of MX_CACHE.keys()) {
      MX_CACHE.delete(k);
      break; // FIFO — an unbounded domain cache is otherwise attacker-controlled
    }
  }
  MX_CACHE.set(domain, {
    v,
    exp: Date.now() + (v === 'has_mx' ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS),
  });
}

async function lookupMx(domain: string): Promise<MxVerdict> {
  // c-ares' `timeout` is PER TRY, which does not bound the whole call under
  // every failure mode — hence the race below as well.
  const resolver = new Resolver({ timeout: 2000, tries: 1 });

  try {
    const mx = await resolver.resolveMx(domain);
    if (mx.some((r) => r.exchange && r.exchange.trim() !== '')) return 'has_mx';
    // Empty or null-MX (RFC 7505 ".") — the domain explicitly accepts no mail.
    return 'no_mx_no_a';
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code ?? '';

    if (code === 'ENOTFOUND' || code === 'ENODATA') {
      // ENOTFOUND here means NXDOMAIN. ENODATA means the domain exists but
      // publishes no MX — check for an A record before condemning it.
      if (code === 'ENOTFOUND') return 'nxdomain';
      try {
        const a = await resolver.resolve4(domain);
        return a.length ? 'no_mx_has_a' : 'no_mx_no_a';
      } catch {
        try {
          const aaaa = await resolver.resolve6(domain);
          return aaaa.length ? 'no_mx_has_a' : 'no_mx_no_a';
        } catch {
          return 'no_mx_no_a';
        }
      }
    }

    // ETIMEOUT, ESERVFAIL, EREFUSED, ECONNREFUSED, EAI_AGAIN, anything unknown:
    // this is OUR problem, not the visitor's. Fail open.
    return 'unavailable';
  }
}

async function mxVerdict(domain: string): Promise<{ v: MxVerdict; cached: boolean }> {
  const hit = MX_CACHE.get(domain);
  if (hit && hit.exp > Date.now()) return { v: hit.v, cached: true };

  // Coalesce: concurrent submissions for the same domain share one lookup.
  let p = INFLIGHT.get(domain);
  if (!p) {
    p = (async () => {
      const v = await Promise.race([
        lookupMx(domain),
        new Promise<MxVerdict>((r) => setTimeout(() => r('unavailable'), 2500)),
      ]);
      if (v !== 'unavailable') cacheSet(domain, v);
      return v;
    })().finally(() => INFLIGHT.delete(domain));
    INFLIGHT.set(domain, p);
  }
  return { v: await p, cached: false };
}

// --- paid provider seam ----------------------------------------------------

/**
 * Mailbox-level verification hook, intentionally unimplemented.
 *
 * Everything above verifies the DOMAIN. Verifying the MAILBOX (which is what
 * catches a made-up address at a real provider) needs an SMTP probe, and the
 * runtimes we deploy to cannot open port 25 — so it means a paid API.
 *
 * Wiring one up later is one new file plus an env var, with no change to
 * checkEmail's contract: add the call as a final layer after MX passes, treat
 * "catch_all"/"unknown"/"role" as PASS (they carry no information about this
 * specific address, and rejecting them would turn away legitimate
 * small-business sellers), and fail open on any provider error or timeout.
 */
export function getProvider(): null {
  return null;
}

// --- main ------------------------------------------------------------------

/**
 * Codes that are enforced even in log mode.
 *
 * These are structural, not heuristic — there is no such thing as a valid
 * address with no "@". Letting them through is not "being lenient", it actively
 * breaks the pipeline: an unparseable address becomes the Reply-To on the agent
 * notification, SES rejects the whole send, and Steven is never told about a
 * lead that did get saved. Observed in testing, not theorised:
 *   email "notanemail" -> agent_notify_error "Missing final '@domain'"
 *
 * Log mode exists to measure the HEURISTIC layers (typo, disposable, MX) before
 * they can turn away a real person. It was never meant to wave through garbage.
 */
const ALWAYS_ENFORCED: ReadonlySet<EmailCheckCode> = new Set(['empty', 'syntax', 'too_long']);

function fail(
  normalized: string,
  code: EmailCheckCode,
  message: string,
  trace: EmailCheckResult['trace'],
  extra: { suggestion?: string; canOverride?: boolean } = {},
): EmailCheckResult {
  const enforcing = MODE === 'enforce' || ALWAYS_ENFORCED.has(code);
  return {
    // In log mode the verdict is computed and returned for logging, but ok stays
    // true so nobody is ever turned away by a rule we have not measured yet.
    ok: !enforcing,
    normalized,
    code,
    message,
    suggestion: extra.suggestion,
    canOverride: extra.canOverride ?? false,
    trace: enforcing ? trace : { ...trace, shadowed: true },
  };
}

export async function checkEmail(
  raw: string,
  opts: EmailCheckOptions = {},
): Promise<EmailCheckResult> {
  const started = Date.now();
  const ms = () => Date.now() - started;

  // Normalize. Lowercasing the local part technically deviates from RFC 5321
  // §2.4, but every real provider is case-insensitive and the pipeline already
  // assumes it (handle-form-submission dedupes with .ilike and inserts
  // .toLowerCase()). Doing it here makes that consistent rather than accidental.
  //
  // Deliberately NOT stripping Gmail dots or +tags: plus-addressing is
  // legitimate, and collapsing it would merge distinct people into one lead.
  const normalized = raw.trim().replace(/^<|>$/g, '').trim().toLowerCase();
  const domain = normalized.slice(normalized.lastIndexOf('@') + 1);
  const base = { domain, mx: 'skipped' as const, ms: 0 };

  if (!normalized) {
    return fail('', 'empty', 'Please enter your email address.', { ...base, ms: ms() });
  }
  if (normalized.length > 254 || normalized.slice(0, normalized.indexOf('@')).length > 64) {
    return fail(normalized, 'too_long', 'That email address is too long.' + PHONE_FALLBACK, {
      ...base,
      ms: ms(),
    });
  }
  if (!SYNTAX_RE.test(normalized) || normalized.includes('..')) {
    return fail(
      normalized,
      'syntax',
      "That doesn't look like a valid email address." + PHONE_FALLBACK,
      { ...base, ms: ms() },
    );
  }

  // Typo BEFORE dns, so "gmial.com" produces an actionable correction rather
  // than a dead-end "we couldn't find a mail server".
  //
  // Skipped when the visitor has already answered this question. `allowOverride`
  // means they clicked "no, use it as typed" (or re-submitted unchanged), and
  // `syntaxOnly` means step 1 already cleared the address seconds ago. Re-asking
  // in either case makes the form unpassable — the whole point of an overridable
  // soft check is that it can be overridden exactly once.
  const suggestedDomain =
    opts.allowOverride || opts.syntaxOnly ? null : suggestDomain(domain);
  if (suggestedDomain) {
    const suggestion = normalized.slice(0, normalized.lastIndexOf('@') + 1) + suggestedDomain;
    return fail(
      normalized,
      'typo',
      `Did you mean ${suggestion}?`,
      { ...base, ms: ms() },
      { suggestion, canOverride: true },
    );
  }

  if (isDisposableDomain(domain)) {
    return fail(
      normalized,
      'disposable',
      'Please use a permanent email address so we can send you the details.' + PHONE_FALLBACK,
      { ...base, ms: ms() },
    );
  }

  if (opts.syntaxOnly) {
    return { ok: true, normalized, code: 'ok', message: '', canOverride: false, trace: { ...base, ms: ms() } };
  }

  // An overridable rejection that the visitor deliberately re-submitted. Only
  // `typo` sets canOverride, so this can never wave through a dead domain.
  if (opts.allowOverride) {
    const { v, cached } = await mxVerdict(domain);
    if (v === 'nxdomain') {
      return fail(
        normalized,
        'no_mx',
        "We couldn't find a mail server for that domain — please check the spelling." +
          PHONE_FALLBACK,
        { domain, mx: cached ? 'cached' : 'miss', ms: ms() },
      );
    }
    return { ok: true, normalized, code: 'ok', message: '', canOverride: false, trace: { domain, mx: cached ? 'cached' : 'hit', ms: ms() } };
  }

  const { v, cached } = await mxVerdict(domain);
  const mxTrace = cached ? ('cached' as const) : v === 'unavailable' ? ('unavailable' as const) : ('hit' as const);

  if (v === 'nxdomain' || v === 'no_mx_no_a') {
    return fail(
      normalized,
      'no_mx',
      "We couldn't find a mail server for that domain — please check the spelling." +
        PHONE_FALLBACK,
      { domain, mx: 'miss', ms: ms() },
    );
  }

  if (v === 'no_mx_has_a' && STRICT_MX) {
    return fail(
      normalized,
      'no_mx_has_a',
      "That domain doesn't appear to accept email — please check the spelling." + PHONE_FALLBACK,
      { domain, mx: 'miss', ms: ms() },
    );
  }

  return {
    ok: true,
    normalized,
    code: 'ok',
    message: '',
    canOverride: false,
    trace: { domain, mx: mxTrace, ms: ms() },
  };
}
