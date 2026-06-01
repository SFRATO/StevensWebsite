/**
 * Town comparison pairs for /market/[county]/compare/[townA]-vs-[townB]/ pages.
 * Hand-curated for meaningful, high-search-volume comparisons within each county.
 */

export interface ComparisonPair {
  county: string;
  countySlug: string;
  townA: string;
  townASlug: string;
  townAZip: string;
  townB: string;
  townBSlug: string;
  townBZip: string;
  pairSlug: string; // used as [comparison] param
}

export const comparisonPairs: ComparisonPair[] = [
  // Burlington County
  {
    county: 'Burlington County',
    countySlug: 'burlington-county',
    townA: 'Marlton',
    townASlug: 'marlton',
    townAZip: '08053',
    townB: 'Mount Laurel',
    townBSlug: 'mount-laurel',
    townBZip: '08054',
    pairSlug: 'marlton-vs-mount-laurel',
  },
  {
    county: 'Burlington County',
    countySlug: 'burlington-county',
    townA: 'Moorestown',
    townASlug: 'moorestown',
    townAZip: '08057',
    townB: 'Cherry Hill',
    townBSlug: 'cherry-hill',
    townBZip: '08002',
    pairSlug: 'moorestown-vs-cherry-hill',
  },
  {
    county: 'Burlington County',
    countySlug: 'burlington-county',
    townA: 'Medford',
    townASlug: 'medford',
    townAZip: '08055',
    townB: 'Marlton',
    townBSlug: 'marlton',
    townBZip: '08053',
    pairSlug: 'medford-vs-marlton',
  },
  {
    county: 'Burlington County',
    countySlug: 'burlington-county',
    townA: 'Mount Laurel',
    townASlug: 'mount-laurel',
    townAZip: '08054',
    townB: 'Moorestown',
    townBSlug: 'moorestown',
    townBZip: '08057',
    pairSlug: 'mount-laurel-vs-moorestown',
  },
  {
    county: 'Burlington County',
    countySlug: 'burlington-county',
    townA: 'Bordentown',
    townASlug: 'bordentown',
    townAZip: '08505',
    townB: 'Burlington',
    townBSlug: 'burlington',
    townBZip: '08016',
    pairSlug: 'bordentown-vs-burlington',
  },
  // Mercer County
  {
    county: 'Mercer County',
    countySlug: 'mercer-county',
    townA: 'Princeton',
    townASlug: 'princeton',
    townAZip: '08540',
    townB: 'Robbinsville',
    townBSlug: 'robbinsville',
    townBZip: '08691',
    pairSlug: 'princeton-vs-robbinsville',
  },
  {
    county: 'Mercer County',
    countySlug: 'mercer-county',
    townA: 'Hamilton',
    townASlug: 'hamilton',
    townAZip: '08610',
    townB: 'Ewing',
    townBSlug: 'ewing',
    townBZip: '08618',
    pairSlug: 'hamilton-vs-ewing',
  },
  {
    county: 'Mercer County',
    countySlug: 'mercer-county',
    townA: 'Robbinsville',
    townASlug: 'robbinsville',
    townAZip: '08691',
    townB: 'East Windsor',
    townBSlug: 'east-windsor',
    townBZip: '08520',
    pairSlug: 'robbinsville-vs-east-windsor',
  },
  {
    county: 'Mercer County',
    countySlug: 'mercer-county',
    townA: 'Princeton',
    townASlug: 'princeton',
    townAZip: '08540',
    townB: 'Lawrence',
    townBSlug: 'lawrence',
    townBZip: '08648',
    pairSlug: 'princeton-vs-lawrence',
  },
  // Middlesex County
  {
    county: 'Middlesex County',
    countySlug: 'middlesex-county',
    townA: 'Edison',
    townASlug: 'edison',
    townAZip: '08817',
    townB: 'East Brunswick',
    townBSlug: 'east-brunswick',
    townBZip: '08816',
    pairSlug: 'edison-vs-east-brunswick',
  },
  {
    county: 'Middlesex County',
    countySlug: 'middlesex-county',
    townA: 'Old Bridge',
    townASlug: 'old-bridge',
    townAZip: '08857',
    townB: 'East Brunswick',
    townBSlug: 'east-brunswick',
    townBZip: '08816',
    pairSlug: 'old-bridge-vs-east-brunswick',
  },
  {
    county: 'Middlesex County',
    countySlug: 'middlesex-county',
    townA: 'South Brunswick',
    townASlug: 'south-brunswick',
    townAZip: '08852',
    townB: 'East Brunswick',
    townBSlug: 'east-brunswick',
    townBZip: '08816',
    pairSlug: 'south-brunswick-vs-east-brunswick',
  },
  {
    county: 'Middlesex County',
    countySlug: 'middlesex-county',
    townA: 'Metuchen',
    townASlug: 'metuchen',
    townAZip: '08840',
    townB: 'Woodbridge',
    townBSlug: 'woodbridge',
    townBZip: '07095',
    pairSlug: 'metuchen-vs-woodbridge',
  },
  {
    county: 'Middlesex County',
    countySlug: 'middlesex-county',
    townA: 'Piscataway',
    townASlug: 'piscataway',
    townAZip: '08854',
    townB: 'Edison',
    townBSlug: 'edison',
    townBZip: '08817',
    pairSlug: 'piscataway-vs-edison',
  },
];
