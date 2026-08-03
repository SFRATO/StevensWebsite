# CLAUDE.md - Project Context for AI Assistants

This file provides context for AI assistants (like Claude) working on this codebase.

## Project Overview

This is a real estate website for Steven Frato, a Century 21 agent in New Jersey. The site focuses on seller-focused programmatic SEO with automated market data pages, lead capture, and email nurturing.

## Architecture

### Core Stack

- **Astro 5** - Static site generator with islands architecture
- **TypeScript** - Type safety throughout
- **React** - Used for email templates and interactive components
- **Netlify** - Hosting, functions, and form handling

### Key Directories

```
src/
├── components/     # Astro components (.astro files)
├── emails/         # React Email templates (.tsx files)
├── layouts/        # BaseLayout.astro (all pages use this)
├── pages/          # File-based routing
│   └── market/     # Programmatic SEO pages
├── styles/         # CSS variables and global styles
└── utils/          # SEO helpers and schema generators

data/
├── scripts/        # TypeScript data processing
│   ├── fetch-data.ts      # Downloads Redfin TSV files
│   ├── process-data.ts    # Filters for NJ, transforms to JSON
│   └── generate-insights.ts  # Claude API for market commentary
└── processed/      # Output JSON files (counties.json, zipcodes.json)

netlify/functions/  # Serverless functions for form handling
```

### Data Flow

1. **Data Fetch** (`data:fetch`): Downloads county and zip code market data from Redfin
2. **Data Process** (`data:process`): Filters for NJ target areas, computes metrics
3. **AI Insights** (`data:insights`): Generates unique market commentary per location
4. **Page Generation**: Astro reads JSON and generates static pages at build time

### Page Types

| Route Pattern | Template | Data Source |
|---------------|----------|-------------|
| `/market/` | `market/index.astro` | All counties |
| `/market/[county]/` | `market/[county].astro` | Single county + child zips |
| `/market/[zipcode]/` | `market/[zipcode].astro` | Single zip + nearby zips |

## Code Patterns

### Component Convention

- Astro components for static content
- React components only for interactive islands or email templates
- CSS scoped in `<style>` blocks, using CSS variables from `variables.css`

### Path Aliases

```typescript
import Component from '@components/Component.astro';
import { utility } from '@utils/seo';
import Layout from '@layouts/BaseLayout.astro';
import data from '@data/processed/counties.json';
```

### Schema.org Markup

All pages should include appropriate schema markup via the `schema` prop on `BaseLayout`:

```astro
<BaseLayout title="..." description="..." schema={schemaObject}>
```

Available schema generators in `src/utils/schema.ts`:
- `generateRealEstateAgentSchema()`
- `generateLocalBusinessSchema()`
- `generateMarketDataSchema()`
- `generateBreadcrumbSchema()`
- `generateListingSchema()`

### Market Data Types

```typescript
interface CountyData {
  region: string;
  slug: string;
  median_sale_price: number | null;
  median_sale_price_yoy: number | null;
  inventory: number | null;
  months_of_supply: number | null;
  median_dom: number | null;
  market_type: 'seller' | 'buyer' | 'balanced';
  ai_insight?: string;
}

interface ZipData {
  zipcode: string;
  city: string;
  county: string;
  nearby_zips: string[];
  // ... same metrics as CountyData
}
```

## Styling System

### CSS Variables (from `variables.css`)

```css
/* Colors - Century 21 Brand */
--c21-gold: #C99C33
--c21-gold-dark: #B38A1F
--charcoal: #1a1a1a

/* Spacing Scale */
--space-1 through --space-16

/* Typography */
--text-xs through --text-4xl
--font-heading: 'Playfair Display'
--font-body: 'Inter'
```

### Component Styling Pattern

```astro
<style>
  .component {
    padding: var(--space-6);
    color: var(--text-primary);
    font-size: var(--text-base);
  }
</style>
```

## Email System

### React Email Templates

