# Pre-Launch Audit — Steven Frato Real Estate (stevenfrato.com)

**Repo:** `/Users/gavin/Documents/GitHub/StevensWebsite` · **Branch:** main · **Head:** b5bd6b7 · **Generated:** 2026-06-18
**Inputs:** recon brief + 7 lane finding-sets (90 findings, 8 P0) + 8 persona walkthroughs

---

## 1. Launch-Readiness Scorecard

# 🔴 GO / NO-GO: **NO-GO**

The site cannot launch in its current state. Two independent classes of launch-blocker exist: (1) **the lead pipeline is broken end-to-end** — 100% of the only backend-connected form is rejected, and the three primary on-page forms never reach the CRM/email pipeline at all, so leads are silently lost while every visitor sees "success"; and (2) **published Fair Housing violations** name protected classes (religion, race/national origin, familial status) as selling points on live `/moving-to/*` pages, plus the site lacks the NJ-required brokerage/license identification. Either class alone blocks launch. A cross-cutting **data-integrity/templating defect** (nonsensical market stats and visible typos) independently tanks credibility on every persona journey.

### Lane status

| Lane | Status | P0 | P1 | P2 | P3 | Total | Headline |
|------|--------|----|----|----|----|-------|----------|
| Lead pipeline | 🔴 RED | 3 | 6 | 3 | 1 | 13 | Sole live form 100% rejected; 3 primary forms unwired; always-200 false success |
| Fair Housing / compliance | 🔴 RED | 5 | 5 | 6 | 2 | 18 | Protected-class steering on live pages; no NJ license/brokerage ID |
| CRO regression | 🔴 RED | 0 | 2 | 4 | 5 | 11 | Forms-not-wired (→P0 merged); exit popup unreachable on mobile |
| Security / PII | 🟠 AMBER | 0 | 3 | 5 | 3 | 11 | Open unauthenticated endpoint; HTML email injection; PII in URLs/logs |
| Local SEO | 🟠 AMBER | 0 | 2 | 6 | 6 | 14 | robots.txt blocks `/_astro/` CSS/JS; 54–71% boilerplate thin pages |
| Performance / mobile | 🟠 AMBER | 0 | 3 | 2 | 3 | 8 | Render-blocking font @import; 186KB React on text pages; 1–2.5MB images |
| Accessibility | 🟠 AMBER | 0 | 3 | 9 | 3 | 15 | Gold CTA contrast 2.53:1; unlabeled calculator inputs; no focus indicators |
| **TOTAL** | **🔴** | **8** | **24** | **35** | **23** | **90** | |

### The full P0 list (all 8 must clear before launch)

1. **[lead] ExitIntentPopup → `/api/market-report` rejected 100%** — popup forces `town=''`; handler requires non-empty `town` → HTTP 400 on every submission. The *only* pipeline-connected form creates zero leads/emails/notifications.
2. **[lead] `handle-market-report` always returns 200** — Supabase/SES/PDF failures only `console.error`'d; visitor sees "success" while lead is permanently lost. No retry, queue, or alert.
3. **[lead] 3 primary forms POST to `/` (Netlify Forms), not the pipeline** — MarketReportForm, ContactForm, QualificationQuiz never trigger Supabase insert, drip, or Steven notification (no netlify.toml wiring). *Corroborated by cro-regression (P1) → reconciled UP to P0.*
4. **[FHA] `town-guides.ts:159` East Brunswick** — "Large Jewish community with multiple synagogues… Popular with families" (religion + familial status).
5. **[FHA] `town-guides.ts:146,149` Edison** — "large South Asian community… Vibrant multicultural community" (race/national origin).
6. **[FHA] `town-guides.ts:196,199` South Brunswick** — "strong appeal to South Asian families… Indian and South Asian community" (race/national origin + familial).
7. **[FHA] `town-guides.ts:108` Robbinsville** — "Growing Sikh cultural community" (religion/national origin).
8. **[FHA] `town-guides.ts:47` Moorestown** — "Low crime, family-friendly" (familial status + HUD-flagged crime steering).

### Elevated cross-cutting blocker (credibility-critical, spans lanes — treat as launch-gating)

**DATA-INTEGRITY / TEMPLATING DEFECT.** Not isolated to one lane JSON, but reported independently by **5 of 8 personas**. Nonsensical market stats: Florence median **$168,900 / −29.6% YoY**, DOM **−1400% / −1700% / +400% / +600% YoY**; same-page contradiction **$448k snapshot vs $689k "Nearby Areas"** (Edison). Homepage self-contradiction: county cards "Seller's Market" while summary reads **"Seller's Markets 0 (0%) / Balanced 97 (100%)"**. Templating bugs: **"balanced's market"**, **"Your Your Town"** (un-interpolated `{town}`), **"Edison offers edison is one of nj's…"**, duplicated lowercase FAQ sentences. On a data-driven lead-gen site this destroys trust before any form is reached. **Must be fixed before launch.**

