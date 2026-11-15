// Flying along a line: where the camera is after so many km, and what it passes (pure: no DOM, no map)
import { GEO } from './geo.js';

const FULL_CIRCLE = 2 * Math.PI * GEO.R;

/**
 * Turns a line's segments into one flyable path.
 * A segment is { o: [lat, lon], brg, len, back? }; len is Infinity for a line that runs right round the globe.
 * @returns {{ legs: Array<{ f, lo: number, hi: number, start: number }>, length: number }}
 */
export function buildFlightPath(segs) {
  const legs = [];
  let start = 0;
  for (const sg of segs) {
    const f = GEO.frame(sg.o[0], sg.o[1], sg.brg);
    const full = !isFinite(sg.len);
    const lo = full ? 0 : sg.back ? -sg.len : 0;
    const hi = full ? FULL_CIRCLE : sg.len;
    legs.push({ f, lo, hi, start });
    start += hi - lo;
  }
  return { legs, length: start };
}

function legAt(path, km) {
  const k = Math.max(0, Math.min(path.length, km));
  let leg = path.legs[0];
  for (const l of path.legs) if (k >= l.start) leg = l;
  return { leg, at: leg.lo + Math.min(k - leg.start, leg.hi - leg.lo) };
}

/** Position and direction of travel after `km` along the path. */
export function flightPosition(path, km) {
  const { leg, at } = legAt(path, km);
  const [lat, lon] = GEO.ll(GEO.pointAt(leg.f, at));
  // direction of travel: towards a point a little further along the same great circle
  const [lat2, lon2] = GEO.ll(GEO.pointAt(leg.f, at + 0.5));
  return { lat, lon, bearing: GEO.bearing(lat, lon, lat2, lon2) };
}

/**
 * The path as [lon, lat] pairs for drawing. Longitudes run on past ±180 instead of
 * jumping, so a map can draw the line across the date line without a break.
 */
export function flightCoords(path, stepKm = Math.max(1, path.length / 400)) {
  const out = [];
  let prev = null;
  const n = Math.max(1, Math.ceil(path.length / stepKm));
  for (let i = 0; i <= n; i++) {
    const p = flightPosition(path, (path.length * i) / n);
    let lon = p.lon;
    if (prev != null) lon += Math.round((prev - lon) / 360) * 360;
    prev = lon;
    out.push([lon, p.lat]);
  }
  return out;
}

/**
 * Where each item sits relative to the path.
 * @param items things with { lat, lon }
 * @returns the items that lie beside the path, as { item, km, off } sorted by km:
 *   km = distance along the path, off = distance to the side (km, + = left of travel)
 */
export function stopsAlong(path, items) {
  const out = [];
  for (const item of items) {
    let best = null;
    for (const leg of path.legs) {
      let { xt, at } = GEO.track(leg.f, item.lat, item.lon);
      if (at < leg.lo - 1e-6) at += FULL_CIRCLE; // legs that start past the origin's far side
      if (at < leg.lo - 1e-6 || at > leg.hi + 1e-6) continue;
      if (!best || Math.abs(xt) < Math.abs(best.off)) best = { item, km: leg.start + (at - leg.lo), off: xt };
    }
    if (best) out.push(best);
  }
  return out.sort((a, b) => a.km - b.km);
}

/** Stops within `windowKm` of the current position, nearest first. */
export function stopsNear(stops, km, windowKm) {
  return stops
    .filter(s => Math.abs(s.km - km) <= windowKm)
    .sort((a, b) => Math.abs(a.km - km) - Math.abs(b.km - km));
}

/** Map zoom for the flight: close for short lines, pulled back for long ones. */
export function flightZoom(lengthKm) {
  if (lengthKm < 60) return 13;
  if (lengthKm < 250) return 12;
  if (lengthKm < 1200) return 10.8;
  if (lengthKm < 5000) return 9;
  return 7.5;
}

/** Seconds for the whole flight at normal speed: 40 s for a short line, up to 3 minutes. */
export function flightSeconds(lengthKm) {
  return Math.max(40, Math.min(180, 40 + lengthKm / 12));
}

/** Smallest turn from bearing a to bearing b, in degrees (-180..180). */
export function turn(a, b) {
  return ((((b - a) % 360) + 540) % 360) - 180;
}
