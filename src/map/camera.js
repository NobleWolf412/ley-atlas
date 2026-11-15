// Camera animation
import * as d3 from 'd3';
import { GEO } from '../core/geo.js';
import { R, reduceMotion, wrap } from '../core/util.js';
import { findPoint } from '../domain/points.js';
import { H, W, clampCam, kForKm } from './canvas.js';
import { req } from './draw.js';
import { inertia } from './interaction.js';
import { S } from '../state/state.js';

// ================= camera animation =================
export let anim = null;
export function flyTo(lon, lat, k, ms, done) {
  cancelAnimationFrame(inertia);
  if (reduceMotion || !ms) {
    S.cam = { lon, lat, k };
    clampCam();
    req();
    done && done();
    return;
  }
  const a = { ...S.cam },
    dl = wrap(lon - a.lon);
  const dist = d3.geoDistance([a.lon, a.lat], [lon, lat]) * R,
    vis = (Math.min(W, H) / Math.max(a.k, k)) * R;
  const bump = Math.max(0, Math.log(dist / vis + 1) * 0.9),
    t0 = performance.now();
  cancelAnimationFrame(anim);
  const step = now => {
    const u = Math.min(1, (now - t0) / ms),
      e = u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2;
    S.cam = {
      lon: a.lon + dl * e,
      lat: a.lat + (lat - a.lat) * e,
      k: Math.exp(Math.log(a.k) + (Math.log(k) - Math.log(a.k)) * e - bump * Math.sin(Math.PI * e)),
    };
    clampCam();
    req();
    if (u < 1) anim = requestAnimationFrame(step);
    else {
      anim = null;
      done && done();
    }
  };
  anim = requestAnimationFrame(step);
}
export function flyToLine(L) {
  // frame a line: its anchors if it has two, else around its origin
  const A = L.anchors.length >= 2 ? findPoint(L.anchors[0]) : null,
    B = L.anchors.length >= 2 ? findPoint(L.anchors[L.anchors.length - 1]) : null;
  if (A && B) {
    const d = GEO.dist(A.lat, A.lon, B.lat, B.lon),
      mid = GEO.ll(GEO.norm(GEO.add(A.v, B.v)));
    flyTo(mid[1], mid[0], kForKm(Math.max(2, Math.min(9000, d * 2.4))), 1500);
  } else {
    const o = L.segs[0].o;
    flyTo(o[1], o[0], kForKm(isFinite(L.segs[0].len) ? Math.max(3, L.segs[0].len * 2.4) : 2500), 1500);
  }
}

// Setters for variables that other modules change.
export function setAnim(v) {
  return (anim = v);
}