---

## 2. Prioritized Findings Table (de-duplicated, severity reconciled upward)

P0 first. Merged items note independent corroboration. Severity reconciled UP where multiple lanes/personas hit the same issue.

### P0 — launch blockers

| Sev | Lane(s) | Location | Evidence | Fix | Effort | Corroborated by |
|-----|---------|----------|----------|-----|--------|-----------------|
| P0 | lead-pipeline | `ExitIntentPopup.astro:274-276` + `handle-market-report.ts:85` | Popup sets `town=''`; handler 400s on empty `town`. The ONLY pipeline form → 100% rejection, 0 leads/emails. sessionStorage flag set on view, so no re-prompt. | Drop `town` from required check (derive from zip lookup edge fn already does) OR populate real town. Add E2E submit test. | S | recon forms brief; security-pii (endpoint) |
| **P0** (merged; cro was P1 → ↑) | lead-pipeline + cro-regression | `MarketReportForm.astro:238`, `ContactForm.astro:251`, `QualificationQuiz.astro:699` + `netlify.toml` | 3 of 4 forms POST to `/` (Netlify Forms). No notification/webhook wires them to `handle-market-report`. No Supabase lead, no drip, no instant Steven SES notification — despite UI promising "report in 24h" / "call now". Success shown on any 2xx (homepage returns 200) = success-spoofing. | Point forms at `/api/market-report` (like popup) OR commit a Netlify form-submitted webhook → handler. Stop showing success on bare `response.ok`. **Verify Netlify dashboard wiring before launch.** | M | recon `forms_critical_finding`; personas seller-relo, seller-downsizer (drip promise) |
| P0 | lead-pipeline | `handle-market-report.ts:156-166,219-233` | Handler ALWAYS returns 200 regardless of Supabase/SES/PDF outcome. False success on total lead loss. No retry/queue/dead-letter/alert. | Capture edge response; return non-200 on persistence failure OR enqueue payload to durable store + alert. Never report success unless lead is confirmed written. | M | security-pii (always-200 abuse-masking) |
| P0 | FHA | `town-guides.ts:159` (East Brunswick) | "Large Jewish community… synagogues… Popular with families" — religion + familial status, FHA 3604(c)/NJ LAD. Live on `/moving-to/east-brunswick/`. | Rewrite to amenities only (see §4). | S | persona-middlesex-family (visited Edison/EB) |
| P0 | FHA | `town-guides.ts:146,149` (Edison) | "large South Asian community… Vibrant multicultural community" — race/national origin steering. Live `/moving-to/edison/`. | Describe dining/amenities, not residents' ethnicity (see §4). | S | persona-middlesex-family |
| P0 | FHA | `town-guides.ts:196,199` (South Brunswick) | "strong appeal to South Asian families… Indian and South Asian community" — race/national origin + familial. | Rewrite to planned-community/highway facts (see §4). | S | — |
| P0 | FHA | `town-guides.ts:108` (Robbinsville) | "Growing Sikh cultural community" as selling point — religion/national origin. | Remove; "multiple cultural and community centers" (see §4). | S | — |
| P0 | FHA | `town-guides.ts:47` (Moorestown) | "Low crime, family-friendly, walkable" — familial status + HUD-flagged crime-coded steering. | Delete "Low crime" and "family-friendly" (see §4). | S | persona-seller-downsizer (Moorestown) |
| **P0** (elevated cross-cutting) | data-integrity (spans local-seo/cro + personas) | `data/processed/*.json`, market/town/home-value/moving-to templates | Broken stats (−1700% DOM, $168,900 Florence, $448k-vs-$689k), homepage market-type contradiction, "balanced's market"/"Your Your Town"/duplicated-FAQ templating bugs. | Validate/clamp YoY + DOM at data-process stage; fix possessive/interpolation templating; reconcile homepage market-type aggregation; add build-time sanity assertions. | M | personas: bc-firsttime, mercer-relo, middlesex-family, seller-investor, seller-fsbo |

### P1 — fix before or immediately at launch

