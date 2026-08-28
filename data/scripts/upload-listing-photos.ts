/**
 * Upload listing photos to Supabase Storage and attach them to a listing.
 *
 *   npm run listing:photos -- <slug> "/path/to/photo/folder"
 *   npm run listing:photos -- <slug> "/path/to/folder" --order 38,7,2,16,27
 *
 * Photos go to Supabase Storage rather than into public/ deliberately. MLS photo
 * sets run ~7 MB per listing; committing them would add hundreds of megabytes to
 * the repo over a year, permanently, including photos of properties that sold
 * long ago. Storage is CDN-served, stays out of git, and is where the future
 * admin upload form will write too.
 *
 * Each image is capped at 1600px wide and encoded three ways — WebP, re-encoded
 * mozjpeg, and the untouched original — keeping whichever is smallest. That
 * belt-and-braces approach exists because MLS exports are ALREADY well-compressed
 * JPEGs: a naive WebP pass at q82 produced files LARGER than the source on this
 * set. Real-world saving lands around 25%, not the 60-70% you'd get from
 * unoptimised camera originals.
 *
 * ORDER MATTERS. Image 1 is the hero AND the social-share preview — it is what
 * appears when someone texts the link. Pass --order with source indices (as
 * printed by --list) to control it; otherwise files sort by name, which for MLS
 * downloads is meaningless.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import sharp from 'sharp';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'listing-photos';

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function fail(msg: string): never {
  console.error(`\n  ✗ ${msg}\n`);
  process.exit(1);
}

/** Accept extensionless files too — MLS downloads often lose the extension. */
function isImage(path: string): boolean {
  const ext = extname(path).toLowerCase();
  if (IMAGE_EXT.has(ext)) return true;
  if (ext) return false;
  try {
    const head = readFileSync(path).subarray(0, 4);
    return head[0] === 0xff && head[1] === 0xd8; // JPEG magic bytes
  } catch {
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const listOnly = args.includes('--list');
  const orderArg = args.find((a) => a.startsWith('--order'));
  const positional = args.filter((a) => !a.startsWith('--'));
  const [slug, dir] = positional;

  if (!slug || !dir) {
    fail('Usage: npm run listing:photos -- <slug> "/path/to/folder" [--list] [--order 3,0,7]');
  }
  if (!SUPABASE_URL || !SERVICE_KEY) fail('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');

  let files: string[];
  try {
    files = readdirSync(dir)
      .filter((f) => !f.startsWith('.'))
      .map((f) => join(dir, f))
      .filter((f) => statSync(f).isFile() && isImage(f))
      .sort();
  } catch (e) {
    fail(`Could not read ${dir}: ${(e as Error).message}`);
  }

  if (!files.length) fail(`No images found in ${dir}`);

  if (listOnly) {
    console.log(`\n  ${files.length} image(s) in source order:\n`);
    files.forEach((f, i) => console.log(`    ${String(i).padStart(2)}  ${basename(f)}`));
    console.log('\n  Reorder with --order, e.g. --order 38,7,2  (hero first).\n');
    return;
  }

  // Apply an explicit order, then append anything not named so no photo is lost
  // by an incomplete --order list.
  let ordered = files;
  if (orderArg) {
    const raw = orderArg.includes('=') ? orderArg.split('=')[1] : args[args.indexOf(orderArg) + 1];
    const idx = (raw ?? '')
      .split(',')
      .map((n) => Number(n.trim()))
      .filter((n) => Number.isInteger(n) && n >= 0 && n < files.length);
    const seen = new Set(idx);
    ordered = [...idx.map((i) => files[i]), ...files.filter((_, i) => !seen.has(i))];
  }

  console.log(`\n  Uploading ${ordered.length} photo(s) for "${slug}"...\n`);

  const urls: string[] = [];
  let before = 0;
  let after = 0;

  for (const [i, file] of ordered.entries()) {
    const n = String(i + 1).padStart(2, '0');

    const srcBuf = readFileSync(file);
    const srcBytes = srcBuf.length;

    const pipeline = () =>
      sharp(srcBuf).rotate().resize({ width: 1600, withoutEnlargement: true });

    // MLS exports are already well-compressed JPEGs, so WebP does NOT reliably
    // win — at q82 some files came out LARGER than the source. Encode both, keep
    // whichever is actually smaller, and never upload something bigger than what
    // we started with.
    const [webp, jpeg] = await Promise.all([
      pipeline().webp({ quality: 78 }).toBuffer(),
      pipeline().jpeg({ quality: 80, mozjpeg: true }).toBuffer(),
    ]);

    const candidates: Array<{ buf: Buffer; ext: string; mime: string }> = [
      { buf: webp, ext: 'webp', mime: 'image/webp' },
      { buf: jpeg, ext: 'jpg', mime: 'image/jpeg' },
      { buf: srcBuf, ext: 'jpg', mime: 'image/jpeg' }, // untouched original
    ];
    const best = candidates.reduce((a, b) => (b.buf.length < a.buf.length ? b : a));

    const objectKey = `${slug}/${n}.${best.ext}`;

    before += srcBytes;
    after += best.buf.length;

    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${objectKey}`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY!,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': best.mime,
        'x-upsert': 'true', // re-running replaces rather than erroring
        // Without this the object is stored with `no-cache`, so every visitor
        // re-downloads the full hero from origin on every page view — Lighthouse
        // flags it on the live site as "Use efficient cache lifetimes".
        //
        // Format matters: on the raw-body upload path supabase-js sends exactly
        // `max-age=<n>`. A `public, max-age=...` value is not what the API
        // expects. Verify with the object list endpoint — metadata.cacheControl
        // should read `max-age=86400`.
        //
        // One day rather than a year on purpose: re-running this script reuses
        // the same filenames (01.jpg, 02.webp ...), so a long TTL would serve a
        // stale photo after a re-order.
        //
        // NOTE: the /object/public/ origin currently still responds `no-cache`
        // regardless of this value — Supabase's Smart CDN is what consumes the
        // stored cacheControl. Setting it correctly here is the prerequisite;
        // whether the edge honours it depends on the project's plan/CDN config.
        'cache-control': 'max-age=86400',
      },
      body: best.buf as unknown as BodyInit,
    });

    if (!res.ok) fail(`Upload failed for ${basename(file)} (${res.status}): ${await res.text()}`);

    urls.push(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${objectKey}`);
    process.stdout.write(
      `    ${n}  ${basename(file).slice(0, 26).padEnd(28)} ` +
        `${(srcBytes / 1024).toFixed(0).padStart(4)}KB -> ${(best.buf.length / 1024).toFixed(0).padStart(4)}KB  ${best.ext}\n`,
    );
  }

  const patch = await fetch(`${SUPABASE_URL}/rest/v1/listings?slug=eq.${slug}`, {
    method: 'PATCH',
    headers: {
      apikey: SERVICE_KEY!,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ images: urls }),
  });

  if (!patch.ok) fail(`Could not attach photos to "${slug}" (${patch.status}): ${await patch.text()}`);
  const rows = (await patch.json()) as unknown[];
  if (!rows.length) fail(`No listing with slug "${slug}". Import or create it first.`);

  const pct = Math.round((1 - after / before) * 100);
  console.log(
    `\n  ✓ ${urls.length} photo(s) attached to "${slug}".` +
      `  ${(before / 1e6).toFixed(1)}MB -> ${(after / 1e6).toFixed(1)}MB (${pct}% smaller)`,
  );
  console.log(`    Hero (also the social-share preview): ${basename(ordered[0])}\n`);
}

main().catch((e) => fail(e.message));
