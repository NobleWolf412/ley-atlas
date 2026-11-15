// Loads the static datasets in public/data/ before the app starts.
//
// Each dataset is exported as a live binding. They are all filled in by
// loadDatasets(), which main.js awaits before importing the app, so every
// module can read them synchronously, just as the single-file build did.
//
// To add a dataset: put the JSON file in public/data/, add an entry to FILES,
// and add a matching `export let` below.

export let TOPO_LAND110,
  TOPO_C110,
  BASEMAP,
  UNESCO,
  WONDERS,
  FORTS_EXT,
  FORT_OUTLINES,
  PLEIADES,
  CASTLES,
  MEGALITHS,
  DEPOSITS,
  FAULTS,
  PLATES,
  UKMAG,
  LANDMASK,
  ROMAN,
  WMAG,
  NEAR;

const FILES = {
  TOPO_LAND110: 'basemap-land-110m', // Natural Earth land, 1:110m (TopoJSON)
  TOPO_C110: 'basemap-countries-110m', // Natural Earth country borders, 1:110m (TopoJSON)
  BASEMAP: 'basemap-detail', // detailed coast, lakes and rivers, chunked by cell
  UNESCO: 'unesco-sites', // UNESCO World Heritage sites
  WONDERS: 'wonders', // wonders and landmark monuments
  FORTS_EXT: 'star-forts', // star fort catalogue
  FORT_OUTLINES: 'fort-outlines', // traced bastion outlines, keyed by fort id
  PLEIADES: 'pleiades', // Pleiades ancient places (CC BY)
  CASTLES: 'castles', // Castlemap castles (CC0)
  MEGALITHS: 'megaliths', // megaliths and precision stonework
  DEPOSITS: 'mineral-deposits', // mines and prospects (land only)
  FAULTS: 'active-faults', // active faults
  PLATES: 'plate-boundaries', // tectonic plate boundaries
  UKMAG: 'magnetic-britain', // Britain 2 km magnetic survey (PNG grid)
  LANDMASK: 'land-mask', // land/sea mask (PNG grid)
  ROMAN: 'roman-sites', // Roman-era monuments (Pleiades)
  WMAG: 'magnetic-world', // NOAA EMM2017 world magnetic anomaly (PNG grid)
  NEAR: 'nearest-towns', // GeoNames nearest-town labels
};

function assign(name, value) {
  switch (name) {
    case 'TOPO_LAND110':
      TOPO_LAND110 = value;
      break;
    case 'TOPO_C110':
      TOPO_C110 = value;
      break;
    case 'BASEMAP':
      BASEMAP = value;
      break;
    case 'UNESCO':
      UNESCO = value;
      break;
    case 'WONDERS':
      WONDERS = value;
      break;
    case 'FORTS_EXT':
      FORTS_EXT = value;
      break;
    case 'FORT_OUTLINES':
      FORT_OUTLINES = value;
      break;
    case 'PLEIADES':
      PLEIADES = value;
      break;
    case 'CASTLES':
      CASTLES = value;
      break;
    case 'MEGALITHS':
      MEGALITHS = value;
      break;
    case 'DEPOSITS':
      DEPOSITS = value;
      break;
    case 'FAULTS':
      FAULTS = value;
      break;
    case 'PLATES':
      PLATES = value;
      break;
    case 'UKMAG':
      UKMAG = value;
      break;
    case 'LANDMASK':
      LANDMASK = value;
      break;
    case 'ROMAN':
      ROMAN = value;
      break;
    case 'WMAG':
      WMAG = value;
      break;
    case 'NEAR':
      NEAR = value;
      break;
    default:
      throw new Error(`Unknown dataset ${name}`);
  }
}

/**
 * Fetches every dataset in parallel.
 * @param {(done: number, total: number) => void} [onProgress]
 */
export async function loadDatasets(onProgress) {
  const base = `${import.meta.env.BASE_URL}data/`;
  const names = Object.keys(FILES);
  let done = 0;
  await Promise.all(
    names.map(async name => {
      const res = await fetch(`${base}${FILES[name]}.json`);
      if (!res.ok) throw new Error(`Could not load ${FILES[name]}.json (${res.status})`);
      assign(name, await res.json());
      onProgress?.(++done, names.length);
    }),
  );
}
