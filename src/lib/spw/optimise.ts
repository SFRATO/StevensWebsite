/**
 * Browser-side image optimisation, mirroring data/scripts/upload-listing-photos.ts.
 *
 * WHY THE BROWSER AND NOT THE SERVER
 * ----------------------------------
 * The CLI uses sharp. sharp is a native module, and netlify.toml bundles
 * functions with esbuild and no `external_node_modules`, so the .node binding
 * would not resolve at runtime. Rather than add a native binary to the function
 * bundle for this one job, Canvas does the same work before upload — which also
 * means a 500KB MLS photo never crosses the wire at full size.
 *
 * Same rules as the CLI: cap at 1600px wide, never enlarge, encode BOTH WebP and
 * JPEG and keep whichever is smaller. That last part matters — MLS exports are
 * already well compressed, and a naive WebP pass can produce a LARGER file than
 * the source.
 */
const MAX_W = 1600;
const WEBP_Q = 0.78;
const JPEG_Q = 0.8;

export interface Optimised {
  blob: Blob;
  ext: 'webp' | 'jpg';
  bytes: number;
  originalBytes: number;
  previewUrl: string;
}

const toBlob = (canvas: HTMLCanvasElement, type: string, q: number): Promise<Blob | null> =>
  new Promise((resolve) => canvas.toBlob(resolve, type, q));

export async function optimiseImage(file: File): Promise<Optimised> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_W / bitmap.width); // withoutEnlargement
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable in this browser.');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const [webp, jpeg] = await Promise.all([
    toBlob(canvas, 'image/webp', WEBP_Q),
    toBlob(canvas, 'image/jpeg', JPEG_Q),
  ]);

  // Include the untouched original as a candidate, exactly as the CLI does.
  const candidates: Array<{ blob: Blob; ext: 'webp' | 'jpg' }> = [];
  if (webp) candidates.push({ blob: webp, ext: 'webp' });
  if (jpeg) candidates.push({ blob: jpeg, ext: 'jpg' });
  if (scale === 1) {
    candidates.push({ blob: file, ext: file.type === 'image/webp' ? 'webp' : 'jpg' });
  }
  if (!candidates.length) throw new Error('Could not encode that image.');

  const best = candidates.reduce((a, b) => (b.blob.size < a.blob.size ? b : a));
  return {
    blob: best.blob,
    ext: best.ext,
    bytes: best.blob.size,
    originalBytes: file.size,
    previewUrl: URL.createObjectURL(best.blob),
  };
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
