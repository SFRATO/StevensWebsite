/**
 * Schema.org Structured Data Generators
 * Generate JSON-LD markup for SEO enhancement
 */

/**
 * Generate RealEstateAgent schema
 */
export function generateRealEstateAgentSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    name: 'Steven Frato',
    image: 'https://stevenfrato.com/images/headshot.jpg',
    telephone: '+1-609-789-0126',
    email: 'sf@stevenfrato.com',
    address: {
      '@type': 'PostalAddress',
      streetAddress: '136 Farnsworth Ave',
      addressLocality: 'Bordentown',
      addressRegion: 'NJ',
      postalCode: '08505',
      addressCountry: 'US',
    },
    areaServed: [
      {
        '@type': 'City',
        name: 'Burlington County, NJ',
      },
      {
        '@type': 'City',
        name: 'Mercer County, NJ',
      },
      {
        '@type': 'City',
        name: 'Middlesex County, NJ',
      },
    ],
    memberOf: {
      '@type': 'Organization',
      name: 'Century 21',
    },
    knowsAbout: ['Residential Real Estate', 'First-Time Homebuyers', 'Property Investment'],
    url: 'https://stevenfrato.com',
    sameAs: [
      'https://www.linkedin.com/in/steven-frato/',
      // Add Facebook, Instagram, etc. when available
    ],
  };
}

/**
 * Generate LocalBusiness schema
 */
export function generateLocalBusinessSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: 'Steven Frato - Century 21',
    image: 'https://stevenfrato.com/images/headshot.jpg',
    '@id': 'https://stevenfrato.com',
    url: 'https://stevenfrato.com',
    telephone: '+1-609-789-0126',
    priceRange: '$$',
    address: {
      '@type': 'PostalAddress',
      streetAddress: '136 Farnsworth Ave',
      addressLocality: 'Bordentown',
      addressRegion: 'NJ',
      postalCode: '08505',
      addressCountry: 'US',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: '40.0583',
      longitude: '-74.4057',
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '09:00',
        closes: '18:00',
      },
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: 'Saturday',
        opens: '10:00',
        closes: '16:00',
      },
    ],
    sameAs: [
      'https://www.linkedin.com/in/steven-frato/',
    ],
  };
}

/**
 * Generate Property Listing schema
 */
export function generateListingSchema(listing: {
  title: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  description: string;
  images: string[];
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SingleFamilyResidence',
    name: listing.title,
    address: {
      '@type': 'PostalAddress',
      streetAddress: listing.address,
      addressLocality: listing.city,
      addressRegion: listing.state,
      postalCode: listing.zipCode,
      addressCountry: 'US',
    },
    numberOfRooms: listing.beds,
    numberOfBathroomsTotal: listing.baths,
    floorSize: {
      '@type': 'QuantitativeValue',
      value: listing.sqft,
      unitCode: 'FTK', // Square feet
    },
    description: listing.description,
    image: listing.images,
    offers: {
      '@type': 'Offer',
      price: listing.price,
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      seller: {
        '@type': 'RealEstateAgent',
        name: 'Steven Frato',
      },
    },
  };
}

/**
 * Generate Person schema
 */
export function generatePersonSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: 'Steven Frato',
    jobTitle: 'Real Estate Agent',
    worksFor: {
      '@type': 'Organization',
      name: 'Century 21',
    },
    url: 'https://stevenfrato.com',
    image: 'https://stevenfrato.com/images/headshot.jpg',
    sameAs: [
      'https://www.linkedin.com/in/steven-frato/',
    ],
    alumniOf: {
      '@type': 'EducationalOrganization',
      name: 'Stockton University',
    },
  };
}

/**
 * Generate Breadcrumb schema
 */
export function generateBreadcrumbSchema(breadcrumbs: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  };
}

/**
 * Generate Organization schema
 */
export function generateOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Steven Frato - Century 21',
    url: 'https://stevenfrato.com',
    logo: 'https://stevenfrato.com/images/century21-logo.svg',
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+1-609-789-0126',
      contactType: 'customer service',
      areaServed: 'US-NJ',
      availableLanguage: 'English',
    },
    sameAs: [
      'https://www.linkedin.com/in/steven-frato/',
    ],
  };
}

/**
 * Helper to stringify schema for <script type="application/ld+json">
 */
export function stringifySchema(schema: any): string {
  return JSON.stringify(schema, null, 2);
}
