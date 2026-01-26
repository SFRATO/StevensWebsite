# Steven Frato Real Estate Website

A modern, SEO-optimized real estate website for Steven Frato, Century 21 agent serving Burlington, Mercer, and Middlesex Counties in New Jersey.

Built with [Astro](https://astro.build) for optimal performance and SEO.

## Features

- **Programmatic SEO Pages** - Automated market data pages for counties and zip codes
- **Lead Capture System** - Gated market reports with PDF generation
- **Email Drip Campaign** - 5-email nurture sequence for leads
- **Automated Data Pipeline** - Monthly market data updates via GitHub Actions
- **Schema.org Markup** - Rich structured data for search engines
- **Responsive Design** - Mobile-first Century 21 branded design

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
├── src/
│   ├── components/        # Reusable Astro components
│   ├── emails/           # React Email templates for drip campaign
│   │   ├── components/   # Email component library
│   │   └── templates/    # 7 email sequence templates
│   ├── layouts/          # Page layouts
│   ├── pages/            # Static and dynamic pages
│   │   └── market/       # Programmatic SEO pages
│   ├── styles/           # Global CSS and design tokens
│   └── utils/            # Utility functions (SEO, schema)
├── data/
│   ├── scripts/          # Data processing scripts
│   ├── raw/              # Raw Redfin data (gitignored)
│   └── processed/        # Processed JSON market data
├── netlify/
│   └── functions/        # Serverless functions
├── public/               # Static assets
└── .github/
    └── workflows/        # GitHub Actions automation
```

## Market Data Pages

The site generates programmatic SEO pages for:

- **3 County Pages**: Burlington, Mercer, Middlesex
- **80+ Zip Code Pages**: All zip codes within target counties

### URL Structure

```
/market/                    # Hub page (NJ market overview)
/market/burlington-county/  # County pages
/market/mercer-county/
/market/middlesex-county/
/market/08054/              # Zip code pages
/market/08540/
```

### Data Pipeline

```bash
# Fetch raw data from Redfin
npm run data:fetch

# Process and filter for NJ
npm run data:process

# Generate AI insights (requires ANTHROPIC_API_KEY)
npm run data:insights

# Run all data tasks
npm run data:all
```

## Environment Variables

Create a `.env` file with:

```env
# Required for AI insight generation
ANTHROPIC_API_KEY=your_key_here

# Required for email sending (Amazon SES)
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_REGION=us-east-1
SES_SENDER_EMAIL=reports@stevenfrato.com

# Netlify build hook (for GitHub Actions)
NETLIFY_BUILD_HOOK=your_hook_url
```

**Note**: The sender email must be verified in Amazon SES before sending.

## Lead Capture Flow

1. User visits market page (e.g., `/market/08054/`)
2. User fills out Market Report Form
3. Netlify Function handles submission
4. PDF report is generated
5. 5-email drip campaign is triggered via Amazon SES

### Email Sequence

| Day | Email | Subject |
|-----|-------|---------|
| 0 | Welcome + Report | "Your [Location] Market Report is Ready" |
| 3 | Market Analysis | "What [Location]'s Market Data Means for You" |
| 7 | Pricing Strategy | "How to Price Your Home in Today's Market" |
| 11 | Buyer Trends | "5 Things Buyers Are Looking For" |
| 14 | Consultation CTA | "Ready to Discuss Your Options?" |

## Automation

Market data updates automatically on the 1st of each month via GitHub Actions:

1. Fetches latest Redfin data
2. Processes for NJ counties/zips
3. Generates AI insights
4. Commits changes
5. Triggers Netlify rebuild

Manual trigger available in GitHub Actions UI.

## Tech Stack

- **Framework**: Astro 5
- **Styling**: CSS Variables + Scoped Styles
- **Email**: React Email + Amazon SES
- **Functions**: Netlify Functions
- **Automation**: GitHub Actions
- **Data Source**: Redfin Data Center

## Development

### Adding a New Market Page

1. Add county/zip to `data/scripts/process-data.ts`
2. Run `npm run data:all`
3. Pages are auto-generated from JSON data

### Modifying Email Templates

Email templates are in `src/emails/templates/`. They use React Email components and can be previewed locally.

### Updating Design Tokens

Design tokens are in `src/styles/variables.css`. The site uses Century 21 brand colors.

## Deployment

The site is configured for Netlify deployment:

```bash
npm run build
```

Build output goes to `dist/`. Netlify Functions are in `netlify/functions/`.

## License

Private - All rights reserved.
