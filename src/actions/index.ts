/**
 * Astro Actions for the /admin SPW builder.
 *
 * SECURITY
 * --------
 * src/middleware.ts guards '/_actions' as well as '/admin', so an unauthenticated
 * POST here is already redirected. That is NOT relied on alone: every action
 * below calls requireAdmin() first, which re-checks the session and admin_users
 * membership server-side. Defence in depth, because the guard is one line in a
 * list and a future edit could drop it.
 *
 * The service-role key is used for exactly two things — Storage writes and the
 * listings upsert — and never leaves this module. The browser talks only to our
 * own origin, which keeps `connect-src 'self'` in the site CSP intact.
 */
import { defineAction, ActionError } from 'astro:actions';
import { z } from 'astro:schema';
import { screenFairHousing } from '../lib/ai/fairHousing';
import { validateAddress, deriveSlug, SLUG_RE } from '../lib/spw/address';
import { MLS_EXTRACT_SCHEMA } from '../lib/spw/schema';
import { buildRow, type BuilderPayload } from '../lib/spw/toListing';

const SUPABASE_URL = () => import.meta.env.SUPABASE_URL ?? process.env.SUPABASE_URL;
const SERVICE_KEY = () =>
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'listing-photos';

/** Re-verify the caller instead of trusting the middleware alone. */
async function requireAdmin(locals: App.Locals) {
  const supabase = locals.supabase;
  if (!supabase) throw new ActionError({ code: 'UNAUTHORIZED', message: 'No session.' });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ActionError({ code: 'UNAUTHORIZED', message: 'Not signed in.' });

  const { data: admin } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();
  if (!admin) throw new ActionError({ code: 'FORBIDDEN', message: 'Not an admin.' });

  return user;
}

function serviceHeaders() {
  const key = SERVICE_KEY();
  if (!SUPABASE_URL() || !key) {
    throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase is not configured.' });
  }
  return { apikey: key, Authorization: `Bearer ${key}` };
}

