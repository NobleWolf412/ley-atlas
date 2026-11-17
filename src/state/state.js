// App state and persistence (localStorage)

// ================= state =================
export const KEY = 'leyatlas.v1',
  KEYI = 'leyatlas.imports.v1',
  KEYT = 'leyatlas.theme',
  KEYK = 'leyatlas.key';
export const S = {
  view: 'map',
  cam: { lon: 12.4612, lat: 41.9026, k: 1 },
  layers: {
    primary: false,
    bestfit: false,
    sword: false,
    swordfit: false,
    torsap: false,
    torsapfit: false,
    duff: false,
    meridian: false,
    viasacra: false,
    user: true,
    intersections: true,
    corridor: true,
    outlines: true,
    labels: true,
    borders: true,
    places: true,
    rivers: true,
    sat: false,
    stonework: false,
    cat: {
      fort: true,
      castle: true,
      megalith: true,
      temple: true,
      church: true,
      obelisk: true,
      ruin: true,
      mountain: true,
      landmark: true,
      heritage: false,
      marker: true,
    },
  },
  src: {
    core: true,
    wonder: true,
    fort: true,
    pleiades: false,
    unesco: true,
    castle: true,
    megalith: true,
    roman: true,
  },
  under: {
    iron: false,
    copper: false,
    silver: false,
    gold: false,
    leadzinc: false,
    crystal: false,
    other: false,
    faults: false,
    plates: false,
    mag: false,
  },
  utest: { set: 'church', target: 'any', r: 10 },
  focus: true,
  corridorKm: 1,
  corridorOnly: false,
  active: null,
  hideTrivial: true,
  forts: {},
  userLines: [],
  removedCaseStudies: [],
  work: null,
  markers: [],
  imports: [],
  selFort: 'castel',
  control: 'fort',
  build: { mode: 'connect', a: 'obelisk', b: 'castel', from: 'castel', brg: 45, len: 'g', name: '' },
  sel: null,
  mode: null,
  measure: [],
  intro: null,
  follow: null,
  tab: 'line',
  satFailed: false,
  keyOpen: true,
  siteSort: 'az',
  siteCat: 'all',
  siteLimit: 150,
  fortSort: 'az',
};
export function stripF(l) {
  if (!l) return l;
  const o = { ...l };
  delete o.segs;
  delete o.f;
  delete o.sigma;
  return o;
}
export function modForts() {
  return Object.fromEntries(Object.entries(S.forts).filter(([, v]) => v.mod));
}
export function persist() {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        forts: modForts(),
        userLines: S.userLines.map(stripF),
        work: stripF(S.work),
        markers: S.markers,
        focus: S.focus,
        removedCaseStudies: S.removedCaseStudies,
      }),
    );
  } catch (e) {}
}
export function persistImports() {
  try {
    localStorage.setItem(KEYI, JSON.stringify(S.imports));
    return true;
  } catch (e) {
    return false;
  }
}

export function initState() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (d) {
      S.forts = d.forts || {};
      S.userLines = d.userLines || [];
      S.removedCaseStudies = Array.isArray(d.removedCaseStudies)
        ? d.removedCaseStudies.filter(id => typeof id === 'string')
        : [];
      S.work = d.work || null;
      S.markers = d.markers || [];
      if (typeof d.focus === 'boolean') S.focus = d.focus;
    }
  } catch (e) {}
  try {
    const d = JSON.parse(localStorage.getItem(KEYI) || 'null');
    if (Array.isArray(d)) S.imports = d;
  } catch (e) {}
  try {
    S.keyOpen = localStorage.getItem(KEYK) !== '0';
  } catch (e) {}
}
