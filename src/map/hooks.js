// Extension points of the map. Features plug in here; the map never imports a feature.

// ---- draw layers -------------------------------------------------------------------
// The drawing loop calls these at fixed points of a frame:
//   beforeLines   after the base map and underground layers; set up styles
//   underLines    under the alignment lines (glows, fans)
//   top           above sites and labels (handles, previews, highlights)
const layers = { beforeLines: [], underLines: [], top: [] };

/** @param {'beforeLines'|'underLines'|'top'} stage @param {(P, path) => void} fn */
export function addDrawLayer(stage, fn) {
  layers[stage].push(fn);
}
export function runDrawLayers(stage, P, path) {
  for (const fn of layers[stage]) fn(P, path);
}

// ---- highlighted sites -------------------------------------------------------------
// A feature can name sites that must always be drawn in full (never thinned out or
// clustered) and ringed, for example the best line matches while point B is being chosen.
const highlighters = [];

/** @param {() => Set<string>|null} fn returns the site ids to highlight right now, or null */
export function addSiteHighlighter(fn) {
  highlighters.push(fn);
}
/** @returns {Set<string>|null} */
export function highlightedSites() {
  for (const fn of highlighters) {
    const set = fn();
    if (set) return set;
  }
  return null;
}
