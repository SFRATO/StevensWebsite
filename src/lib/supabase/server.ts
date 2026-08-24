/**
 * Supabase client for the server-rendered /admin surface.
 *
 * Deliberate split, do not "unify" this with the rest of the codebase:
 *
 *   - The admin console (this file) uses the SDK with the *user's* JWT and is
 *     subject to RLS. The browser never talks to Supabase directly — all queries
 *     run server-side, so the JWT stays in httpOnly cookies and `connect-src
 *     'self'` in the site CSP needs no widening.
 *   - The public lead pipeline (netlify/functions/*, supabase/functions/*) uses
 *     raw PostgREST fetch with the service-role key. That code is live, carries
 *     real leads, and gains nothing from being rewritten.
 */
import { createServerClient } from '@supabase/ssr';
import type { APIContext } from 'astro';

/**
 * AstroCookies exposes get/has/set/delete but NOT getAll, while @supabase/ssr
 * v0.12 requires getAll/setAll. Read cookies straight off the request header;
 * write through AstroCookies so Astro emits the Set-Cookie headers on the
 * response.
 */
function readAll(request: Request): { name: string; value: string }[] {
  const header = request.headers.get('cookie');
  if (!header) return [];
  return header.split(';').flatMap((pair) => {
    const i = pair.indexOf('=');
    if (i < 0) return [];
    return [
      {
        name: pair.slice(0, i).trim(),
        value: decodeURIComponent(pair.slice(i + 1).trim()),
      },
    ];
  });
}

/**
 * Create the request-scoped client.
 *
 * Call this EXACTLY ONCE per request and stash it on `context.locals` — the
 * middleware does this. Two clients in one request means one of them refreshes
 * the session and the other discards the new tokens, which surfaces as random
 * logouts that are miserable to debug.
 */
export function createSupabaseServerClient(context: APIContext) {
  const url = import.meta.env.SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey =
    import.meta.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_ANON_KEY must be set for the /admin console.',
    );
  }

  return createServerClient(url, anonKey, {
    cookieOptions: {
      path: '/',
      httpOnly: true,
      sameSite: 'lax', // not 'strict': a bookmark into /admin/leads must stay signed in
      secure: import.meta.env.PROD,
    },
    cookies: {
      getAll: () => readAll(context.request),
      setAll: (cookies) => {
        for (const { name, value, options } of cookies) {
          context.cookies.set(name, value, options);
        }
      },
    },
  });
}
