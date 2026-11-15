// Basemap geometry decoding
import { dec } from '../core/polyline.js';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import { FORT_OUTLINES, TOPO_C110, TOPO_LAND110 } from '../data/datasets.js';

// ================= basemap =================
export let land110;
export let borders110;
export let graticule;
export const cellRings = c => c._r || (c._r = c.r.map(s => dec(s)));
export const chunkPts = c => c._p || (c._p = dec(c.c));
export const lakeRings = c => c._r || (c._r = c.r.map(s => dec(s)));
const OLCACHE = new Map();
export const outlineOf = fid => {
  if (!FORT_OUTLINES[fid]) return null;
  let o = OLCACHE.get(fid);
  if (!o) {
    o = dec(FORT_OUTLINES[fid], 1e5);
    OLCACHE.set(fid, o);
  }
  return o;
};

export function initBasemap() {
  // ================= basemap =================
  land110 = topojson.feature(TOPO_LAND110, TOPO_LAND110.objects.land);
  borders110 = topojson.mesh(TOPO_C110, TOPO_C110.objects.countries, (a, b) => a !== b);
  graticule = d3.geoGraticule10();
}
