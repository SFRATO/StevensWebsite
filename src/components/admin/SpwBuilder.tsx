/**
 * SPW builder form.
 *
 * Everything this collects lands in the SAME `listings` row shape the eight
 * hand-built properties use, so a generated SPW inherits the existing template,
 * gate, gallery, branding, emails and analytics with no extra wiring. This file
 * renders no property markup of its own.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { actions } from 'astro:actions';
import { validateAddress, deriveSlug } from '../../lib/spw/address';
import { optimiseImage, blobToBase64, type Optimised } from '../../lib/spw/optimise';
import type { MlsExtract } from '../../lib/spw/schema';

type Town = { town: string; zipcode: string; county: string };
type Photo = Optimised & { id: string; url?: string; uploading?: boolean; name: string };

interface Props {
  existing: Record<string, any> | null;
  towns: Town[];
  takenSlugs: string[];
}

const kb = (n: number) => `${Math.round(n / 1024)}KB`;

/** The public origin. Canonical URLs on the SPW template use www, so match it. */
const SITE = 'https://www.stevenfrato.com';

export default function SpwBuilder({ existing, towns, takenSlugs }: Props) {
  const editing = Boolean(existing);
  const [f, setF] = useState<MlsExtract & Record<string, any>>(() => fromExisting(existing));
  const [slugEdited, setSlugEdited] = useState(Boolean(existing));
  const [slug, setSlug] = useState(existing?.slug ?? '');
  const [photos, setPhotos] = useState<Photo[]>(() => existingPhotos(existing));
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string; url?: string } | null>(null);
  const [townQuery, setTownQuery] = useState(existing?.town ?? '');
  // Tracked separately from the text: typing and picking both write the same
  // value to town, so comparing the two can never tell them apart.
  const [townPicked, setTownPicked] = useState(Boolean(existing?.town));
  // Only surface a field error once there is something to be wrong about.
  // Showing "Enter a 5-digit ZIP code" in red on an untouched empty form is
  // noise, not guidance.
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const touch = (k: string) => setTouched((t) => ({ ...t, [k]: true }));
  const errOf = (k: 'street' | 'town' | 'zipcode') =>
    touched[k] && addr.errors[k] ? addr.errors[k] : null;
  const dragFrom = useRef<number | null>(null);

  const set = (k: string, v: unknown) => setF((s) => ({ ...s, [k]: v }));

  // Slug follows the address until it is edited by hand, then it stops moving.
  useEffect(() => {
    if (slugEdited) return;
    setSlug(f.street && f.town ? deriveSlug(f.street, f.town) : '');
  }, [f.street, f.town, slugEdited]);

  const addr = validateAddress({ street: f.street ?? '', town: f.town ?? '', zipcode: f.zipcode ?? '' });
  const slugTaken = slug !== '' && slug !== existing?.slug && takenSlugs.includes(slug);
  const canGenerate = addr.ok && slug !== '' && !slugTaken && photos.some((p) => p.url) && !busy;

  const townMatches = useMemo(() => {
    const q = townQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return towns.filter((t) => t.town.toLowerCase().startsWith(q)).slice(0, 8);
  }, [townQuery, towns]);

  // ---- photos -------------------------------------------------------------
  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    if (!slug) { setMsg({ kind: 'err', text: 'Enter the address first — photos are stored under the URL slug.' }); return; }
    setBusy('Optimising photos…');
    const next: Photo[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      try {
        const o = await optimiseImage(file);
        next.push({ ...o, id: crypto.randomUUID(), name: file.name });
      } catch { /* skip an image the browser cannot decode */ }
    }
    setPhotos((p) => [...p, ...next]);
    setBusy(null);
    // Upload after state settles so indexes match the final order.
    void uploadPending([...photos, ...next]);
  }

  async function uploadPending(list: Photo[]) {
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (p.url) continue;
      setBusy(`Uploading ${i + 1} of ${list.length}…`);
      try {
        const b64 = await blobToBase64(p.blob);
        const { data, error } = await actions.uploadPhoto({ slug, index: i, ext: p.ext, dataBase64: b64 });
        if (error) throw new Error(error.message);
        setPhotos((cur) => cur.map((x) => (x.id === p.id ? { ...x, url: data!.url } : x)));
      } catch (e) {
        setMsg({ kind: 'err', text: `Photo ${i + 1} failed: ${(e as Error).message}` });
      }
    }
    setBusy(null);
  }

  /** Storage keys are positional (01, 02…), so a reorder means re-uploading. */
  async function reindex(list: Photo[]) {
    setPhotos(list.map((p) => ({ ...p, url: undefined })));
    await uploadPending(list.map((p) => ({ ...p, url: undefined })));
  }

  const move = (from: number, to: number) => {
    const next = [...photos];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    void reindex(next);
  };

  // ---- MLS screenshot -----------------------------------------------------
  async function onScreenshot(file: File | null) {
    if (!file) return;
    setBusy('Reading the MLS sheet…');
    setMsg(null);
    try {
      const b64 = await blobToBase64(file);
      const mediaType = file.type === 'image/jpeg' ? 'image/jpeg' : file.type === 'image/webp' ? 'image/webp' : 'image/png';
      const { data, error } = await actions.extractMls({ imageBase64: b64, mediaType: mediaType as any });
      if (error) throw new Error(error.message);
      const x = data as MlsExtract;
      setF((s) => ({ ...s, ...prune(x), description: s.description || x.publicRemarks || '' }));
      if (x.town) { setTownQuery(x.town); setTownPicked(true); }
      setMsg({ kind: 'ok', text: 'Fields populated below — review them before generating.' });
    } catch (e) {
      setMsg({ kind: 'err', text: (e as Error).message });
    }
    setBusy(null);
  }

  async function rewrite() {
    setBusy('Writing description…');
    try {
      const { data, error } = await actions.rewriteDescription({ facts: factSummary(f) });
      if (error) throw new Error(error.message);
      set('description', data!.description);
    } catch (e) { setMsg({ kind: 'err', text: (e as Error).message }); }
    setBusy(null);
  }

  // ---- generate -----------------------------------------------------------
  async function generate(publish: boolean) {
    setTouched({ street: true, town: true, zipcode: true });
    setBusy(publish ? 'Generating…' : 'Saving…');
    setMsg(null);
    try {
      const payload = {
        ...f, slug, publish,
        images: photos.map((p) => p.url).filter(Boolean) as string[],
        highlights: splitLines(f.highlightsText),
        disclosures: splitLines(f.disclosuresText),
        interiorFeatures: splitLines(f.interiorText),
        exteriorFeatures: splitLines(f.exteriorText),
        accessibilityFeatures: splitLines(f.accessibilityText),
      };
      const { error } = await actions.saveListing({ payload: JSON.stringify(payload) });
      if (error) throw new Error(error.message);

      if (publish) {
        const { error: bErr } = await actions.publish({});
        if (bErr) throw new Error(`Saved, but the build did not trigger: ${bErr.message}`);
        setMsg({
          kind: 'ok',
          text: 'Saved and building. The page goes live in about two minutes — the site is statically built, so the link 404s until that finishes.',
          url: `${SITE}/listings/${slug}/`,
        });
      } else {
        setMsg({ kind: 'ok', text: 'Saved as Inactive. Activate it from Properties when you are ready.' });
      }
    } catch (e) {
      setMsg({ kind: 'err', text: (e as Error).message });
    }
    setBusy(null);
  }

  const F = (k: string, label: string, opts: { type?: string; wide?: boolean } = {}) => (
    <label className={opts.wide ? 'wide' : ''}>
      {label}
      <input
        type={opts.type ?? 'text'}
        value={(f as any)[k] ?? ''}
        onChange={(e) => set(k, opts.type === 'number' ? numOrUndef(e.target.value) : e.target.value)}
      />
    </label>
  );

  return (
    <div className="builder">
      {msg && (
        <p className={`note ${msg.kind}`}>
          {msg.text}
          {msg.url && (
            <>
              {' '}
              <a className="live" href={msg.url} target="_blank" rel="noopener noreferrer">{msg.url}</a>
            </>
          )}
        </p>
      )}
      {busy && <p className="note busy">{busy}</p>}

      {/* 1 — ADDRESS */}
      <section>
        <h2>1 · Property address</h2>
        <div className="grid">
          <label className="wide">
            Street address
            <input value={f.street ?? ''} onBlur={() => touch('street')}
                   onChange={(e) => set('street', e.target.value)} placeholder="206 Chestnut St" />
            {errOf('street') && <em>{errOf('street')}</em>}
          </label>
          <label>
            Town / municipality
            <input
              value={townQuery}
              onChange={(e) => { setTownPicked(false); setTownQuery(e.target.value); set('town', e.target.value); }}
              placeholder="Mount Holly"
              autoComplete="off"
              onBlur={() => touch('town')}
            />
            {townMatches.length > 0 && !townPicked && (
              <ul className="ac">
                {townMatches.map((t) => (
                  <li key={`${t.town}${t.zipcode}`}>
                    <button type="button" onClick={() => {
                      setTownPicked(true);
                      setTownQuery(t.town); set('town', t.town);
                      if (t.zipcode) set('zipcode', t.zipcode);
                      if (t.county) set('county', t.county);
                    }}>{t.town}<span>{t.zipcode} · {t.county}</span></button>
                  </li>
                ))}
              </ul>
            )}
            {errOf('town') && <em>{errOf('town')}</em>}
          </label>
          <label>
            ZIP
            <input value={f.zipcode ?? ''} onBlur={() => touch('zipcode')}
                   onChange={(e) => set('zipcode', e.target.value)} placeholder="08060" />
            {errOf('zipcode') && <em>{errOf('zipcode')}</em>}
          </label>
          {F('county', 'County')}
          <label className="wide">
            URL slug
            <input value={slug} onChange={(e) => { setSlugEdited(true); setSlug(e.target.value); }} />
            <span className="hint">/listings/{slug || '…'}/</span>
            {slugTaken && <em>That slug is already used by another property.</em>}
          </label>
        </div>
      </section>

      {/* 2 — PHOTOS */}
      <section>
        <h2>2 · Listing photos</h2>
        <p className="sub">
          Resized to 1600px and re-encoded in your browser before upload, the same way the CLI does it.
          The first photo is the hero — it becomes the page banner, the social preview, and the card image in the confirmation email.
        </p>
        <input type="file" accept="image/*" multiple onChange={(e) => addFiles(e.target.files)} />
        <div className="thumbs">
          {photos.map((p, i) => (
            <div
              key={p.id}
              className={`thumb ${i === 0 ? 'hero' : ''}`}
              draggable
              onDragStart={() => (dragFrom.current = i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (dragFrom.current !== null && dragFrom.current !== i) move(dragFrom.current, i); dragFrom.current = null; }}
            >
              <img src={p.url ?? p.previewUrl} alt="" />
              {i === 0 && <span className="badge">Hero</span>}
              {!p.url && <span className="badge warn">uploading</span>}
              <div className="thumb-actions">
                {i !== 0 && <button type="button" onClick={() => move(i, 0)}>Set hero</button>}
                <button type="button" onClick={() => reindex(photos.filter((x) => x.id !== p.id))}>Remove</button>
              </div>
              <span className="sz">{kb(p.bytes)}{p.originalBytes ? ` · was ${kb(p.originalBytes)}` : ''}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 3 — MLS */}
      <section>
        <h2>3 · MLS information</h2>
        <p className="sub">
          Drop the MLS sheet screenshot to fill the fields below, then correct anything that is wrong.
          Nothing is saved until you generate. Agent-only content — private remarks, showing and lockbox
          details, offer instructions — is never extracted.
        </p>
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => onScreenshot(e.target.files?.[0] ?? null)} />

        <div className="grid">
          {F('price', 'Price', { type: 'number' })}
          {F('beds', 'Beds', { type: 'number' })}
          {F('baths', 'Baths', { type: 'number' })}
          {F('sqft', 'Square feet', { type: 'number' })}
          {F('yearBuilt', 'Year built', { type: 'number' })}
          {F('mlsNumber', 'MLS #')}
          <label>
            Property type
            <select value={f.propertyType ?? ''} onChange={(e) => set('propertyType', e.target.value || undefined)}>
              <option value="">—</option>
              {['single-family', 'condo', 'townhouse', 'multi-family', 'land'].map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
          {F('style', 'Style')}
          {F('levels', 'Levels / stories')}
          {F('structureType', 'Structure')}
          {F('ownership', 'Ownership')}
          {F('lotSize', 'Lot size')}
          {F('basement', 'Basement')}
          {F('garage', 'Garage')}
          {F('parking', 'Parking')}
          {F('heating', 'Heating')}
          {F('cooling', 'Cooling')}
          {F('hotWater', 'Hot water')}
          {F('waterSource', 'Water')}
          {F('sewer', 'Sewer')}
          {F('schoolDistrict', 'School district')}
          {F('subdivision', 'Subdivision')}
          {F('municipality', 'Municipality')}
          {F('crossStreet', 'Cross street')}
          {F('zoning', 'Zoning')}
          {F('taxAnnual', 'Annual taxes')}
          {F('taxYear', 'Tax year')}
          {F('assessedValue', 'Assessed value')}
          {F('improvementsValue', 'Improvements')}
          {F('landValue', 'Land')}
          {F('taxId', 'Tax ID')}
          {F('blockLot', 'Block / lot')}
          {F('acceptableFinancing', 'Acceptable financing')}
          {F('possession', 'Possession')}
          {F('pricePerSqFt', 'Price per sq ft')}
        </div>

        <label className="wide">
          Description
          <textarea rows={7} value={f.description ?? ''} onChange={(e) => set('description', e.target.value)} />
          <span className="hint">
            Pre-filled with the public remarks. <button type="button" className="link" onClick={rewrite}>Rewrite from facts</button> for original copy.
          </span>
        </label>

        {[
          ['highlightsText', 'Highlights (one per line)'],
          ['interiorText', 'Interior features (one per line)'],
          ['exteriorText', 'Exterior features (one per line)'],
          ['accessibilityText', 'Accessibility features (one per line)'],
          ['disclosuresText', 'Disclosures (one per line)'],
        ].map(([k, label]) => (
          <label className="wide" key={k}>
            {label}
            <textarea rows={4} value={(f as any)[k] ?? ''} onChange={(e) => set(k, e.target.value)} />
          </label>
        ))}
      </section>

      {/* 4 — ATTRIBUTION */}
      <section>
        <h2>4 · Listing attribution</h2>
        <p className="sub">
          Required when advertising another broker's listing, and enforced by the database.
          The page reads “Listing courtesy of …, marketed by Steven Frato” — never implying it is your listing.
        </p>
        <label className="check">
          <input type="checkbox" checked={f.isOwnListing === true} onChange={(e) => set('isOwnListing', e.target.checked)} />
          This is my own listing
        </label>
        {!f.isOwnListing && (
          <div className="grid">
            {F('listingAgent', 'Listing agent')}
            {F('listingAgentPhone', 'Listing agent phone')}
            {F('listingBrokerage', 'Listing brokerage', { wide: true })}
          </div>
        )}
      </section>

      {/* 5 — REVIEW */}
      <section className="review">
        <h2>5 · Review</h2>
        <div className="rev">
          {photos[0] && <img className="rev-hero" src={photos[0].url ?? photos[0].previewUrl} alt="" />}
          <dl>
            <div><dt>Address</dt><dd>{f.street || '—'}, {f.town || '—'}, NJ {f.zipcode || '—'}</dd></div>
            <div><dt>URL</dt><dd>/listings/{slug || '—'}/</dd></div>
            <div><dt>Price</dt><dd>{f.price ? `$${Number(f.price).toLocaleString('en-US')}` : '—'}</dd></div>
            <div><dt>Beds / baths / sq ft</dt><dd>{f.beds ?? '—'} · {f.baths ?? '—'} · {f.sqft ? Number(f.sqft).toLocaleString('en-US') : '—'}</dd></div>
            <div><dt>Photos</dt><dd>{photos.filter((p) => p.url).length} uploaded{photos.some((p) => !p.url) ? ` (${photos.filter((p) => !p.url).length} pending)` : ''}</dd></div>
            <div><dt>Attribution</dt><dd>{f.isOwnListing ? 'Own listing' : `${f.listingAgent || '—'} · ${f.listingBrokerage || '—'}`}</dd></div>
          </dl>
        </div>
        <div className="actions">
          <button className="btn" disabled={!canGenerate} onClick={() => generate(true)}>
            {editing ? 'Save & publish' : 'Generate SPW'}
          </button>
          <button className="btn ghost" disabled={!!busy} onClick={() => generate(false)}>Save as Inactive</button>
        </div>
        {!canGenerate && !busy && (
          <p className="sub">
            Needs a valid address, a free slug, and at least one uploaded photo.
          </p>
        )}
      </section>

      <style>{`
        .builder { display:grid; gap:22px; }
        section { background:#fff; border:1px solid #DDE3EC; border-radius:8px; padding:20px 22px; }
        h2 { font-size:15px; margin:0 0 4px; }
        .sub { color:#5D6B80; font-size:12.5px; line-height:1.55; margin:0 0 14px; }
        .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:12px 16px; margin:12px 0; }
        label { display:grid; gap:5px; font-size:12px; color:#44536A; position:relative; }
        label.wide { grid-column:1/-1; }
        input, select, textarea { font:inherit; font-size:13.5px; padding:8px 10px; border:1px solid #C3CDDA; border-radius:5px; background:#fff; }
        textarea { resize:vertical; }
        label em { color:#8A1F1F; font-style:normal; font-size:11.5px; }
        .hint { color:#5D6B80; font-size:11.5px; }
        .link { background:none; border:0; color:#1E4A73; cursor:pointer; padding:0; font:inherit; text-decoration:underline; }
        .check { display:flex; flex-direction:row; align-items:center; gap:8px; font-size:13px; margin-bottom:6px; }
        .check input { width:auto; }
        .thumbs { display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:12px; margin-top:14px; }
        .thumb { position:relative; border:1px solid #DDE3EC; border-radius:6px; overflow:hidden; background:#F7F8FA; cursor:grab; }
        .thumb.hero { border-color:#1E4A73; box-shadow:0 0 0 2px rgba(30,74,115,.18); }
        .thumb img { display:block; width:100%; height:96px; object-fit:cover; }
        .badge { position:absolute; top:6px; left:6px; background:#1E4A73; color:#fff; font-size:10px; font-weight:700; padding:2px 7px; border-radius:999px; }
        .badge.warn { background:#8A6D1F; left:auto; right:6px; }
        .thumb-actions { display:flex; gap:6px; padding:6px; }
        .thumb-actions button { flex:1; font-size:11px; padding:3px 4px; border:1px solid #C3CDDA; background:#fff; border-radius:4px; cursor:pointer; }
        .sz { display:block; padding:0 6px 6px; font-size:10.5px; color:#5D6B80; }
        .ac { position:absolute; top:100%; left:0; right:0; z-index:5; margin:2px 0 0; padding:0; list-style:none;
              background:#fff; border:1px solid #C3CDDA; border-radius:5px; box-shadow:0 6px 18px rgba(15,39,66,.12); }
        .ac button { display:flex; justify-content:space-between; gap:10px; width:100%; text-align:left; padding:7px 10px;
                     background:none; border:0; cursor:pointer; font-size:13px; }
        .ac button:hover { background:#F0F4F9; }
        .ac span { color:#5D6B80; font-size:11.5px; }
        .rev { display:flex; gap:18px; align-items:flex-start; }
        .rev-hero { width:210px; height:140px; object-fit:cover; border-radius:6px; border:1px solid #DDE3EC; }
        .rev dl { margin:0; display:grid; gap:7px; flex:1; }
        .rev dl div { display:grid; grid-template-columns:170px 1fr; gap:10px; font-size:13px; }
        .rev dt { color:#5D6B80; }
        .rev dd { margin:0; }
        .actions { display:flex; gap:10px; margin-top:18px; }
        .note { padding:10px 13px; border-radius:6px; font-size:13px; margin:0; }
        .note.ok { background:#E4F3E8; border:1px solid #B7DFC2; color:#1B5E2A; }
        .note.err { background:#FDECEC; border:1px solid #F5C2C2; color:#8A1F1F; }
        .note.busy { background:#EEF3FA; border:1px solid #C9D9EC; color:#1E4A73; }
        .note .live { display:inline-block; margin-top:6px; font-weight:700; color:#1B5E2A; word-break:break-all; }
      `}</style>
    </div>
  );
}

// --- helpers ---------------------------------------------------------------
const numOrUndef = (v: string) => (v === '' ? undefined : Number(v));
const splitLines = (v?: string) => (v ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
const prune = (o: Record<string, any>) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined && v !== ''));

