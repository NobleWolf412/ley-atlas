import { GEO } from './geo.js';

// Shared by existing Comparisons and research investigations. Keep seed/null models identical.
export function compareLine(segment, pool, widthKm, mode, seed = 20261108, controls = 2000) {
  if (
    !['rotate', 'random'].includes(mode) ||
    !(widthKm > 0) ||
    !Number.isFinite(widthKm) ||
    !Number.isInteger(controls) ||
    controls < 1 ||
    controls > 10000
  )
    throw new Error('Invalid comparison parameters');
  const vectors = pool.map(p => p.v || GEO.vec(p.lat, p.lon));
  const sw = Math.sin(widthKm / GEO.R),
    full = !Number.isFinite(segment.len);
  const count = seg => {
    const f = GEO.frame(...seg.o, seg.brg),
      line = { ...seg, f };
    let n = 0;
    for (const v of vectors) {
      if (Math.abs(GEO.dot(f.n, v)) > sw) continue;
      if (full || GEO.distToLine(line, ...GEO.ll(v)).d <= widthKm) n++;
    }
    return n;
  };
  const obs = count(segment),
    random = GEO.rng(seed),
    hist = [];
  for (let i = 0; i < controls; i++)
    hist.push(
      count({ ...segment, o: mode === 'rotate' ? segment.o : GEO.randomPoint(random), brg: random() * 360 }),
    );
  return {
    obs,
    N: controls,
    p: (hist.filter(n => n >= obs).length + 1) / (controls + 1),
    mean: hist.reduce((s, n) => s + n, 0) / controls,
    hist,
    w: widthKm,
    mode,
    pool: pool.length,
    seed,
  };
}

export function researchFingerprint(value) {
  const stable = v =>
    Array.isArray(v)
      ? v.map(stable)
      : v && typeof v === 'object'
        ? Object.fromEntries(
            Object.keys(v)
              .sort()
              .map(k => [k, stable(v[k])]),
          )
        : v;
  let hash = 2166136261;
  for (const ch of JSON.stringify(stable(value))) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619) >>> 0;
  return hash.toString(16).padStart(8, '0');
}
