/**
 * Town-specific content for moving guides.
 * Covers the highest-traffic towns across Burlington, Mercer, and Middlesex Counties.
 *
 * Fair Housing note: descriptions must focus on places, amenities, housing, and
 * commute — never on the protected-class composition of residents (race, religion,
 * national origin, familial status, etc.). School references are kept neutral and
 * attributed to public NJ DOE data rather than ranked as desirability proxies.
 */

export interface TownGuide {
  townName: string;
  county: string;
  countySlug: string;
  zipcode: string;
  blurb: string;         // 2–3 sentence neighborhood character description
  commute: string;       // Commute highlights
  schoolNote: string;    // School district note (public info only)
  lifestyle: string;     // Lifestyle / community highlights
}

export const townGuides: TownGuide[] = [
  // ── Burlington County ─────────────────────────────────────────────────────
  {
    townName: 'Cherry Hill',
    county: 'Burlington County',
    countySlug: 'burlington-county',
    zipcode: '08002',
    blurb: 'Cherry Hill is one of South Jersey\'s most established suburban communities, known for its tree-lined neighborhoods and convenient access to Philadelphia. It offers a wide range of housing styles from mid-century ranches to newer construction.',
    commute: '15–25 minutes to Center City Philadelphia via Route 38 and I-676. NJ Transit bus service available.',
    schoolNote: 'Served by the Cherry Hill School District, which operates two high schools (Cherry Hill East and Cherry Hill West). Families are encouraged to review current performance data on the NJ Department of Education website.',
    lifestyle: 'Abundant shopping and dining along Route 70 and the Cherry Hill Mall area. A wide range of housing types and price points with a strong sense of neighborhood pride.',
  },
  {
    townName: 'Marlton',
    county: 'Burlington County',
    countySlug: 'burlington-county',
    zipcode: '08053',
    blurb: 'Marlton is a popular Burlington County community offering newer planned developments and easy highway access, with suburban convenience and a short commute.',
    commute: '25–35 minutes to Philadelphia via Route 73 and I-295. Close to the NJ Turnpike (Exit 4).',
    schoolNote: 'Served by the Evesham Township School District; Lenape High School serves upper grades. Current district data is available on the NJ Department of Education website.',
    lifestyle: 'Extensive retail and restaurant corridor along Route 73. Strong youth sports culture and community events.',
  },
  {
    townName: 'Moorestown',
    county: 'Burlington County',
    countySlug: 'burlington-county',
    zipcode: '08057',
    blurb: 'Moorestown is one of the most sought-after addresses in South Jersey — a historic town center and tree-lined streets give it a distinctive character. The housing stock includes grand Victorians, colonials, and newer custom homes.',
    commute: '20–30 minutes to Philadelphia. Easy access to Route 38, I-295, and NJ Turnpike.',
    schoolNote: 'Served by the Moorestown School District. Families are encouraged to review current performance data on the NJ Department of Education website.',
    lifestyle: 'Charming main street with boutique shops and restaurants. Strong historic-preservation ethic and a highly walkable town center.',
  },
  {
    townName: 'Mount Laurel',
    county: 'Burlington County',
    countySlug: 'burlington-county',
    zipcode: '08054',
    blurb: 'Mount Laurel is a large township offering a wide range of housing — from townhouses and condos to single-family homes in established neighborhoods. Its central location makes it a hub for South Jersey commerce.',
    commute: '25–35 minutes to Philadelphia via I-295. Excellent access to the NJ Turnpike and Route 38.',
    schoolNote: 'Lenape Regional High School District serves upper grades. Multiple elementary school districts feed into this system.',
    lifestyle: 'Extensive commercial development along Route 73. Large employer base with many corporate headquarters. A rapidly growing community with a wide range of housing types.',
  },
  {
    townName: 'Bordentown',
    county: 'Burlington County',
    countySlug: 'burlington-county',
    zipcode: '08505',
    blurb: 'Bordentown is a historic river town with a charming main street and a growing arts scene. Its antique storefronts, colonial architecture, and close-knit community make it increasingly popular with buyers seeking character over cookie-cutter development.',
    commute: '40–50 minutes to Philadelphia via I-295. NJ Transit River Line light rail connects to Trenton.',
    schoolNote: 'Bordentown Regional School District — small district with strong community involvement.',
    lifestyle: 'Vibrant arts district on Farnsworth Avenue. Delaware River waterfront. Growing restaurant scene. Annual festivals and community events.',
  },
  {
    townName: 'Medford',
    county: 'Burlington County',
    countySlug: 'burlington-county',
    zipcode: '08055',
    blurb: 'Medford offers a pastoral setting with a walkable historic village center and access to the Pinelands. It\'s known for larger lots, equestrian properties, and a quiet, rural character that attracts buyers seeking space.',
    commute: '35–45 minutes to Philadelphia via Route 70 and I-295. More rural — car-dependent.',
    schoolNote: 'Medford Township School District — Shawnee High School (Lenape Regional) serves upper grades.',
    lifestyle: 'Scenic lake communities, hiking trails, and Pinelands preserve access. Quaint village shops and restaurants. Strong equestrian community.',
  },
  {
    townName: 'Cinnaminson',
    county: 'Burlington County',
    countySlug: 'burlington-county',
    zipcode: '08077',
    blurb: 'Cinnaminson is a quiet township on the Delaware River offering affordable housing and a tight-knit community feel. It\'s a good choice for buyers who want proximity to Philadelphia and Trenton without premium price tags.',
    commute: '20–30 minutes to Philadelphia via Route 130 and I-295.',
    schoolNote: 'Cinnaminson School District — Cinnaminson High School serves the community.',
    lifestyle: 'Delaware River access for fishing and recreation. Suburban character with good local amenities. Well-maintained neighborhoods.',
  },
  // ── Mercer County ─────────────────────────────────────────────────────────
  {
    townName: 'Princeton',
    county: 'Mercer County',
    countySlug: 'mercer-county',
    zipcode: '08540',
    blurb: 'Princeton is home to Princeton University and carries a distinctive cultural and intellectual energy unlike anywhere else in central NJ. The borough combines a vibrant arts scene with exceptional dining and historic architecture.',
    commute: '60–75 minutes to Midtown Manhattan via NJ Transit (Princeton Junction station). 45–55 minutes to Philadelphia via Route 1.',
    schoolNote: 'Served by Princeton Public Schools. Families are encouraged to review current performance data on the NJ Department of Education website.',
    lifestyle: 'World-class dining, theater, and museums. Palmer Square shopping and events. High walkability in the borough. Exceptional cultural programming.',
  },
  {
    townName: 'Robbinsville',
    county: 'Mercer County',
    countySlug: 'mercer-county',
    zipcode: '08691',
    blurb: 'Robbinsville is one of central NJ\'s fastest-growing communities, offering newer planned developments and a growing town center.',
    commute: '65–80 minutes to NYC via NJ Transit from Hamilton Station. 45–55 minutes to Philadelphia via I-295.',
    schoolNote: 'Served by the Robbinsville School District. Families are encouraged to review current performance data on the NJ Department of Education website.',
    lifestyle: 'Town Center with shops, restaurants, and community events. Strong youth athletics programs. Newer construction with modern amenities.',
  },
  {
    townName: 'Hamilton',
    county: 'Mercer County',
    countySlug: 'mercer-county',
    zipcode: '08610',
    blurb: 'Hamilton Township is the largest municipality in Mercer County by population, offering a wide range of housing options at relatively affordable prices. Its central location and NJ Transit access make it a practical choice for commuters in both directions.',
    commute: 'Hamilton Train Station offers NJ Transit service to NYC (70–80 min) and Philadelphia. Easy I-295 and Turnpike access.',
    schoolNote: 'Hamilton Township School District — multiple high schools serving different neighborhoods.',
    lifestyle: 'A wide range of neighborhoods and housing types. Multiple shopping districts. Abbott Marshlands nature preserve. Strong local business community.',
  },
  {
    townName: 'Lawrence',
    county: 'Mercer County',
    countySlug: 'mercer-county',
    zipcode: '08648',
    blurb: 'Lawrence Township borders Princeton and Trenton, offering a middle ground between academic/cultural Princeton and the more affordable Trenton metro. It\'s popular with Trenton commuters and university staff.',
    commute: '70 minutes to NYC via NJ Transit from Princeton Junction. 45 minutes to Philadelphia via I-295.',
    schoolNote: 'Lawrence Township School District — Lawrence High School serves the township.',
    lifestyle: 'Close to Rider University and The College of New Jersey. Mix of suburban neighborhoods and open space. Good local dining scene along Route 1.',
  },
  {
    townName: 'East Windsor',
    county: 'Mercer County',
    countySlug: 'mercer-county',
    zipcode: '08520',
    blurb: 'East Windsor offers affordable single-family homes and townhouses in a relatively quiet township with good highway access. It\'s a popular choice for first-time buyers priced out of Princeton and Robbinsville.',
    commute: '70 minutes to NYC via NJ Transit (Hightstown). Easy access to Route 33, Route 130, and I-195.',
    schoolNote: 'East Windsor Regional School District — Hightstown High School serves the area.',
    lifestyle: 'More rural character with open space. Close to Six Flags Great Adventure. Growing community with newer developments mixed with established neighborhoods.',
  },
  // ── Middlesex County ──────────────────────────────────────────────────────
  {
    townName: 'Edison',
    county: 'Middlesex County',
    countySlug: 'middlesex-county',
    zipcode: '08817',
    blurb: 'Edison is one of NJ\'s most populous townships, named after Thomas Edison, who did much of his landmark work here. It offers a wide range of housing and a renowned, varied dining scene.',
    commute: 'Multiple NJ Transit stations (MetroPark, Edison) with 45–55 minute service to NYC Penn Station. Easy Garden State Pkwy and Turnpike access.',
    schoolNote: 'Edison Township School District — multiple high schools (Edison, JFK) serving different areas of the large township.',
    lifestyle: 'Diverse, internationally acclaimed dining along Oak Tree Road and Route 27. Major retail centers. Thomas Edison National Historical Park.',
  },
  {
    townName: 'East Brunswick',
    county: 'Middlesex County',
    countySlug: 'middlesex-county',
    zipcode: '08816',
    blurb: 'East Brunswick is a well-established Middlesex County township known for its commercial corridor, established neighborhoods, and a strong sense of community. It offers a range of housing types from modest ranches to large colonials.',
    commute: '55–65 minutes to NYC via NJ Transit bus from Route 18 park-and-ride. Easy Route 18 and Route 9 access.',
    schoolNote: 'East Brunswick Public Schools — East Brunswick High School offers a wide range of programs.',
    lifestyle: 'Extensive commercial corridor on Route 18. Multiple houses of worship, community centers, and a strong parks system. A wide range of housing types and amenities.',
  },
  {
    townName: 'Old Bridge',
    county: 'Middlesex County',
    countySlug: 'middlesex-county',
    zipcode: '08857',
    blurb: 'Old Bridge is a sprawling Middlesex County township with varied neighborhoods, from waterfront communities on Raritan Bay to inland suburban developments. It offers relatively affordable prices for the Middlesex market.',
    commute: '55–70 minutes to NYC via NJ Transit bus (Matawan/Aberdeen train station nearby). Garden State Pkwy access.',
    schoolNote: 'Old Bridge Township School District — Old Bridge High School is one of the larger high schools in NJ.',
    lifestyle: 'Cheesequake State Park. Raritan Bay waterfront access. Mix of suburban and more rural areas. Active parks and recreation programs.',
  },
  {
    townName: 'Woodbridge',
    county: 'Middlesex County',
    countySlug: 'middlesex-county',
    zipcode: '07095',
    blurb: 'Woodbridge Township encompasses several distinct communities including Woodbridge proper, Fords, Avenel, and others. Its proximity to multiple transit options and major highways makes it a commuter-friendly choice.',
    commute: 'Woodbridge NJ Transit station: 45–55 minutes to NYC Penn. NJ Turnpike and Garden State Pkwy converge nearby.',
    schoolNote: 'Woodbridge Township School District — multiple high schools serving the large township.',
    lifestyle: 'Woodbridge Center mall area. Barron Arts Center. Multiple distinct neighborhoods, each with its own character.',
  },
  {
    townName: 'Piscataway',
    county: 'Middlesex County',
    countySlug: 'middlesex-county',
    zipcode: '08854',
    blurb: 'Piscataway is home to Rutgers University and offers an academic atmosphere with a wide range of housing stock from affordable to upscale. It\'s popular with university faculty, staff, and graduate students.',
    commute: '55–65 minutes to NYC via NJ Transit (Bound Brook or New Brunswick stations). Route 287 and Route 1 access.',
    schoolNote: 'Piscataway Township Schools — Piscataway High School serves the community.',
    lifestyle: 'Rutgers University presence drives cultural and arts programming. Johnson Park along the Raritan River. Several major corporate campuses.',
  },
  {
    townName: 'South Brunswick',
    county: 'Middlesex County',
    countySlug: 'middlesex-county',
    zipcode: '08852',
    blurb: 'South Brunswick is a rapidly growing township with planned communities and convenient highway access between Route 1 and Route 27.',
    commute: '60–75 minutes to NYC via NJ Transit bus or driving to Princeton Junction. Close to Route 1 tech corridor.',
    schoolNote: 'South Brunswick School District — South Brunswick High School serves the township.',
    lifestyle: 'Multiple cultural and community centers. New-construction neighborhoods. Strong Route 1 tech employment corridor.',
  },
  {
    townName: 'Metuchen',
    county: 'Middlesex County',
    countySlug: 'middlesex-county',
    zipcode: '08840',
    blurb: 'Metuchen is a charming, walkable borough with a vibrant main street, excellent NJ Transit access, and some of the most character-rich housing stock in Middlesex County. It consistently ranks as one of NJ\'s best places to live.',
    commute: 'Metuchen NJ Transit station: 45–50 minutes to NYC Penn — one of the best commutes in Middlesex County.',
    schoolNote: 'Metuchen School District — Metuchen High School, small and well-resourced.',
    lifestyle: 'Award-winning Main Street with independent restaurants and shops. Strong arts community. Annual events like the Metuchen Arts Fair. Very walkable for NJ suburbs.',
  },
];

export function getTownGuide(townName: string): TownGuide | undefined {
  return townGuides.find((g) => g.townName.toLowerCase() === townName.toLowerCase());
}

export function getTownGuideBySlug(slug: string): TownGuide | undefined {
  return townGuides.find((g) =>
    g.townName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') === slug
  );
}
