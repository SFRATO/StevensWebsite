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

7 emails over 21 days, triggered by form submission:
1. Day 0: Welcome + PDF delivery
2. Day 3: Market deep dive
3. Day 7: Pricing strategy
4. Day 11: Case study
5. Day 15: Preparation tips
6. Day 18: Testimonials
7. Day 21: Consultation CTA

## Netlify Functions

### Form Handling

Forms use Netlify Forms with a serverless function handler:
- Form submits to Netlify Forms (built-in)
- `handle-market-report.ts` processes submission
- Triggers PDF generation and email sequence

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
| `RESEND_API_KEY` | Email sending | Lead nurturing |
| `NETLIFY_BUILD_HOOK` | Auto-rebuild trigger | GitHub Actions |

## Gotchas

1. **Static Generation**: Pages are built at build time. Data changes require rebuild.
2. **Netlify Functions**: Use esbuild bundler (configured in `netlify.toml`)
3. **React Email**: Uses inline styles only - no external CSS
4. **Data Files**: Raw TSV files are gitignored; processed JSON is committed
5. **Market Types**: Determined by months of supply (<4 = seller, >6 = buyer)

## File Naming Conventions

- Components: PascalCase (`MarketCard.astro`)
- Pages: kebab-case or [param] (`[county].astro`)
- Utils: camelCase (`seo.ts`, `schema.ts`)
- Email templates: numbered prefix (`1-welcome-report.tsx`)