function factSummary(f: Record<string, any>) {
  return Object.entries(f)
    .filter(([k, v]) => v && !['description', 'publicRemarks'].includes(k) && typeof v !== 'object')
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
}

function existingPhotos(e: Record<string, any> | null): Photo[] {
  return ((e?.images ?? []) as string[]).map((url, i) => ({
    id: `existing-${i}`, url, previewUrl: url, name: url.split('/').pop() ?? '',
    blob: new Blob(), ext: url.endsWith('.webp') ? 'webp' : 'jpg', bytes: 0, originalBytes: 0,
  }));
}

/** Flatten a saved row back into the flat shape the form edits. */
function fromExisting(e: Record<string, any> | null): Record<string, any> {
  if (!e) return {};
  const d = e.details ?? {};
  const rowsOf = (title: string) =>
    Object.fromEntries((d.factGroups ?? []).find((g: any) => g.title === title)?.rows ?? []);
  const structure = rowsOf('Structure');
  const systems = rowsOf('Systems & utilities');
  const location = rowsOf('Location & schools');
  const taxes = rowsOf('Taxes & assessment');
  const listing = rowsOf('Listing');
  const featureItems = (title: string) =>
    ((d.featureGroups ?? []).find((g: any) => g.title === title)?.items ?? []).join('\n');

  return {
    street: e.address, town: e.town, zipcode: e.zipcode, county: e.county,
    price: e.price ? Number(e.price) : undefined,
    beds: e.beds, baths: e.baths ? Number(e.baths) : undefined, sqft: e.sqft,
    yearBuilt: e.year_built, propertyType: e.property_type, mlsNumber: e.mls_number,
    lotSize: e.lot_size, description: e.description,
    isOwnListing: e.is_own_listing, listingAgent: e.list_agent_name,
    listingAgentPhone: e.list_agent_phone, listingBrokerage: e.listing_brokerage,
    highlightsText: (e.highlights ?? []).join('\n'),
    interiorText: featureItems('Interior features'),
    exteriorText: featureItems('Exterior features'),
    accessibilityText: featureItems('Accessibility'),
    disclosuresText: (d.disclosures ?? []).join('\n'),
    rooms: d.rooms ?? [],
    style: structure['Style'], levels: structure['Levels'], structureType: structure['Structure'],
    ownership: structure['Ownership'],
    heating: systems['Heating'], cooling: systems['Cooling'], hotWater: systems['Hot water'],
    waterSource: systems['Water'], sewer: systems['Sewer'],
    schoolDistrict: location['School district'], subdivision: location['Subdivision'],
    municipality: location['Municipality'], crossStreet: location['Cross street'],
    taxAnnual: taxes['Annual taxes'], assessedValue: taxes['Assessed value'],
    improvementsValue: taxes['Improvements'], landValue: taxes['Land'],
    taxId: taxes['Tax ID'], blockLot: taxes['Block/Lot'],
    acceptableFinancing: listing['Acceptable financing'], possession: listing['Possession'],
    pricePerSqFt: listing['Price per sq ft'], status: listing['Status'],
  };
}
