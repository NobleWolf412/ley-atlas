// Star fort geometry: which way a fort's points face, how regular it is, and whether
// its points aim at anything more often than a randomly turned copy of the same fort would
// (pure: no DOM, no state)
import { GEO } from './geo.js';
import { angleBetween } from './sky.js';

const TAU = 360;

/**
 * Directions of a fort's points (bastion and ravelin tips), seen from its centre.
 * @param centre [lat, lon]  @param tips [[lat, lon], ...]
 * @returns [{ brg, km }] sorted by bearing
 */
export function tipBearings(centre, tips) {
  return tips
    .map(t => ({
      brg: GEO.bearing(centre[0], centre[1], t[0], t[1]),
      km: GEO.dist(centre[0], centre[1], t[0], t[1]),
    }))
    .sort((a, b) => a.brg - b.brg);
}

/**
 * Shape figures for a fort.
 * regularity: 1 = points perfectly evenly spaced round the centre, 0 = very uneven
 * roundness:  1 = every point the same distance from the centre
 * facing:     the direction the points face, folded into one sector (0 … 360/n degrees);
 *             two forts with the same number of points and the same facing are turned the same way
 */
export function fortShape(tipsFromCentre) {
  const n = tipsFromCentre.length;
  if (n < 2) return { n, regularity: 0, roundness: 0, facing: n ? tipsFromCentre[0].brg : 0 };
  const step = TAU / n;
  let gapErr = 0;
  for (let i = 0; i < n; i++) {
    const a = tipsFromCentre[i].brg,
      b = i + 1 < n ? tipsFromCentre[i + 1].brg : tipsFromCentre[0].brg + TAU;
    gapErr += Math.abs(b - a - step);
  }
  const km = tipsFromCentre.map(t => t.km),
    mean = km.reduce((s, v) => s + v, 0) / n,
    sd = Math.sqrt(km.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
  return {
    n,
    regularity: Math.max(0, 1 - gapErr / n / (step / 2)),
    roundness: mean > 0 ? Math.max(0, 1 - sd / mean) : 0,
    facing: foldedMean(
      tipsFromCentre.map(t => t.brg),
      n,
    ),
  };
}

/** Mean direction of angles that repeat every 360/n degrees (circular mean of n·θ, divided by n). */
export function foldedMean(angles, n) {
  let x = 0,
    y = 0;
  for (const a of angles) {
    const r = (a * n * Math.PI) / 180;
    x += Math.cos(r);
    y += Math.sin(r);
  }
  const m = (Math.atan2(y, x) * 180) / Math.PI / n;
  return ((m % (TAU / n)) + TAU / n) % (TAU / n);
}

/**
 * Do a set of directions cluster? Rayleigh test on angles folded by n (n = 1 for plain angles).
 * @returns { R: 0–1 (0 = spread evenly, 1 = all the same), p: chance of clustering this much by luck }
 */
export function rayleigh(angles, n = 1) {
  const N = angles.length;
  if (N < 2) return { R: 0, p: 1 };
  let x = 0,
    y = 0;
  for (const a of angles) {
    const r = (a * n * Math.PI) / 180;
    x += Math.cos(r);
    y += Math.sin(r);
  }
  const R = Math.hypot(x, y) / N,
    Z = N * R * R;
  // Zar (2010), eq. 27.4: good approximation for N ≥ 10
  const p = Math.exp(Math.sqrt(1 + 4 * N + 4 * (N * N - N * N * R * R)) - (1 + 2 * N));
  return { R, Z, p: Math.min(1, Math.max(0, p)) };
}

/**
 * Which targets the points aim at.
 * @param tipBrgs bearings of the points (degrees)  @param targets [{ brg, ... }] directions from the centre
 * @returns the targets within `tol` degrees of some point, each with { tip, off }
 */
export function aimedAt(tipBrgs, targets, tol) {
  const out = [];
  for (const t of targets) {
    let best = null;
    tipBrgs.forEach((b, i) => {
      const off = angleBetween(b, t.brg);
      if (off <= tol && (!best || off < best.off)) best = { tip: i, off };
    });
    if (best) out.push({ ...t, ...best });
  }
  return out.sort((a, b) => a.off - b.off);
}

/**
 * The luck check for one fort: turn the same fort to every possible angle (every 0.25°) and
 * count how often it would aim at as many targets as it really does.
 * @returns { p: share of turns that do at least as well, expected: average hits over all turns }
 */
export function rotationTest(tipBrgs, targetBrgs, tol, observed) {
  const step = 0.25,
    turns = Math.round(TAU / step);
  // for each target, the turns that put some point within tol of it
  const hits = new Int32Array(turns);
  for (const t of targetBrgs) {
    const seen = new Uint8Array(turns);
    for (const b of tipBrgs) {
      const lo = Math.ceil((t - b - tol) / step),
        hi = Math.floor((t - b + tol) / step);
      for (let k = lo; k <= hi; k++) {
        const i = ((k % turns) + turns) % turns;
        if (!seen[i]) {
          seen[i] = 1;
          hits[i]++;
        }
      }
    }
  }
  let ge = 0,
    sum = 0;
  for (let i = 0; i < turns; i++) {
    sum += hits[i];
    if (hits[i] >= observed) ge++;
  }
  return { p: ge / turns, expected: sum / turns };
}

/**
 * Chance of seeing at least `k` events when `expected` are expected (Poisson upper tail).
 * Used for the network-wide test, where many forts' points are added up.
 */
export function poissonAtLeast(k, expected) {
  if (k <= 0) return 1;
  if (expected > 30) {
    // large counts: normal approximation with continuity correction (exp(-expected) would underflow)
    const z = (k - 0.5 - expected) / Math.sqrt(expected);
    return 0.5 * erfc(z / Math.SQRT2);
  }
  let term = Math.exp(-expected),
    below = term;
  for (let i = 1; i < k; i++) {
    term *= expected / i;
    below += term;
  }
  return Math.max(0, 1 - below);
}

// complementary error function (Numerical Recipes erfcc, error < 1.2e-7)
function erfc(x) {
  const z = Math.abs(x),
    t = 1 / (1 + 0.5 * z);
  const r =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t *
                  (0.09678418 +
                    t *
                      (-0.18628806 +
                        t *
                          (0.27886807 +
                            t * (-1.13520398 + t * (1.48851638 + t * (-0.82215223 + t * 0.17087277)))))))),
    );
  return x >= 0 ? r : 2 - r;
}
