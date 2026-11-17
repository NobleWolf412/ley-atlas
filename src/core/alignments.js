// Alignment finder: straight lines (great circles) that pass close to several sites
// (pure: no DOM, no state)
import { GEO } from './geo.js';

const R = GEO.R;

/**
 * Start a search that can be run a slice at a time, so the screen stays responsive.
 * @param points [{ lat, lon, ... }]
 * @param opts.widthKm   how close to the line a site must be (default 1)
 * @param opts.minSites  fewest sites that count as an alignment (default 4)
 * @param opts.apartKm   sites closer together than this along the line count once (default 3),
 *                       so one town full of sites cannot make a line by itself
 * @returns { step(ms) -> true when finished, progress(), lines(top) }
 *   lines: [{ a, b, members: [index], count, km, rms }] best first; a and b are the two end sites
 */
export function alignmentSearch(points, opts = {}) {
  const w = opts.widthKm ?? 1,
    minSites = opts.minSites ?? 4,
    apart = opts.apartKm ?? 3;
  const n = points.length,
    V = points.map(p => GEO.vec(p.lat, p.lon));
  const sinW = Math.sin(w / R),
    minSpan = Math.max(5, apart * (minSites - 1)) / R; // radians
  const found = [];
  let i = 0;

  function tryPair(a, b) {
    const va = V[a],
      vb = V[b];
    const cosAB = va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2];
    const span = Math.acos(Math.max(-1, Math.min(1, cosAB)));
    if (span < minSpan || span > 3) return;
    // unit normal of the great circle through a and b
    let nx = va[1] * vb[2] - va[2] * vb[1],
      ny = va[2] * vb[0] - va[0] * vb[2],
      nz = va[0] * vb[1] - va[1] * vb[0];
    const nl = Math.hypot(nx, ny, nz);
    nx /= nl;
    ny /= nl;
    nz /= nl;
    // e2: 90° along the line from a, towards b
    const ex = ny * va[2] - nz * va[1],
      ey = nz * va[0] - nx * va[2],
      ez = nx * va[1] - ny * va[0];
    const on = [];
    for (let k = 0; k < n; k++) {
      const v = V[k],
        off = nx * v[0] + ny * v[1] + nz * v[2];
      if (off > sinW || off < -sinW) continue;
      const t = Math.atan2(ex * v[0] + ey * v[1] + ez * v[2], va[0] * v[0] + va[1] * v[1] + va[2] * v[2]);
      // a and b must be the two ends: a site beyond either end means another pair owns this line
      if (t < -1e-9 || t > span + 1e-9) {
        if (k !== a && k !== b) return;
      }
      on.push([t, k, off]);
    }
    if (on.length < minSites) return;
    on.sort((p, q) => p[0] - q[0]);
    let count = 0,
      last = -Infinity,
      sum = 0;
    for (const [t, , off] of on) {
      if ((t - last) * R >= apart) {
        count++;
        last = t;
      }
      sum += (Math.asin(off) * R) ** 2;
    }
    if (count < minSites) return;
    found.push({ a, b, members: on.map(m => m[1]), count, km: span * R, rms: Math.sqrt(sum / on.length) });
  }

  return {
    step(ms = 20) {
      const t0 = Date.now();
      while (i < n) {
        for (let j = i + 1; j < n; j++) tryPair(i, j);
        i++;
        if (Date.now() - t0 >= ms) break;
      }
      return i >= n;
    },
    progress: () => (n ? i / n : 1),
    lines(top = 8) {
      found.sort((p, q) => q.count - p.count || p.rms - q.rms);
      const out = [];
      for (const L of found) {
        // skip a line that is mostly the same sites as a better one
        const dup = out.some(o => {
          const s = new Set(o.members);
          return L.members.filter(m => s.has(m)).length >= Math.min(L.members.length, o.members.length) * 0.6;
        });
        if (!dup) out.push(L);
        if (out.length >= top) break;
      }
      return out;
    },
  };
}

/** Run a search to the end in one go (tests, small sets). */
export function findAlignments(points, opts) {
  const s = alignmentSearch(points, opts);
  while (!s.step(1000));
  return s.lines(opts?.top);
}

/**
 * The same sites, each nudged a random 5–25 km in a random direction: keeps where the sites
 * cluster, breaks any exact lines. Used to see what chance alone produces.
 */
export function nudged(points, seed) {
  const r = GEO.rng(seed);
  return points.map(p => {
    const [lat, lon] = GEO.dest(p.lat, p.lon, r() * 360, 5 + r() * 20);
    return { lat, lon };
  });
}