Located in `src/emails/templates/`. Each template:
- Imports shared components (Header, Footer, Button)
- Accepts props for personalization (location, recipient name)
- Uses inline styles (email client compatibility)

### Email Sequence

5 emails over 14 days, triggered by form submission:
1. Day 0: Welcome + PDF delivery
2. Day 3: Market deep dive
3. Day 7: Pricing strategy
4. Day 11: Preparation tips
5. Day 14: Consultation CTA

## Netlify Functions

### Form Handling

Forms use Netlify Forms with a serverless function handler:
- Form submits to Netlify Forms (built-in)
- `handle-market-report.ts` processes submission
- `generate-pdf.ts` creates personalized market report PDF
- `trigger-email-sequence.ts` sends welcome email via Amazon SES and initiates the 5-email drip campaign
- `unsubscribe.ts` proxies to the Supabase `unsubscribe` edge function. It exists because every email links to `/.netlify/functions/unsubscribe` and no such Netlify function existed — do not delete it or every unsubscribe link 404s again.
- `track-activity.ts` (`/api/track`) records per-lead page views; requires a valid signed visitor token.

**Repeat submissions update, they don't duplicate.** `handle-form-submission` branches on an existing lead: within 30 minutes with `qualify=1` it is popup step 2 completing the same signup (updates fields, re-campaigns if the intent changed, no second agent notification); otherwise it is a returning lead (updates fields, logs a `resubmit` activity row, **notifies Steven**). Unsubscribed/bounced leads are updated but never re-enrolled.

### Function Pattern

```typescript
import type { Handler } from "@netlify/functions";

const handler: Handler = async (event, context) => {
  // Parse request
  // Process data
  // Return response
  return {
    statusCode: 200,
    body: JSON.stringify({ success: true }),
  };
};

export { handler };
```

## Common Tasks

### Adding a New County

1. Edit `COUNTY_ZIPS` in `data/scripts/process-data.ts`
2. Add county name to `TARGET_COUNTIES` array
3. Run `npm run data:all`
4. Pages auto-generate

### Modifying Market Card Display

Edit `src/components/MarketCard.astro`. The component accepts:
- `label`: Metric name
- `value`: Display value
- `change`: YoY change (triggers trend indicator)
- `icon`: 'price' | 'inventory' | 'time' | 'sale'

### Adding Email Template

1. Create new `.tsx` in `src/emails/templates/`
2. Import shared components
3. Export React component with props interface
4. Add to sequence in `trigger-email-sequence.ts`

## Testing

### Local Development

```bash
npm run dev      # Start dev server at localhost:4321
npm run build    # Full production build
npm run preview  # Preview production build
```

### Data Pipeline Testing

```bash
npm run data:fetch    # Test Redfin download
npm run data:process  # Test JSON generation
# Check data/processed/*.json for output
```

## Environment Variables

Required for full functionality:

| Variable | Purpose | Required For |
|----------|---------|--------------|
| `ANTHROPIC_API_KEY` | AI insight generation | `data:insights` |
| `AWS_ACCESS_KEY_ID` | AWS authentication | Email sending |
| `AWS_SECRET_ACCESS_KEY` | AWS authentication | Email sending |
| `AWS_REGION` | AWS region (default: us-east-1) | Email sending |
| `SES_SENDER_EMAIL` | Verified sender email | Email sending |
| `NETLIFY_BUILD_HOOK` | Auto-rebuild trigger | GitHub Actions |
| `PUBLIC_GA4_ID` | GA4 Measurement ID (optional; injected only after cookie consent) | Analytics |
| `PUBLIC_ANALYTICS_DEBUG` | `true` to enable + log analytics in `npm run dev` | Analytics (local) |
| `SYNC_SECRET` | Auth token for `sync-zipcode-data` function | Email personalization |
| `SUPABASE_URL` | Supabase project URL | Lead pipeline |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key | Lead pipeline |
| `LEAD_TOKEN_SECRET` | HMAC secret for unsubscribe + visitor tokens | Unsubscribe, behavior tracking |