export const server = {
  signOut: defineAction({
    handler: async (_input, { locals }) => {
      await locals.supabase.auth.signOut();
      return { ok: true };
    },
  }),

  /** Read an MLS screenshot into structured fields. Never saves — the form reviews it. */
  extractMls: defineAction({
    input: z.object({
      imageBase64: z.string().min(100),
      mediaType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
    }),
    handler: async ({ imageBase64, mediaType }, { locals }) => {
      await requireAdmin(locals);
      const apiKey = import.meta.env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new ActionError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ANTHROPIC_API_KEY is not set. Enter the MLS details manually, or add the key in Netlify.',
        });
      }

      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey });

      const res = await client.messages.create({
        model: 'claude-opus-5',
        max_tokens: 4096,
        tools: [{
          name: 'record_listing',
          description: 'Record the consumer-facing details of this MLS listing.',
          input_schema: MLS_EXTRACT_SCHEMA as never,
        }],
        tool_choice: { type: 'tool', name: 'record_listing' },
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            {
              type: 'text',
              text:
                'Read this MLS listing sheet and record the CONSUMER-FACING details.\n\n' +
                'EXCLUDE, and never copy into any field: agent/private remarks, showing ' +
                'instructions, ShowingTime or appointment details, lockbox type or location, ' +
                'offer-submission instructions, agent or showing contact phone numbers and ' +
                'emails other than the listing agent\'s published one, owner names, and ' +
                'commission or compensation figures.\n\n' +
                'Copy figures exactly as printed. Do not infer or estimate anything that is ' +
                'not on the sheet — omit a field rather than guess it. publicRemarks should ' +
                'be the PUBLIC remarks only.',
            },
          ],
        }],
      });

      const block = res.content.find((c) => c.type === 'tool_use');
      if (!block || block.type !== 'tool_use') {
        throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Could not read that screenshot.' });
      }
      return block.input as Record<string, unknown>;
    },
  }),

  /** Rewrite the description as original copy from the structured facts. */
  rewriteDescription: defineAction({
    input: z.object({ facts: z.string().min(10) }),
    handler: async ({ facts }, { locals }) => {
      await requireAdmin(locals);
      const apiKey = import.meta.env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'ANTHROPIC_API_KEY is not set.' });

      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey });
      const res = await client.messages.create({
        model: 'claude-opus-5',
        max_tokens: 900,
        messages: [{
          role: 'user',
          content:
            'Write an original property description from these facts. Factual and concise, ' +
            '150-220 words, one paragraph, no bullet points. Describe the PROPERTY, never the ' +
            'kind of person who should live there — no "perfect for families", no occupant ' +
            'language of any kind. Do not use luxury, dream home, hidden gem, won\'t last, or ' +
            'walkable. Do not invent anything absent from the facts. Return only the paragraph.\n\n' +
            facts,
        }],
      });
      const text = res.content.find((c) => c.type === 'text');
      return { description: text && text.type === 'text' ? text.text.trim() : '' };
    },
  }),

  /**
   * Store one already-optimised image.
   *
   * The BROWSER does the resize and encode (src/lib/spw/optimise.ts), mirroring
   * upload-listing-photos.ts. sharp is a native module and netlify.toml bundles
   * functions with esbuild and no external_node_modules, so a server-side sharp
   * pass would not resolve at runtime.
   */
  uploadPhoto: defineAction({
    input: z.object({
      slug: z.string().regex(SLUG_RE),
      index: z.number().int().min(0).max(199),
      ext: z.enum(['webp', 'jpg']),
      dataBase64: z.string().min(10),
    }),
    handler: async ({ slug, index, ext, dataBase64 }, { locals }) => {
      await requireAdmin(locals);
      const n = String(index + 1).padStart(2, '0');
      const key = `${slug}/${n}.${ext}`;
      const bytes = Uint8Array.from(atob(dataBase64), (c) => c.charCodeAt(0));

      const res = await fetch(`${SUPABASE_URL()}/storage/v1/object/${BUCKET}/${key}`, {
        method: 'POST',
        headers: {
          ...serviceHeaders(),
          'Content-Type': ext === 'webp' ? 'image/webp' : 'image/jpeg',
          'x-upsert': 'true',
          // Exactly `max-age=<n>` — the storage API ignores a `public, max-age=`
          // value. See the note in data/scripts/upload-listing-photos.ts.
          'cache-control': 'max-age=86400',
        },
        body: bytes,
      });
      if (!res.ok) {
        throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: `Upload failed (${res.status}).` });
      }
      return { url: `${SUPABASE_URL()}/storage/v1/object/public/${BUCKET}/${key}` };
    },
  }),

  /** Validate, screen, and upsert. Mirrors data/scripts/add-listing.ts. */
  saveListing: defineAction({
    input: z.object({ payload: z.string() }),
    handler: async ({ payload }, { locals }) => {
      await requireAdmin(locals);
      const p = JSON.parse(payload) as BuilderPayload;

      const addr = validateAddress({
        street: p.street ?? '', town: p.town ?? '', zipcode: p.zipcode ?? '',
      });
      if (!addr.ok) {
        throw new ActionError({ code: 'BAD_REQUEST', message: Object.values(addr.errors).join(' ') });
      }

      const row = buildRow(p);
      if (!SLUG_RE.test(row.slug)) {
        throw new ActionError({ code: 'BAD_REQUEST', message: `Invalid URL slug "${row.slug}".` });
      }

      // Same screen add-listing.ts applies. Blocked copy is never written.
      for (const [field, text] of [
        ['description', row.description ?? ''],
        ...row.highlights.map((h, i) => [`highlight ${i + 1}`, h] as [string, string]),
      ] as Array<[string, string]>) {
        if (!text) continue;
        const found = screenFairHousing(text);
        if (found.findings.length) {
          throw new ActionError({
            code: 'BAD_REQUEST',
            message: `Fair Housing: "${found.findings[0].matched}" in ${field}. ${found.findings[0].why}`,
          });
        }
      }

      // Publishing another broker's listing requires the broker and agent be
      // named — NJ advertising rules, and the DB enforces it too
      // (listings_borrowed_attribution_chk / listings_borrowed_agent_chk).
      if (row.status === 'published' && !row.is_own_listing) {
        if (!row.listing_brokerage) {
          throw new ActionError({ code: 'BAD_REQUEST', message: 'Listing brokerage is required to publish another broker’s listing.' });
        }
        if (!row.list_agent_name) {
          throw new ActionError({ code: 'BAD_REQUEST', message: 'Listing agent is required to publish another broker’s listing.' });
        }
      }

      const res = await fetch(`${SUPABASE_URL()}/rest/v1/listings?on_conflict=slug`, {
        method: 'POST',
        headers: {
          ...serviceHeaders(),
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify([row]),
      });
      if (!res.ok) {
        const body = await res.text();
        if (body.includes('listings_borrowed_attribution_chk')) {
          throw new ActionError({ code: 'BAD_REQUEST', message: 'A borrowed listing needs a brokerage and confirmed permission to publish.' });
        }
        if (body.includes('listings_borrowed_agent_chk')) {
          throw new ActionError({ code: 'BAD_REQUEST', message: 'A borrowed listing needs the listing agent named to publish.' });
        }
        throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: `Save failed (${res.status}).` });
      }
      const [saved] = (await res.json()) as Array<{ slug: string; status: string }>;
      return { slug: saved.slug, status: saved.status };
    },
  }),

  /** Active <-> Inactive. */
  setStatus: defineAction({
    accept: 'form',
    input: z.object({ slug: z.string().regex(SLUG_RE), status: z.enum(['published', 'draft']) }),
    handler: async ({ slug, status }, { locals }) => {
      await requireAdmin(locals);
      const res = await fetch(`${SUPABASE_URL()}/rest/v1/listings?slug=eq.${slug}`, {
        method: 'PATCH',
        headers: { ...serviceHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Status change failed.' });
      return { ok: true };
    },
  }),

  /**
   * Deploy. The site is statically built, so a listing row is not a live page
   * until Netlify rebuilds — roughly two minutes.
   */
  publish: defineAction({
    handler: async (_input, { locals }) => {
      await requireAdmin(locals);
      const hook = import.meta.env.NETLIFY_BUILD_HOOK ?? process.env.NETLIFY_BUILD_HOOK;
      if (!hook) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'NETLIFY_BUILD_HOOK is not set.' });
      const res = await fetch(hook, { method: 'POST' });
      if (!res.ok) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: `Build trigger failed (${res.status}).` });
      return { ok: true };
    },
  }),
};
