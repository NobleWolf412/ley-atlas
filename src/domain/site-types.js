// Site types, sources and import categories

// ================= site types & sources =================
export const TYPES = [
  ['fort', 'Star forts', 'Star fort / distribution node'],
  ['castle', 'Castles, fortresses & palaces', 'Castle / fortress / palace'],
  ['church', 'Cathedrals, churches & monasteries', 'Cathedral / church / monastery'],
  ['temple', 'Temples & sacred sites', 'Temple / sacred site'],
  ['megalith', 'Megaliths & rock-cut sites', 'Megalith / monolith / rock-cut'],
  ['obelisk', 'Obelisks & standing stones', 'Obelisk / standing stone'],
  ['ruin', 'Ruins, tombs & pyramids', 'Ruin / tomb / pyramid'],
  ['mountain', 'Natural formations', 'Natural formation'],
  ['landmark', 'Modern landmarks', 'Modern landmark'],
  ['heritage', 'World Heritage (UNESCO)', 'UNESCO property'],
  ['marker', 'Your markers', 'Your marker'],
];
export let TYPENAME;
export const TYPESHORT = {
  fort: 'Star fort',
  castle: 'Castle',
  megalith: 'Megalith',
  temple: 'Temple',
  church: 'Church',
  obelisk: 'Obelisk / stone',
  ruin: 'Ruin / tomb',
  mountain: 'Natural',
  landmark: 'Landmark',
  heritage: 'UNESCO',
  marker: 'Marker',
};
export const SOURCES = {
  core: { label: 'Project sites', sub: 'Your original research list' },
  wonder: {
    label: 'Ancient & sacred wonders',
    sub: 'Hand-picked worldwide, each with a cited coordinate source',
  },
  fort: { label: 'Star-fort catalogue', sub: 'Hotham (2026): every bastion fort in open data' },
  pleiades: {
    label: 'Pleiades ancient temples',
    sub: 'Scholarly gazetteer, precisely located only. Off by default to keep the map readable.',
  },
  unesco: { label: 'UNESCO World Heritage list', sub: '2014 list, one point per property' },
  castle: {
    label: 'Castles of the World',
    sub: 'Castlemap dataset (2026, CC0): castles, fortresses, palaces and ruins, each checked against Wikipedia and Wikidata',
  },
  roman: {
    label: 'Roman-era monuments',
    sub: 'Pleiades gazetteer (CC BY): forts, villas, baths, bridges, amphitheatres and temples dated 50 BC – AD 450, located to within 500 m',
  },
  megalith: {
    label: 'Megaliths & precision stonework',
    sub: 'T. Fralse (2026): 88 stone sites scored for masonry, block size and precision. Self-published, not peer-reviewed.',
  },
};
export const CATEGORIES_IMPORT = [
  'fort',
  'castle',
  'church',
  'temple',
  'megalith',
  'obelisk',
  'ruin',
  'mountain',
  'landmark',
];

export function initSiteTypes() {
  TYPENAME = Object.fromEntries(TYPES.map(t => [t[0], t[1]]));
}
