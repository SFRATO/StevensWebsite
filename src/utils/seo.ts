/**
 * SEO Utility Functions
 * Helpers for generating consistent SEO meta tags across the site
 */

export interface SEOProps {
  title: string;
  description: string;
  ogImage?: string;
  noindex?: boolean;
  canonical?: string;
}

/**
 * Generate full page title with site branding
 */
export function generateTitle(title: string, includeBrand: boolean = true): string {
  const brandSuffix = ' | Steven Frato - Century 21';
  return includeBrand ? `${title}${brandSuffix}` : title;
}

/**
 * Generate SEO-optimized meta description
 * Truncates to 160 characters for optimal search display
 */
export function generateDescription(description: string): string {
  const maxLength = 160;
  if (description.length <= maxLength) {
    return description;
  }
  return description.substring(0, maxLength - 3) + '...';
}

/**
 * Generate canonical URL
 */
export function generateCanonicalUrl(path: string, siteUrl: string = 'https://stevenfrato.com'): string {
  // Remove trailing slash from siteUrl if present
  const baseSite = siteUrl.replace(/\/$/, '');
  // Ensure path starts with /
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseSite}${cleanPath}`;
}

/**
 * Generate Open Graph tags object
 */
export function generateOpenGraphTags(
  title: string,
  description: string,
  ogImage?: string,
  type: string = 'website',
  url?: string
) {
  return {
    'og:type': type,
    'og:title': title,
    'og:description': description,
    'og:image': ogImage || '/images/og-default.jpg',
    'og:url': url || '',
  };
}

/**
 * Generate Twitter Card tags object
 */
export function generateTwitterCardTags(
  title: string,
  description: string,
  image?: string
) {
  return {
    'twitter:card': 'summary_large_image',
    'twitter:title': title,
    'twitter:description': description,
    'twitter:image': image || '/images/og-default.jpg',
  };
}

/**
 * Generate robots meta tag value
 */
export function generateRobotsTag(noindex: boolean = false): string {
  return noindex ? 'noindex, nofollow' : 'index, follow';
}

/**
 * Generate geo-targeting meta tags for NJ real estate
 */
export function generateGeoTags() {
  return {
    'geo.region': 'US-NJ',
    'geo.placename': 'Burlington County',
    'geo.position': '40.0583;-74.4057', // Burlington County coordinates
  };
}

/**
 * Extract keywords from content for meta keywords (optional, less important for modern SEO)
 */
export function generateKeywords(customKeywords?: string[]): string {
  const defaultKeywords = [
    'real estate agent',
    'Burlington County NJ',
    'Mercer County NJ',
    'Middlesex County NJ',
    'first time homebuyer',
    'Century 21',
    'homes for sale',
    'Steven Frato',
  ];

  const keywords = customKeywords ? [...defaultKeywords, ...customKeywords] : defaultKeywords;
  return keywords.join(', ');
}
