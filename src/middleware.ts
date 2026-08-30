import { defineMiddleware } from 'astro:middleware';

/**
 * Guard for the admin console.
 *
 * ⚠️ READ BEFORE EDITING ⚠️
 * Astro imports and executes this module during the *static* build, once per
 * prerendered page (astro/dist/core/build/generate.js). All 357 marketing pages
 * pass through here at build time, where there is no real Request, no cookies,
 * and secrets may be absent. Anything that throws, hits the network, or reads a
 * missing env var at module scope breaks the entire site build — not just /admin.
 *
 * Hence two rules, both load-bearing:
 *   1. The pathname guard is the FIRST thing that runs.
 *   2. The Supabase import is dynamic and lives INSIDE the guarded branch, so
 *      the SDK is never even loaded during the prerender pass.
 */

/**
 * `/_actions` is where Astro Actions are served and it is NOT under `/admin`.
 * Leaving it out of this list would leave every CRM mutation unauthenticated.
 */
const GUARDED = ['/admin', '/_actions'];
const LOGIN = '/admin/login';

const isGuarded = (pathname: string) =>
  GUARDED.some((base) => pathname === base || pathname.startsWith(base + '/'));

export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname.replace(/\/+$/, '') || '/';

  // Fast exit for every public page. Keep this first — see the note above.
  if (!isGuarded(path)) return next();

  const { createSupabaseServerClient } = await import('./lib/supabase/server');

  /**
   * A missing env var must not become a bare 500.
   *
   * createSupabaseServerClient throws when SUPABASE_URL / SUPABASE_ANON_KEY are
   * absent. Unhandled, that surfaces as a zero-byte 500 with no Content-Type,
   * which browsers save to disk as an empty file instead of showing anything —
   * an unreadable symptom for a one-line configuration problem. Catch it and say
   * what is wrong.
   */
  let supabase;
  try {
    supabase = createSupabaseServerClient(context);
  } catch (err) {
    console.error('[admin] Supabase client could not be created:', err);
    return new Response(
      `<!doctype html><meta charset="utf-8"><title>Admin unavailable</title>
       <div style="font:15px/1.6 system-ui;max-width:34rem;margin:12vh auto;padding:0 1.5rem">
         <h1 style="font-size:19px">Admin console is not configured</h1>
         <p>The server is missing <code>SUPABASE_URL</code> or <code>SUPABASE_ANON_KEY</code>.
            Add them under <strong>Site configuration &rsaquo; Environment variables</strong>
            in Netlify, then redeploy.</p>
         <p style="color:#5D6B80;font-size:13px">The public site is unaffected.</p>
       </div>`,
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
    );
  }
  context.locals.supabase = supabase;

  // getUser(), never getSession(): getSession trusts the cookie payload without
  // revalidating the JWT against the auth server.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (path === LOGIN) {
    return user ? context.redirect('/admin/', 302) : next();
  }

  if (!user) {
    const target = encodeURIComponent(context.url.pathname + context.url.search);
    return context.redirect(`${LOGIN}?next=${target}`, 302);
  }

  // Being authenticated is not the same as being an admin. `authenticated` is a
  // role anyone with a Supabase account holds; membership in admin_users is the
  // actual authorization, and it can be revoked instantly.
  const { data: admin } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (!admin) {
    await supabase.auth.signOut();
    return context.redirect(`${LOGIN}?e=forbidden`, 302);
  }

  context.locals.user = user;

  const response = await next();
  // Set these on the response itself. Netlify [[headers]] blocks are not reliably
  // applied to SSR function responses, and a CDN-cached authenticated page would
  // be a serious leak.
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  return response;
});