**`LEAD_TOKEN_SECRET` must be identical** in the Netlify env and the Supabase edge-function env — tokens minted by one are verified by the other. Generate with `openssl rand -base64 48`.

**Note**: The `SES_SENDER_EMAIL` must be verified in Amazon SES console before sending emails.

**After each `npm run data:all`**, also sync the Supabase zipcode table so email personalization reflects fresh data:
```bash
curl -X POST https://stevenfrato.com/.netlify/functions/sync-zipcode-data \
  -H "X-Sync-Secret: $SYNC_SECRET"
```

## Consent, Lead Identity & Behavior Tracking

The funnel is: **accept cookies → submit email → lead in Supabase → on-site behavior recorded → behavior-triggered follow-up emails.**

### Consent (`src/utils/consent.ts` + `CookieConsent.astro`)

Opt-in gate, mounted once in `BaseLayout`:
- Matomo boots with `_paq.push(['requireCookieConsent'])` **before** the MTM container. It tracks *cookieless* (pageviews count, no visitor cookie) until accept, then `rememberCookieConsentGiven`. Deliberately **not** `requireConsent`, which would suppress tracking entirely.
- GA4 is **never** in the static head. `consent.ts` injects `gtag.js` on grant only.
- Decision stored in localStorage `sf_consent_v1` + mirrored to the `sf_consent` cookie. `/privacy/` has a "Change cookie preferences" button that calls `resetConsent()`.
- The exit popup will not fire while the banner is up (`getConsent() === null` guard in `showPopup()`).

### Signed lead tokens

One HMAC secret (`LEAD_TOKEN_SECRET`) backs two token purposes, implemented twice — keep these in sync:
- `supabase/functions/_shared/tokens.ts` (Deno, WebCrypto)
- `netlify/functions/_shared/tokens.ts` (Node, `node:crypto`)

Format `base64url(leadId).base64url(hmac("<purpose>:<payload>"))`. Purposes: `unsubscribe`, `visitor`. **The raw lead UUID never reaches the browser.** `verifyToken(..., allowLegacy=true)` still accepts the old unsigned `btoa(leadId:ts)` unsubscribe tokens so already-delivered emails keep working — drop that once the oldest campaign ages out.

### Lead identity (`src/utils/leadIdentity.ts`)

On a successful submit the server returns `lead_token`. Storage depends on consent: **granted** → `sf_lead` cookie (1 year, recognised across visits); **declined** → `sessionStorage` only. Also sets Matomo User ID to `SHA-256(lowercased email)`, consent-gated.

### Behavior tracking

`src/utils/leadActivity.ts` beacons page views to `/api/track` → `netlify/functions/track-activity.ts` → `lead_activity`. It **no-ops unless consent is granted AND a lead token exists** — anonymous visitors are never recorded. Geography comes from the `sf:town` / `sf:zip` / `sf:county` meta tags `BaseLayout` emits (so `zipcodes.json` never ships to the browser). Tool islands call `trackActivity('tool_use', { tool })` — tool identity only, never the figures entered.

`process-behavior-triggers` (daily 11am ET, an hour after the drip) → `send-behavior-triggers` edge function. Rules live in the `behavior_triggers` table: `town_repeat`, `tool_completed`, `high_intent_return` (agent alert only), `dormant_return`. Four suppression rules, all enforced before any send: lead must be `active`; max one behavior email per lead per 7 days; never on a day the drip has something queued/sent; per-trigger per-subject cooldown.

**Not buildable, don't try:** tracking what a lead searches on other websites. Third-party cookie restrictions ended cross-site individual tracking. The legitimate off-site option is ad-platform retargeting audiences (Meta/Google), where the network does the targeting and we never see individual browsing.

## Analytics

Matomo is loaded site-wide via the **Matomo Tag Manager** container snippet in `BaseLayout.astro` (container `YLdIYnl6` @ `analytics.gavinrozzi.com`, **idSite 27**), gated by the consent module above. Custom events are authored in code through the single helper `src/utils/analytics.ts`:

