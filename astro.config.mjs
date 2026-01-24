// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  site: 'https://stevenfrato.com',
  output: 'static',
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

        // About and Contact - medium priority
        if (url.includes('/about') || url.includes('/contact')) {
          return {
            ...item,
            changefreq: 'monthly',
            priority: 0.6,
          };
        }

        // Listings page
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
      filter: (page) => !page.includes('/api/') && !page.includes('/404'),
    }),
  ],
});
