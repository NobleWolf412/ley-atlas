// Country names: one spelling per country, whatever the dataset called it (pure)

const ALIASES = {
  'United States of America': 'United States',
  'W. Sahara': 'Western Sahara',
  'Dem. Rep. Congo': 'DR Congo',
  'Democratic Republic of the Congo': 'DR Congo',
  'Dominican Rep.': 'Dominican Republic',
  Bahamas: 'The Bahamas',
  'Falkland Is.': 'Falkland Islands',
  'Fr. S. Antarctic Lands': 'French Southern Lands',
  'Central African Rep.': 'Central African Republic',
  'Eq. Guinea': 'Equatorial Guinea',
  eSwatini: 'Eswatini',
  'Solomon Is.': 'Solomon Islands',
  Czechia: 'Czech Republic',
  'N. Cyprus': 'Northern Cyprus',
  'Bosnia and Herz.': 'Bosnia and Herzegovina',
  Macedonia: 'North Macedonia',
  'S. Sudan': 'South Sudan',
  // the castle list uses the home nations; the country filter groups them
  England: 'United Kingdom',
  Scotland: 'United Kingdom',
  Wales: 'United Kingdom',
  'Northern Ireland': 'United Kingdom',
  UK: 'United Kingdom',
  USA: 'United States',
};

export const canonicalCountry = name => ALIASES[name] || name;

/**
 * Picks a country out of a free-text region such as "Luxor, Egypt" or "Castle · France".
 * @param known a Set of canonical country names
 * @returns the country, or '' when no part of the text is one
 */
export function countryFromText(text, known) {
  const parts = String(text ?? '')
    .split(/[·,]/)
    .map(s => s.trim())
    .filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    const c = canonicalCountry(parts[i]);
    if (known.has(c)) return c;
  }
  return '';
}