| Sev | Lane(s) | Location | Evidence | Fix | Effort | Corroborated by |
|-----|---------|----------|----------|-----|--------|-----------------|
| P1 (merged) | lead-pipeline + security-pii | `handle-market-report.ts` (no bot-field read); `config.toml:49 verify_jwt=false`; `handle-form-submission` no auth, CORS `*` | `/api/market-report` + edge fn are open, unauthenticated, no rate limit/CAPTCHA, honeypot never validated. Once town bug fixed → open spam funnel: each POST = lead row + 2 SES sends (reputation/quota abuse). | Validate bot-field server-side; per-IP/email rate limit; shared-secret/JWT on edge fn; lock CORS to prod origin; Turnstile on spike. | M | both lanes independently |
| P1 (merged) | lead-pipeline + cro-regression | `ExitIntentPopup.astro:189-226` (mobile trigger) + `:164,284-310` (single-fire, no Netlify backup) | Desktop trigger is mouseout(clientY≤0) — never on touch. Mobile 30s timer resets every view-transition nav → multi-page mobile visitors never see it. Flag set on view; failed POST = invisible loss (no Forms backup, always-200). Sole pipeline form unreachable for majority mobile traffic. | Persist cumulative engagement in sessionStorage; add scroll-depth/popstate triggers; set suppress flag on success/dismiss only; localStorage retry. | M | recon `break_risk` |
| P1 | lead-pipeline | `handle-form-submission/index.ts:741-761` | Duplicate-lead guard short-circuits BEFORE scoring/notification when email exists & active. A returning now-HOT seller is swallowed; Steven never notified, score/temperature stay stale. | Re-notify + re-score on higher-intent resubmission. | M | — |
| P1 | lead-pipeline | `handle-form-submission/index.ts:681-703` | `sendLeadNotification` SES failure only logged; handler still 200. HOT lead written, Steven never pinged (email says "CALL NOW"). | Retry w/ backoff; flag `notification_failed` + secondary alert channel. | S | — |
| P1 | lead-pipeline | `handle-form-submission/index.ts:897-907` | `scheduled_emails` bulk insert single-attempt; error logged, execution continues. Entire 5-email drip silently never scheduled. | Retry; mark lead `drip_scheduling_failed` + reconcile job. | S | — |
| P1 | lead-pipeline | `send-scheduled-emails/index.ts:2831-2834,2790-2792` | Email flipped to `sending` before SES send; query only selects `pending`. Crash mid-batch orphans email in `sending` forever. | Don't pre-flip, OR recovery sweep for `sending` older than timeout. | M | — |
| P1 | lead-pipeline | `send-scheduled-emails/index.ts:2901-2913` + `process-email-queue.ts:36-53` | max_attempts→`failed` with no alert; daily cron failure stalls whole drip ≤24h silently. | Alert on failed/errored batches; monitor cron (dead-man's-switch); run more than daily. | M | — |
| P1 | security-pii | `handle-form-submission/index.ts:284,289,318,…388` | Raw `${lead.name/address/town}` interpolated into HTML email bodies + subject. `name='<img onerror=…>'` → HTML/script injection into Steven's inbox; subject header-injection. | HTML-escape all user fields; strip CR/LF + length-cap subject fields. | M | — |
| P1 | local-seo | `public/robots.txt:16` (`Disallow: /_astro/`) | Blocks the hashed CSS/JS that all 357 pages need to render — violates Google "don't block CSS/JS". Degrades rendered-layout + mobile-usability sitewide. | Remove the line; keep `Disallow: /api/`; optional `Allow: /_astro/`. | S | — |
| P1 | local-seo | home-value (98) + town (98) + zip (97) pages | 54–71% boilerplate, Jaccard 0.44–0.60; word counts 361–438. Doppelganger/thin-page risk on PRIMARY SEO targets. (moving-to at 25%/0.14 is the model.) | Expand unique per-page narrative (schools, commute, recent sales); target >50% unique tokens. | L | personas mercer-relo, middlesex-family (thin content) |
| P1 | perf-mobile | `global.css:7` font `@import` | Render-blocking chain HTML→CSS→Google Fonts CSS→woff2; preconnect can't help late-discovered @import. LCP is Playfair H1 text on top templates. | Self-host fonts (@fontsource) or `<link rel=stylesheet>` + `<link rel=preload as=font crossorigin>`; subset weights. | M | — |
| P1 | perf-mobile | `MarketReportForm.astro:107`, `QualificationQuiz.astro:451` `client:load`; `client.9unXo8s5.js` 186KB/58KB-gz | Full React 19 runtime eager-loaded on nearly every template for tiny autocompletes. Competes with LCP, adds TBT. | `client:visible`/`client:idle`, or replace islands with vanilla datalist typeahead to drop React. | M | persona-bc-firsttime (slow mobile) |
| P1 | perf-mobile | `public/images/*`; `astro:assets` unused | 1.35MB headshot, 2.48MB/1.28MB PNGs shipped raw; sharp installed but never used. 1.35MB eager LCP on /about at 300px. | Render via `astro:assets` `<Image>` webp/avif w/ width/height; pre-resize; delete unused multi-MB PNGs. | M | — |
| P1 | accessibility | `global.css:225-242` `.btn-primary` + all gold CTAs | White on `--c21-gold #C99C33` = **2.53:1** (need 4.5:1); hover `#B38A1F` = 3.19:1. The most-clicked elements sitewide fail WCAG 1.4.3. | Darken to ~`#8A6A12` (~5:1) via `--cta-primary` token, OR charcoal text on gold (5.5:1). | M | persona accessibility-wide |
| P1 | accessibility | 4 calculator islands (Affordability/Proceeds/HomeValue/Timing) | Inputs have no `htmlFor`/`id`/`aria-label`; placeholder ≠ accessible name. SR users can't identify fields. | Add `htmlFor={id}`/`id` pairs on every calculator input. | M | personas use the calculators heavily |
| P1 | accessibility | `QualificationQuiz.astro:905`, `ExitIntentPopup.astro:457-462,528-533` | Custom radio cards hide native input (opacity:0) with no `:focus-visible` on the styled surrogate → zero visible keyboard focus. | Add `input:focus-visible + .option-content { outline }` to card/intent/timeline options. | S | — |
| P1 | FHA | `Footer.astro:147-148,170-173`; `emails/components/Footer.tsx` | No NJ license number + no licensed brokerage (broker of record) sitewide or in emails. C21 franchise brand ≠ licensed broker. Violates N.J.A.C. 11:5-6.1. | Add brokerage legal name + office address + Steven's NJ license # + office phone (confirm strings w/ Steven). | M | persona-bucks-crossstate (license signals) |
| P1 | FHA | `town-guides.ts:34,37` (Marlton), `:105` (Robbinsville), `:95,98` (Princeton), `:24,…179` ("diverse") | Familial-status steering ("attracts families", "young families"), school-quality proxy ("good/top schools"), prestige/national-origin ("highly educated population", "international community"), and "diverse neighborhoods/community" as resident-composition descriptor across 5 towns. | Rewrite to place/amenity facts; move district info to neutral `schoolNote`; remove "diverse" as people-descriptor (see §4). | S | persona-mercer-relo ("balanced's market" + schools) |
| P1 | cro-regression | (covered by merged forms-gap P0 above) | — | — | — | — |

### P2 / P3 — post-launch (condensed; full detail in lane JSONs)

**P2 (35):** security headers missing CSP/HSTS/Permissions-Policy (`netlify.toml:30-37`); Matomo/GA load with no consent gate + privacy policy omits **Supabase + Matomo** as processors (`privacy.astro:91-99`) — *FHA + security corroborate*; PII in `generate-pdf` GET query string + plaintext logs; wildcard CORS on all edge fns; client trusts `lead-score`/`lead-temperature` params (forgeable hot/cold routing); sitemap lists 87 non-canonical ZIPs + thank-you (noindex) + indexable thin `/listings` placeholder (also a misrepresentation: "Browse current listings" with no IDX); 3 broken internal links (cranbury/lawrence/under-400k 404); titles all >60 chars; home-value vs market keyword cannibalization; PA/Bucks geography gap; font-swap CLS; missing `og-default.jpg`/`apple-touch-icon`/`century21-logo.svg` (404s); 9 a11y items (modal focus-trap, no aria-live on tools/success, missing fieldset/legend, segmented-toggle aria-pressed, LocationPicker combobox, slider label, gold text contrast, quiz step focus); EHO mark weak (custom SVG, none in emails); investor email + schoolNote school/familial proxies; StickyCTA z-index overlaps header; quiz `calculateScore()` outside try (silent dead-end); TownZipField island fields not registered with Netlify Forms (town/zip silently stripped).

**P3 (23):** generate-pdf no auth; SYNC_SECRET non-constant-time; client bundle secret-scan **PASS** (keep CI grep gate); apple-touch-icon/geo-tag/schema-geo hardcoded to Burlington on all pages; listings double-branded title; no sitemap lastmod; TownZipField duplicate ids; /about heading skip; alert()-based errors; Matomo/ViewTransitions transfer cost; quiz partial-lead not captured; exit-popup button label mismatch; ContactForm phone required (friction); home-value intent grouped as seller; no mobile header tel: button; privacy drip-consent disclosure; PA-disclosure latent gap.

---

## 3. Lead-Funnel Integrity (commercial heart)

### Intended funnel (per recon)

```
[submit] → [validate] → [store: Supabase leads] → [route: score→notify Steven] → [ack: SES welcome+PDF, 5-email drip]
```

### Actual funnel by form — which forms reach Supabase/SES vs. die in Netlify Forms

| Form | Posts to | Reaches Supabase + SES pipeline? | Actual outcome |
|------|----------|----------------------------------|----------------|
| **ExitIntentPopup** | `/api/market-report` (`:285`) | **Intended yes — but 100% REJECTED** | `town=''` → handler `:85` 400. Zero leads. Also unreachable on multi-page mobile (`:189-226`). No Netlify backup (no `data-netlify`). |
| **MarketReportForm** | `/` (`:238`) | **NO** | Netlify Forms inbox only. No lead, no drip, no Steven notification. Shows success on any 2xx. |
| **ContactForm** | `/` (`:251`) | **NO** | Netlify Forms inbox only. Phone required (friction). |
| **QualificationQuiz** | `/` (`:699`) | **NO** | Netlify Forms inbox only. HOT-scored lead lands silently; `calculateScore()` outside try can also kill submit. TownZip island fields may be stripped (not build-registered). |

**Net commercial reality: 0 of 4 forms currently deliver a lead to the CRM + instant notification + drip.** The popup (only pipeline form) is rejected 100%; the other three never enter the pipeline. Every visitor sees "success."

### Every drop-point (file:line)

| # | Location | Drop |
|---|----------|------|
| 1 | `ExitIntentPopup.astro:274-276` | Forces `town=''` → guaranteed 400 |
| 2 | `handle-market-report.ts:85` | Rejects empty `town` (should derive from zip) |
| 3 | `handle-market-report.ts:156-166` | Supabase non-OK / throw only logged; continues |
| 4 | `handle-market-report.ts:191-196` | Fallback trigger-email failure only logged |
| 5 | `handle-market-report.ts:219-224` | PDF failure only logged |
| 6 | `handle-market-report.ts:227-233` | **Always returns 200** — false success |
| 7 | `MarketReportForm.astro:238` / `ContactForm.astro:251` / `QualificationQuiz.astro:699` | POST to `/` — bypass pipeline entirely |
| 8 | `handle-form-submission/index.ts:823-852` | Single lead insert, no retry |
| 9 | `handle-form-submission/index.ts:854-859` | Insert error → 500, but caller ignores (masks it) |
| 10 | `handle-form-submission/index.ts:741-761` | Active-duplicate short-circuits before notify/score |
| 11 | `handle-form-submission/index.ts:899-907` | scheduled_emails insert error swallowed → no drip |
| 12 | `handle-form-submission/index.ts:403-405` | Welcome SES failure swallowed → no report PDF |
| 13 | `handle-form-submission/index.ts:701-703` | **Steven notification SES failure swallowed** → HOT lead, no human ping |
| 14 | `send-scheduled-emails/index.ts:2831-2834` | `sending` orphan on crash → never retried |
| 15 | `send-scheduled-emails/index.ts:2901-2913` | max_attempts → `failed`, no alert |
| 16 | `process-email-queue.ts:37-53` | Daily cron failure stalls drip ≤24h, no alert |
| 17 | `ExitIntentPopup.astro:284-310` | Single-fire flag on view; failed POST = silent loss, no backup |
| 18 | `handle-market-report.ts` (whole) | Honeypot `bot-field` never validated server-side |

---

## 4. Fair Housing / Compliance

Every flagged string, rule category, and compliant rewrite. **5 P0 protected-class items render live on `/moving-to/*`.**

### P0 — protected-class steering (live on `/moving-to/*`) — fix before launch

| File:line | Town | Offending string | Rule | Compliant rewrite |
|-----------|------|------------------|------|-------------------|
| `town-guides.ts:159` | East Brunswick | "Large Jewish community with multiple synagogues… Popular with families" | **Religion + Familial Status** (3604(c)/LAD) | "Extensive commercial corridor on Route 18. Multiple houses of worship, community centers, and a strong parks system. Wide range of housing types and amenities." |
| `town-guides.ts:146,149` | Edison | "large South Asian community… Vibrant multicultural community" | **Race / National Origin** | "Edison is one of NJ's most populous townships… a wide range of housing and a renowned, varied dining scene." / "Diverse, internationally acclaimed dining along Oak Tree Road and Route 27. Major retail centers." |
| `town-guides.ts:196,199` | South Brunswick | "strong appeal to South Asian families… Indian and South Asian community" | **Race/National Origin + Familial** | "A rapidly growing township with planned communities and convenient highway access between Route 1 and Route 27." / "Multiple cultural and community centers. New-construction neighborhoods. Route 1 tech corridor." |
| `town-guides.ts:108` | Robbinsville | "Growing Sikh cultural community" | **Religion / National Origin** | "Town Center with shops, restaurants, and community events. Multiple cultural and community centers. Strong youth athletics programs." |
| `town-guides.ts:47` | Moorestown | "Low crime, family-friendly, and walkable" | **Familial Status + crime-coded steering** (HUD) | "Charming main street with boutique shops and restaurants. Strong historic-preservation ethic and a highly walkable town center." |

### P1 — steering proxies + statutory identification

| File:line | Issue | Rule | Fix |
|-----------|-------|------|-----|
| `town-guides.ts:34,37` Marlton | "attracts families… young families… good schools" | Familial + school proxy | "Newer planned developments and easy highway access… suburban convenience and a short commute." |
| `town-guides.ts:105` Robbinsville | "attracts professional families drawn by top schools" | Familial + school proxy | "One of central NJ's fastest-growing communities… newer planned developments and a growing town center." |
| `town-guides.ts:95,98` Princeton | "prestige… highly educated population… international community" | Exclusivity + national origin + socioeconomic | "Home to Princeton University with a distinctive cultural and intellectual energy, a vibrant arts scene, and exceptional dining." (Remove prestige/educated/international.) |
| `town-guides.ts:24,118,156,166,179` | "diverse neighborhoods/community" as resident descriptor (Cherry Hill, Hamilton, East Brunswick, Old Bridge, Woodbridge) | Race/National Origin (HUD coded) | "A wide range of housing types and price points." Remove "diverse community/neighborhoods." |
| **`Footer.astro:147-148,170-173` + `emails/components/Footer.tsx`** | **No NJ license # and no licensed brokerage (broker of record) sitewide or in email** | **N.J.A.C. 11:5-6.1** — brokerage legal name required in advertising | Add brokerage legal name + office address + Steven's NJ salesperson license # + office phone. C21 brand ≠ licensed broker. Confirm exact strings with Steven. |

### P2 — disclosures + marketing copy

- **EHO mark weak** (`Footer.astro:162-167`): only a custom SVG `title`, no visible "Equal Housing Opportunity" text/HUD logo; **emails have no EHO at all**. → Use official HUD EHO logo + visible slogan in site footer and **every email template**.
- **Privacy-policy processor gaps** (`privacy.astro:91-99`): lists only Netlify/AWS/Google Analytics; **omits Supabase** (stores lead PII) and **Matomo** (primary tracker). → Add Supabase + Matomo + name SES for email. *Corroborated by security-pii consent finding.*
- **Cookie consent commented out** (`BaseLayout.astro:233-234`) while Matomo+GA fire unconditionally — policy implies control the site doesn't provide. → Gate trackers behind consent or run Matomo cookieless and state it accurately.
- **Listings misrepresentation** (`listings.astro:11,16,33,39`): "Browse current listings / Search all available properties / full access to all MLS listings" on a placeholder with no IDX. → Reframe to "I can search the MLS on your behalf" until a licensed feed + IDX attribution exists.
- **schoolNote superlatives** (`town-guides.ts:46,97,107`) + **investor email** (`investor-3-opportunities.tsx:75-76,98-99` "family-friendly neighborhoods… good schools"): school-quality/familial proxy. → Neutral, attributed, dated district facts + disclaimer; reframe investor copy to demand/value metrics.

### P3 — PA market gap (required before serving intended Bucks County, PA market)

- **No PA license, PA brokerage ID, or PA fair-housing/advertising disclosures exist** (PA RELRA + PA Human Relations Act). Latent only because no PA content exists yet. → Before publishing ANY Bucks County content: add PA brokerage/license identification, PA-compliant disclosures, and confirm Steven's PA licensure or a co-broker/referral arrangement. **Do not serve PA leads until this exists.**
- Privacy policy must state form submission enrolls the user in an automated 5-email/14-day drip with one-click unsubscribe (CAN-SPAM/state consent).

---

## 5. Persona Scorecards

| Persona | Device | Score /10 | Biggest blocker |
|---------|--------|-----------|-----------------|
| Bucks County PA cross-state buyer | Desktop | **1** | Every Bucks/PA URL 404s; "Licensed NJ Agent" badge implies he can't represent PA; zero PA content; no out-of-area capture path |
| Mercer relocation move-up buyer ($700-900k) | Desktop→phone | **3** | No buyer/relocation path; IDX "Coming Soon"; schools punt to NJ DOE; "−1700% YoY DOM" + "balanced's market" bugs fail $800k credibility |
| FSBO-curious Cherry Hill seller | Desktop | **3** | No FSBO-vs-agent content; commission slider can't model 0%; no track record/social proof; takes free tools, bounces |
| Burlington first-time buyer / Philly commuter | Cheap Android/4G | **4** | No listing search; town pages push seller CMA; broken Florence data ($168,900/−29.6%/−1400% DOM); affordability calc omits PMI |
| Middlesex family comparison-shopper | Desktop+phone | **4** | Compare pages name schools+commute then provide neither; NYC-only commute (no Philly); only 5 fixed pairs; seller-only form; "$448k vs $689k" bug |
| Small NJ landlord/investor | Desktop | **4** | Net-proceeds ignores federal cap gains + depreciation recapture + NIIT; no hold-vs-sell/cap-rate; investor depth hidden in email drip; "Your Your Town" bug |
| Relocating-for-job NJ seller (8-wk deadline) | Mobile | **5** | Zero urgency/relocation/speed messaging; Edison "72-day DOM" with no mitigation; "24h report + multi-week drip" reads slow (phone # rescues it) |
| Empty-nester downsizer | Desktop | **5** | Required street-address field above the value; undisclosed-until-after multi-week drip; thin human/credibility proof |

**Mean score ≈ 3.6/10** — no persona scored above 5; the intended PA market scored 1.

### 3 highest-leverage conversion fixes (cross-cutting all 8 personas)

1. **Build a genuine buyer journey + listing/inventory path, and stop funneling buyers into seller CMA forms.** 6 of 8 personas hit a seller-only "what's your home worth" form on buyer-intent pages, and **all** hit `/listings` "Coming Soon." Add IDX/MLS search (or at minimum a buyer-intent capture + saved-search), and render the correct form per page intent. *Themes: buyer→seller mismatch, no listing search.*

2. **Fix the data-integrity/templating defect AND add agent credibility/social proof.** Broken stats (−1700% DOM, $168,900, $448k-vs-$689k), homepage market-type contradiction, and "balanced's market"/"Your Your Town" typos destroyed trust for 5 personas; 3 more cited zero track record/photo/reviews/credentials. Validate data at build, fix templating, and surface real proof (sold count, results, credentials — no fabricated testimonials per project rule). *Themes: broken stats, missing social proof.*

3. **Serve the unaddressed high-intent segments with on-page depth: PA/Bucks, FSBO, investor, relocation/urgency.** The PA buyer (1/10) gets 404s + a license signal that repels; the FSBO skeptic finds no agent-vs-FSBO argument; the investor's cap-gains/recapture/hold-vs-sell math is absent (depth exists only in a hidden email drip); the deadline seller finds no speed/relocation narrative. Each needs at least one on-page asset before the form. *Themes: PA gap (1/10), no FSBO/investor/urgency depth.*

---

## 6. Proposed Patches (P0 / top-P1) — **PROPOSED FOR REVIEW, NOT APPLIED**

> Unified-diff sketches. Verify against current source before applying. No source was modified by this audit.

### Lane: Lead pipeline

**P0-a — ExitIntentPopup: remove forced-empty town + single-fire-on-view**
```diff
--- a/src/components/ExitIntentPopup.astro
+++ b/src/components/ExitIntentPopup.astro
@@ submit handler (~274-276)
-  if (!formData.get('town')) formData.set('town', '');
+  // Do NOT send an empty town; the edge function derives town from zipcode.
+  // (remove the line entirely; handler must not require town — see handle-market-report patch)
@@ showPopup() (~164)
-  sessionStorage.setItem('exit_popup_shown', 'true'); // set on VIEW
+  // set suppression only after success/explicit dismiss, not on view
@@ on successful submit
+  sessionStorage.setItem('exit_popup_shown', 'true');
@@ catch (~307)
-  submitBtn.textContent = 'Get Market Updates';
+  submitBtn.textContent = 'Get My Market Update'; // match idle label
+  // persist payload to localStorage for retry on next page-load/online
```

**P0-b — handle-market-report: don't require town; return non-200 on persistence failure**
```diff
--- a/netlify/functions/handle-market-report.ts
+++ b/netlify/functions/handle-market-report.ts
@@ ~85 validation
-  if (!formData.email || !formData.name || !formData.address || !formData.town || !formData.zipcode)
-    return { statusCode: 400, body: 'Missing required fields' };
+  if (!formData.email || !formData.name || !formData.zipcode)
+    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
+  // town/address optional; edge fn derives town from zipcode_data
@@ ~156-166 supabase call
-  } catch (supabaseError) {
-    console.error(supabaseError); // Continue with PDF generation even if Supabase fails
-  }
+  } catch (supabaseError) {
+    console.error('supabase persist failed', { zip: formData.zipcode });
+    await enqueueFailedSubmission(formData);   // durable store (Netlify Blob / failed_submissions)
+    await alertOps('lead-persist-failed');
+    return { statusCode: 502, body: JSON.stringify({ error: 'temporary, please retry' }) };
+  }
@@ ~227-233 final
-  return { statusCode: 200, body: JSON.stringify({ message: 'Your market report is being prepared...' }) };
+  if (!leadPersisted) {
+    await enqueueFailedSubmission(formData); await alertOps('lead-not-confirmed');
+    return { statusCode: 502, body: JSON.stringify({ error: 'temporary, please retry' }) };
+  }
+  return { statusCode: 200, body: JSON.stringify({ message: 'Your market report is being prepared...' }) };
@@ add server-side honeypot
+  if (formData['bot-field']) return { statusCode: 200, body: '{}' }; // silently drop bots
```

**P0-c — wire (or disable) the three unwired Netlify forms** *(pick ONE)*
```diff
# Option A — point forms at the real pipeline (recommended; mirrors popup)
--- a/src/components/MarketReportForm.astro   (also ContactForm.astro, QualificationQuiz.astro)
-  const res = await fetch('/', { method: 'POST', headers: {...}, body: new URLSearchParams(formData) });
+  const res = await fetch('/api/market-report', { method: 'POST', body: new URLSearchParams(formData) });
+  if (!res.ok) throw new Error('submit failed'); // do NOT show success on a bare 200 from '/'
```
```toml
# Option B — if staying on Netlify Forms, commit the bridge (netlify.toml) and document the
# dashboard "form submitted" notification → handle-market-report. Until verified, treat as NO-GO.
```

**P1 — make hot-lead Steven-notification non-silent** (`handle-form-submission/index.ts:681-703`)
```diff
-  } catch (e) { console.error('Failed to send lead notification'); }
+  } catch (e) {
+    for (let i=0;i<2;i++){ try{ await sendLeadNotification(lead); break; }catch{} }
+    await supabase.from('leads').update({ notification_failed: true }).eq('id', lead.id);
+    await alertSecondaryChannel(lead); // SNS / backup SES / webhook
+  }
```

### Lane: Security / PII

**P1 — escape user fields in email templates** (`handle-form-submission/index.ts`)
```diff
+  const esc = (s='') => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
+  const subjName = String(lead.name).replace(/[\r\n]/g,' ').slice(0,80);
-  ...<td>${lead.name}</td><td>${lead.address}</td>...
+  ...<td>${esc(lead.name)}</td><td>${esc(lead.address)}</td>...
```

### Lane: Fair Housing

**P0/P1 — rewrite the 5 P0 + diverse/proxy strings** (`src/data/town-guides.ts`) — apply §4 table
```diff
-  lifestyle: 'Large Jewish community with multiple synagogues. Good parks system. Popular with families.'
+  lifestyle: 'Extensive commercial corridor on Route 18. Multiple houses of worship, community centers, and a strong parks system. Wide range of housing types and amenities.'
-  blurb: '...particularly known for its large South Asian community and excellent dining'
+  blurb: "Edison is one of NJ's most populous townships, named after Thomas Edison, offering a wide range of housing and a renowned, varied dining scene."
-  lifestyle: 'Charming main street... Low crime, family-friendly, and walkable town center.'
+  lifestyle: 'Charming main street with boutique shops and restaurants. Strong historic-preservation ethic and a highly walkable town center.'
   # ...+ Robbinsville (remove "Sikh community"), South Brunswick (remove ethnicity/"families"),
   #    Princeton (remove prestige/educated/international), and all "diverse neighborhoods/community" → "wide range of housing types"
```

**P1 — add NJ license/brokerage + EHO to footer** (`Footer.astro`, `emails/components/Footer.tsx`)
```diff
+  <p class="legal">
+    CENTURY 21 [Brokerage Legal Name], Broker · [Office Address] · [Office Phone]<br/>
+    Steven Frato, NJ Licensed Real Estate Salesperson, License #[NN-NNNNNNN]
+  </p>
+  <img src="/images/equal-housing-opportunity.svg" alt="Equal Housing Opportunity" width="40" height="40"/>
+  <span>Equal Housing Opportunity</span>
```

### Lane: Accessibility

**P1 — gold CTA contrast token ≥4.5:1** (`src/styles/global.css`)
```diff
:root {
-  --c21-gold: #C99C33; /* used as CTA bg with white text = 2.53:1 */
+  --c21-gold: #C99C33;            /* keep for large decorative accents only */
+  --cta-primary: #8A6A12;         /* white text ≈ 5:1 (WCAG AA) */
}
-.btn-primary { background: var(--c21-gold); color:#fff; }
+.btn-primary { background: var(--cta-primary); color:#fff; }
```

**P1 — label/id on calculator islands** (Affordability/Proceeds/HomeValue/Timing)
```diff
-  <label style={...}>Household Annual Income</label>
-  <input type="text" placeholder="$120,000" ... />
+  <label htmlFor="aff-income" style={...}>Household Annual Income</label>
+  <input id="aff-income" type="text" placeholder="$120,000" aria-describedby="aff-income-help" ... />
```

**P1 — visible focus on custom radio cards** (`QualificationQuiz.astro`, `ExitIntentPopup.astro`)
```diff
+  .option-card input:focus-visible + .option-content,
+  .intent-option input:focus-visible + span,
+  .timeline-option input:focus-visible + span {
+    outline: 2px solid var(--cta-primary); outline-offset: 2px;
+  }
```

### Lane: Local SEO

**P1 — stop blocking render-critical assets** (`public/robots.txt`)
```diff
- Disallow: /_astro/
+ Allow: /_astro/
  Disallow: /api/
```

---

*End of report. No source files were modified; all patches above are proposals for review.*
