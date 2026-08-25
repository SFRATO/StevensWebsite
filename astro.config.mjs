// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import netlify from '@astrojs/netlify';

// https://astro.build/config
export default defineConfig({
  site: 'https://stevenfrato.com',
  // DO NOT change this to 'server'. In Astro 5 `output: 'hybrid'` was removed and
  // `static` + an adapter behaves exactly the way hybrid used to: everything
  // prerenders by default and a route opts out with `export const prerender = false`.
  // Switching to 'server' inverts that default and would require adding
  // `prerender = true` to ~40 page files, putting all 357 marketing pages at risk.
  // Only /admin/* is rendered on demand.
  output: 'static',
  adapter: netlify({
    edgeMiddleware: false,     // middleware runs inside the Node SSR function
    cacheOnDemandPages: false, // never let the CDN cache an authenticated /admin response
    imageCDN: false,           // no astro:assets in src/; keep the adapter out of images
  }),
  integrations: [
    react(),
    sitemap({
      // Custom serialization for Google Search Console optimization
      serialize(item) {
        const url = item.url;

        // Home page - highest priority
        if (url === 'https://stevenfrato.com/' || url === 'https://stevenfrato.com') {
          return {
            ...item,
            changefreq: 'weekly',
            priority: 1.0,
          };
        }

        // Market hub page - high priority
        if (url.endsWith('/market/') || url.endsWith('/market')) {
          return {
            ...item,
            changefreq: 'weekly',
            priority: 0.9,
          };
        }

        // County market pages - high priority (main SEO targets)
        if (url.match(/\/market\/[a-z]+-county\/?$/)) {
          return {
            ...item,
            changefreq: 'weekly',
            priority: 0.8,
          };
        }

        // Zip code market pages - medium-high priority (programmatic SEO)
        if (url.match(/\/market\/\d{5}\/?$/)) {
          return {
            ...item,
            changefreq: 'monthly',
            priority: 0.7,
          };
        }

        // Town-level market pages — highest SEO value (captures town-name queries)
        if (url.match(/\/market\/[a-z]+-county\/[a-z0-9-]+\/?$/) && !url.includes('/price/')) {
          return {
            ...item,
            changefreq: 'monthly',
            priority: 0.85,
          };
        }

        // Home value conversion pages — high commercial intent
        if (url.includes('/home-value/')) {
          return {
            ...item,
            changefreq: 'weekly',
            priority: 0.75,
          };
        }

        // Tools pages — high intent searches
        if (url.includes('/tools/')) {
          return {
            ...item,
            changefreq: 'monthly',
            priority: 0.75,
          };
        }

        // Moving guides — informational intent
        if (url.includes('/moving-to/')) {
          return {
            ...item,
            changefreq: 'monthly',
            priority: 0.60,
          };
        }

        // Price-range pages — buyer intent
        if (url.includes('/price/')) {
          return {
            ...item,
            changefreq: 'monthly',
            priority: 0.70,
          };
        }

        // About and Contact - medium priority
        if (url.includes('/about') || url.includes('/contact')) {
          return {
            ...item,
            changefreq: 'monthly',
            priority: 0.6,
          };
        }

        // Listings — index and each single-property page. These are now real,
        // indexable pages; previously /listings carried an unconditional noindex
        // while still being advertised here at priority 0.7.
        if (url.includes('/listings')) {
          return {
            ...item,
            changefreq: 'weekly',
            priority: 0.7,
          };
        }

        // Default for other pages
        return {
          ...item,
          changefreq: 'monthly',
          priority: 0.5,
        };
      },
      // Filter out any unwanted pages
      filter: (page) =>
        !page.includes('/api/') &&
        !page.includes('/404') &&
        // /admin is on-demand so it cannot be emitted anyway; this guards against
        // someone later flipping a prerender flag.
        !page.includes('/admin'),
    }),
  ],
});
