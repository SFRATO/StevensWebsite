/**
 * Town to Zipcode Mappings
 * Human-curated mapping of town names to zip codes for programmatic SEO pages.
 * Extracted for reuse across areas page, search, and analytics.
 */

export interface TownMapping {
  name: string;
  zipcode: string;
}

export interface ServiceAreas {
  [county: string]: TownMapping[];
}

export const serviceAreas: ServiceAreas = {
  'Burlington County': [
    { name: 'Beverly', zipcode: '08010' },
    { name: 'Bordentown', zipcode: '08505' },
    { name: 'Browns Mills', zipcode: '08015' },
    { name: 'Burlington', zipcode: '08016' },
    { name: 'Cherry Hill', zipcode: '08002' },
    { name: 'Cinnaminson', zipcode: '08077' },
    { name: 'Delran', zipcode: '08075' },
    { name: 'Eastampton', zipcode: '08060' },
    { name: 'Edgewater Park', zipcode: '08010' },
    { name: 'Evesham', zipcode: '08053' },
    { name: 'Florence', zipcode: '08518' },
    { name: 'Hainesport', zipcode: '08036' },
    { name: 'Lumberton', zipcode: '08048' },
    { name: 'Maple Shade', zipcode: '08052' },
    { name: 'Marlton', zipcode: '08053' },
    { name: 'Medford', zipcode: '08055' },
    { name: 'Medford Lakes', zipcode: '08055' },
    { name: 'Moorestown', zipcode: '08057' },
    { name: 'Mount Holly', zipcode: '08060' },
    { name: 'Mount Laurel', zipcode: '08054' },
    { name: 'Palmyra', zipcode: '08065' },
    { name: 'Pemberton', zipcode: '08068' },
    { name: 'Riverside', zipcode: '08075' },
    { name: 'Riverton', zipcode: '08077' },
    { name: 'Shamong', zipcode: '08088' },
    { name: 'Southampton', zipcode: '08088' },
    { name: 'Tabernacle', zipcode: '08088' },
    { name: 'Westampton', zipcode: '08060' },
    { name: 'Willingboro', zipcode: '08046' },
    { name: 'Woodland Township', zipcode: '08019' },
  ],
  'Mercer County': [
    { name: 'East Windsor', zipcode: '08520' },
    { name: 'Ewing', zipcode: '08618' },
    { name: 'Hamilton', zipcode: '08610' },
    { name: 'Hightstown', zipcode: '08520' },
    { name: 'Lawrence', zipcode: '08648' },
    { name: 'Pennington', zipcode: '08534' },
    { name: 'Princeton', zipcode: '08540' },
    { name: 'Princeton Junction', zipcode: '08550' },
    { name: 'Robbinsville', zipcode: '08691' },
    { name: 'Trenton', zipcode: '08608' },
    { name: 'West Windsor', zipcode: '08550' },
  ],
  'Middlesex County': [
    { name: 'Colonia', zipcode: '07067' },
    { name: 'Cranbury', zipcode: '08512' },
    { name: 'Dunellen', zipcode: '08812' },
    { name: 'East Brunswick', zipcode: '08816' },
    { name: 'Edison', zipcode: '08817' },
    { name: 'Helmetta', zipcode: '08828' },
    { name: 'Highland Park', zipcode: '08904' },
    { name: 'Iselin', zipcode: '08830' },
    { name: 'Jamesburg', zipcode: '08831' },
    { name: 'Metuchen', zipcode: '08840' },
    { name: 'Middlesex', zipcode: '08846' },
    { name: 'Milltown', zipcode: '08850' },
    { name: 'Monroe Township', zipcode: '08831' },
    { name: 'New Brunswick', zipcode: '08901' },
    { name: 'North Brunswick', zipcode: '08902' },
    { name: 'Old Bridge', zipcode: '08857' },
    { name: 'Perth Amboy', zipcode: '08861' },
    { name: 'Piscataway', zipcode: '08854' },
    { name: 'Plainsboro', zipcode: '08536' },
    { name: 'Sayreville', zipcode: '08872' },
    { name: 'South Amboy', zipcode: '08879' },
    { name: 'South Brunswick', zipcode: '08852' },
    { name: 'South Plainfield', zipcode: '07080' },
    { name: 'South River', zipcode: '08882' },
    { name: 'Spotswood', zipcode: '08884' },
    { name: 'Woodbridge', zipcode: '07095' },
  ],
};

// Get all counties sorted alphabetically
export function getSortedCounties(): string[] {
  return Object.keys(serviceAreas).sort();
}

// Get all towns as a flat array with county info
export function getAllTowns(): Array<TownMapping & { county: string }> {
  const towns: Array<TownMapping & { county: string }> = [];
  for (const [county, countyTowns] of Object.entries(serviceAreas)) {
    for (const town of countyTowns) {
      towns.push({ ...town, county });
    }
  }
  return towns.sort((a, b) => a.name.localeCompare(b.name));
}

// Get town name by zipcode (returns first match if multiple towns share a zip)
export function getTownNameByZipcode(zipcode: string): string | null {
  for (const countyTowns of Object.values(serviceAreas)) {
    const town = countyTowns.find((t) => t.zipcode === zipcode);
    if (town) return town.name;
  }
  return null;
}

// Get all towns for a specific zipcode (some zips serve multiple towns)
export function getTownsByZipcode(zipcode: string): TownMapping[] {
  const towns: TownMapping[] = [];
  for (const countyTowns of Object.values(serviceAreas)) {
    const matches = countyTowns.filter((t) => t.zipcode === zipcode);
    towns.push(...matches);
  }
  return towns;
}
