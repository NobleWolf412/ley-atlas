// Which country each site is in, for the country filter and for searching by country
//
// Star forts and castles come with a country. Everything else (UNESCO, Pleiades, Roman sites,
// wonders, imports) is placed with the world outline already in the app (Natural Earth 1:110m).
// That outline is coarse: a site on a small island or right on a coast can fall outside every
// polygon, so nearby points are tried too. Sites that still match nothing get no country.
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import { canonicalCountry, countryFromText } from '../core/countries.js';
import { CASTLES, FORTS_EXT, TOPO_C110 } from '../data/datasets.js';

let shapes = null; // [{ name, feature, box }]
let known = null;

function prepare() {
  shapes = topojson.feature(TOPO_C110, TOPO_C110.objects.countries).features.map(feature => ({
    name: canonicalCountry(feature.properties.name),
    feature,
    box: d3.geoBounds(feature),
  }));
  known = new Set([
    ...shapes.map(s => s.name),
    ...FORTS_EXT.map(f => canonicalCountry(f.cc)),
    ...CASTLES.cc.map(canonicalCountry),
  ]);
}

function inBox(box, lon, lat) {
  const [[w, s], [e, n]] = box;
  if (lat < s || lat > n) return false;
  return w <= e ? lon >= w && lon <= e : lon >= w || lon <= e; // a box can straddle the date line
}

function containing(lon, lat) {
  for (const s of shapes) if (inBox(s.box, lon, lat) && d3.geoContains(s.feature, [lon, lat])) return s.name;
  return '';
}

function lookup(lat, lon) {
  const hit = containing(lon, lat);
  if (hit) return hit;
  // coasts and small islands: try a ring of points about 25 km out, then about 70 km
  for (const r of [0.25, 0.65])
    for (let a = 0; a < 8; a++) {
      const t = (a * Math.PI) / 4;
      const near = containing(
        lon + (r * Math.cos(t)) / Math.max(0.2, Math.cos((lat * Math.PI) / 180)),
        lat + r * Math.sin(t),
      );
      if (near) return near;
    }
  return '';
}

/** Fills in `country` on every point that does not have one yet. Safe to call often. */
export function assignCountries(points) {
  if (!shapes) prepare();
  for (const p of points) {
    if (p.country != null) continue;
    p.country = countryFromText(p.reg, known) || lookup(p.lat, p.lon);
  }
}

/** Countries among the given points, as [name, count], A–Z. */
export function countryCounts(points) {
  const m = new Map();
  for (const p of points) if (p.country) m.set(p.country, (m.get(p.country) || 0) + 1);
  return [...m].sort((a, b) => a[0].localeCompare(b[0], 'en'));
}
