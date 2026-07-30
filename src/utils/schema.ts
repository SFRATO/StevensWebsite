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
 * Generate Market Data schema for programmatic SEO pages
 */
export function generateMarketDataSchema(data: {
  location: string;
  locationType: 'county' | 'zipcode';
  state: string;
  medianPrice: number | null;
  priceChange: number | null;
  inventory: number | null;
  lastUpdated: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: `${data.location} Real Estate Market Data`,
    description: `Current real estate market statistics for ${data.location}, ${data.state} including median home prices, inventory levels, and market trends.`,
    keywords: [
      `${data.location} real estate`,
      `${data.location} housing market`,
      `${data.location} home prices`,
      `${data.location} homes for sale`,
    ],
    url: `https://stevenfrato.com/market/${data.locationType === 'county' ? data.location.toLowerCase().replace(/\s+/g, '-') : data.location}/`,
    dateModified: data.lastUpdated,
    spatialCoverage: {
      '@type': 'Place',
      name: `${data.location}, ${data.state}`,
      geo: {
        '@type': 'GeoCoordinates',
        // Central NJ coordinates
        latitude: '40.2171',
        longitude: '-74.7429',
      },
    },
    creator: {
      '@type': 'RealEstateAgent',
      name: 'Steven Frato',
      url: 'https://stevenfrato.com',
    },
    distribution: {
      '@type': 'DataDownload',
      contentUrl: `https://stevenfrato.com/market/${data.locationType === 'county' ? data.location.toLowerCase().replace(/\s+/g, '-') : data.location}/`,
      encodingFormat: 'text/html',
    },
    variableMeasured: [
      {
        '@type': 'PropertyValue',
        name: 'Median Sale Price',
        value: data.medianPrice,
        unitCode: 'USD',
      },
      {
        '@type': 'PropertyValue',
        name: 'Year-over-Year Price Change',
        value: data.priceChange,
        unitCode: 'P1',
      },
      {
        '@type': 'PropertyValue',
        name: 'Active Inventory',
        value: data.inventory,
      },
    ],
  };
}

/**
 * Generate SoftwareApplication schema for interactive tool pages
 */
export function generateSoftwareApplicationSchema(tool: {
  name: string;
  description: string;
  url: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: tool.name,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web',
    description: tool.description,
    url: tool.url,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    provider: {
      '@type': 'RealEstateAgent',
      name: 'Steven Frato',
      url: 'https://stevenfrato.com',
    },
  };
}

/**
 * Generate Place schema for town-level market pages
 */
export function generatePlaceSchema(town: string, county: string, state: string, zipcode: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'City',
    name: `${town}, ${state}`,
    containedInPlace: {
      '@type': 'AdministrativeArea',
      name: `${county}, ${state}`,
    },
    postalCode: zipcode,
    addressRegion: state,
    addressCountry: 'US',
  };
}

/**
 * Generate FAQPage schema for market pages
 */
export function generateFAQSchema(faqs: Array<{ question: string; answer: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

/**
 * Generate WebSite schema with SearchAction
 * Enables Google Sitelinks Search Box — a search bar under your homepage result.
 */
export function generateWebsiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Steven Frato — Century 21 NJ Real Estate',
    url: 'https://stevenfrato.com',
    description: 'NJ real estate market data, free calculators, and expert guidance for buyers and sellers in Burlington, Mercer, and Middlesex Counties.',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://stevenfrato.com/market/?q={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
    publisher: {
      '@type': 'RealEstateAgent',
      name: 'Steven Frato',
      url: 'https://stevenfrato.com',
    },
  };
}

/**
 * Generate HowTo schema for step-by-step process pages.
 * Example: "How to sell your house in NJ", "How to buy a home in Burlington County"
 * Shows numbered steps directly in Google search results.
 */
export function generateHowToSchema(data: {
  name: string;
  description: string;
  totalTime?: string; // ISO 8601 duration, e.g. "P30D" for 30 days
  steps: Array<{ name: string; text: string; url?: string }>;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: data.name,
    description: data.description,
    ...(data.totalTime && { totalTime: data.totalTime }),
    step: data.steps.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.name,
      text: step.text,
      ...(step.url && { url: step.url }),
    })),
    author: {
      '@type': 'RealEstateAgent',
      name: 'Steven Frato',
      url: 'https://stevenfrato.com',
    },
  };
}

/**
 * Helper to stringify schema for <script type="application/ld+json">
 */
export function stringifySchema(schema: any): string {
  return JSON.stringify(schema, null, 2);
}