- `trackEvent(category, action, name?, value?)` — dual-dispatches to Matomo (`_paq`) and GA4 (`gtag`, only if `PUBLIC_GA4_ID` set). Categories: `Lead | Contact | Engagement | Navigation`. Tool interactions use `Engagement` for step/result events and `Lead` for CTA clicks.
- `trackSiteSearch(keyword, category?, count?)` — Matomo Site Search (used by the town/zip autocompletes).
- `initPageviewTracking()` — fires virtual pageviews on Astro `astro:after-swap` (view transitions don't auto-track). Called once in `BaseLayout`.
- `initLinkTracking()` — one delegated `document` listener that tracks ALL `tel:`/`mailto:` clicks site-wide, labeled by location (Header/Footer/Sticky CTA/Hero/Body). Called once in `BaseLayout`; do NOT add per-component phone/email handlers.

**Conventions**:
- Component `<script>` handlers bind on `astro:page-load` (NOT `DOMContentLoaded`, which doesn't re-fire under `<ViewTransitions />`) and guard against double-binding with a `dataset.bound` flag.
- Tracking is production-only unless `PUBLIC_ANALYTICS_DEBUG=true`.
- **Goals** are matched on event Actions in the Matomo UI (idSite 27) — see the integration plan; they must be created manually (no goal-create API).

## Page Architecture (357 pages total)

| Route pattern | Count | Notes |
|---|---|---|
| `/market/[county]/` | 3 | County hubs — link to town grid, price ranges, comparisons |
| `/market/[zipcode]/` | 97 | ZIP pages — canonical → town page when 1:1 mapping |
| `/market/[county]/[townSlug]/` | ~130 | **Primary SEO targets** — town-name queries |
| `/market/[county]/price/[priceRange]/` | ~12 | Buyer-intent price-range pages |
| `/market/[county]/compare/[pair]/` | 14 | Decision-stage comparison pages |
| `/home-value/[townSlug]/` | ~130 | Seller-intent conversion pages (form above fold) |
| `/home-value/` | 1 | Hub page listing all towns |
| `/tools/` + 4 tool pages | 5 | Interactive tools (estimator, timing, proceeds, affordability) |
| `/moving-to/[townSlug]/` | 18 | Informational moving guides |
| `/moving-to/` | 1 | Moving guides hub |
| Static pages | ~8 | Home, about, contact, areas, market hub, listings, thank-you, privacy |

**Key data files:**
- `src/data/town-mappings.ts` — 130+ town→zip mappings; helpers: `getTownSlug()`, `getTownsByCountySlug()`, `getPrimaryZipForTown()`
- `src/data/comparisons.ts` — 14 hand-curated town comparison pairs
- `src/data/town-guides.ts` — content for 18 moving guide towns
- `src/utils/toolsCalc.ts` — pure calculation functions for all 4 tools

## Gotchas

1. **Static Generation**: Pages are built at build time. Data changes require rebuild + zipcode sync.
2. **Netlify Functions**: Use esbuild bundler (configured in `netlify.toml`). `process-email-queue.ts` is a Scheduled Function (v2 API).
3. **React Email**: Uses inline styles only - no external CSS
4. **Data Files**: Raw TSV files are gitignored; processed JSON is committed
5. **Market Types**: Determined by months of supply (<4 = seller, >6 = buyer)
6. **No fake testimonials**: `TestimonialCard.astro` exists but only use with real client quotes Steven provides.
7. **Town page routing**: All town cards/links use `/market/[county-slug]/[town-slug]/` — NOT `/market/[zipcode]/`. `TownPreviewCard`, `TownSearchIsland`, and `Footer` are all updated to use this pattern.

## File Naming Conventions

- Components: PascalCase (`MarketCard.astro`)
- Pages: kebab-case or [param] (`[county].astro`)
- Utils: camelCase (`seo.ts`, `schema.ts`)
- Email templates: numbered prefix (`1-welcome-report.tsx`)
