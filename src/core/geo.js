// Geodesy: great-circle maths on the WGS84 sphere

export const GEO = (() => {
  const R = 6371.0088; // km, IUGG mean radius of WGS84
  const D2R = Math.PI / 180,
    R2D = 180 / Math.PI;
  const vec = (lat, lon) => {
    const a = lat * D2R,
      b = lon * D2R;
    return [Math.cos(a) * Math.cos(b), Math.cos(a) * Math.sin(b), Math.sin(a)];
  };
  const ll = v => {
    const n = Math.hypot(v[0], v[1], v[2]);
    return [Math.asin(Math.max(-1, Math.min(1, v[2] / n))) * R2D, Math.atan2(v[1], v[0]) * R2D];
  };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = v => {
    const n = Math.hypot(v[0], v[1], v[2]);
    return [v[0] / n, v[1] / n, v[2] / n];
  };
  const add = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
  const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];

  function dist(lat1, lon1, lat2, lon2) {
    // haversine, km
    const p1 = lat1 * D2R,
      p2 = lat2 * D2R,
      dp = p2 - p1,
      dl = (lon2 - lon1) * D2R;
    const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function bearing(lat1, lon1, lat2, lon2) {
    const p1 = lat1 * D2R,
      p2 = lat2 * D2R,
      dl = (lon2 - lon1) * D2R;
    const y = Math.sin(dl) * Math.cos(p2),
      x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
    return (Math.atan2(y, x) * R2D + 360) % 360;
  }
  function dest(lat, lon, brg, km) {
    const d = km / R,
      t = brg * D2R,
      p1 = lat * D2R,
      l1 = lon * D2R;
    const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(t));
    const l2 =
      l1 + Math.atan2(Math.sin(t) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
    return [p2 * R2D, ((l2 * R2D + 540) % 360) - 180];
  }
  // A line = { o:[lat,lon] origin, brg, len (km, Infinity for full great circle), back (bool: also extend backwards) }
  // Internally: unit vectors o, t (tangent toward brg), n = o x t (pole of the great circle)
  function frame(lat, lon, brg) {
    const o = vec(lat, lon);
    const east = norm(cross([0, 0, 1], o).every(x => Math.abs(x) < 1e-12) ? [0, 1, 0] : cross([0, 0, 1], o));
    const north = cross(o, east);
    const b = brg * D2R;
    const t = add(scale(north, Math.cos(b)), east, Math.sin(b));
    return { o, t, n: cross(o, t) };
  }
  function pointAt(f, km) {
    const a = km / R;
    return add(scale(f.o, Math.cos(a)), f.t, Math.sin(a));
  }
  // signed cross-track (km, + = left of travel) and along-track (km, -πR..πR)
  function track(f, lat, lon) {
    const p = vec(lat, lon);
    const xt = Math.asin(Math.max(-1, Math.min(1, dot(f.n, p)))) * R;
    const at = Math.atan2(dot(f.t, p), dot(f.o, p)) * R;
    return { xt, at };
  }
  // shortest distance from a point to a line (finite or full), km
  function distToLine(L, lat, lon) {
    const f = L.f || (L.f = frame(L.o[0], L.o[1], L.brg));
    const { xt, at } = track(f, lat, lon);
    const lo = L.back ? -L.len : 0,
      hi = L.len;
    if (!isFinite(L.len) || (at >= lo && at <= hi)) return { d: Math.abs(xt), xt, at, onSpan: true };
    const end = at < lo ? lo : hi,
      e = ll(pointAt(f, end));
    return { d: dist(lat, lon, e[0], e[1]), xt, at, onSpan: false };
  }
  // sample a line into [lon,lat] vertices for d3 (d3 interpolates great arcs between vertices)
  function sample(L, stepKm) {
    const f = L.f || (L.f = frame(L.o[0], L.o[1], L.brg));
    const full = !isFinite(L.len);
    const lo = full ? -Math.PI * R : L.back ? -L.len : 0,
      hi = full ? Math.PI * R : L.len;
    const span = hi - lo,
      n = Math.max(2, Math.ceil(span / (stepKm || Math.max(span / 120, 0.005))));
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const g = ll(pointAt(f, lo + (span * i) / n));
      pts.push([g[1], g[0]]);
    }
    return pts;
  }
  // corridor edge: points at constant cross-track offset w (km)
  function offsetSample(L, w, n = 240) {
    const f = L.f || (L.f = frame(L.o[0], L.o[1], L.brg));
    const full = !isFinite(L.len);
    const lo = full ? -Math.PI * R : L.back ? -L.len : 0,
      hi = full ? Math.PI * R : L.len;
    const a = w / R,
      out = [];
    const steps = full ? n : Math.max(8, Math.min(n, Math.ceil((hi - lo) / Math.max(w / 4, 0.002))));
    for (let i = 0; i <= steps; i++) {
      const q = pointAt(f, lo + ((hi - lo) * i) / steps);
      const g = ll(add(scale(q, Math.cos(a)), f.n, Math.sin(a)));
      out.push([g[1], g[0]]);
    }
    return out;
  }
  // sample along-track interval [a0,a1] (km), optionally offset sideways by off km -> [lon,lat][]
  function sampleRange(L, a0, a1, n, off) {
    const f = L.f || (L.f = frame(L.o[0], L.o[1], L.brg)),
      a = (off || 0) / R,
      out = [];
    for (let i = 0; i <= n; i++) {
      let q = pointAt(f, a0 + ((a1 - a0) * i) / n);
      if (a) q = add(scale(q, Math.cos(a)), f.n, Math.sin(a));
      const g = ll(q);
      out.push([g[1], g[0]]);
    }
    return out;
  }
  // great-circle intersection of two lines, returning points that fall on both spans
  function intersect(A, B) {
    const fa = A.f || (A.f = frame(A.o[0], A.o[1], A.brg)),
      fb = B.f || (B.f = frame(B.o[0], B.o[1], B.brg));
    const c = cross(fa.n, fb.n),
      m = Math.hypot(...c);
    if (m < 1e-10) return []; // same great circle
    const out = [];
    for (const s of [1, -1]) {
      const v = scale(c, s / m),
        g = ll(v);
      const ia = distToLine(A, g[0], g[1]),
        ib = distToLine(B, g[0], g[1]);
      if (ia.onSpan && ib.onSpan) {
        const ang = Math.acos(Math.min(1, Math.abs(dot(fa.n, fb.n)))) * R2D; // crossing angle 0..90
        out.push({ lat: g[0], lon: g[1], angle: ang });
      }
    }
    return out;
  }
  // best-fit great circle through N points: pole = eigenvector of smallest eigenvalue of Σ p pᵀ
  function bestFit(pts) {
    const M = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    for (const [lat, lon] of pts) {
      const p = vec(lat, lon);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) M[i][j] += p[i] * p[j];
    }
    const { vals, vecs } = jacobi(M);
    let k = 0;
    for (let i = 1; i < 3; i++) if (vals[i] < vals[k]) k = i;
    const n = norm([vecs[0][k], vecs[1][k], vecs[2][k]]);
    // origin = projection of first point onto the circle; bearing toward last point's projection
    const proj = p => norm(add(p, n, -dot(p, n)));
    const o = proj(vec(...pts[0])),
      z = proj(vec(...pts[pts.length - 1]));
    const og = ll(o),
      zg = ll(z);
    let brg = bearing(og[0], og[1], zg[0], zg[1]);
    return { o: og, brg, rmsKm: Math.sqrt(vals[k] / pts.length) * R };
  }
  function jacobi(A) {
    const a = A.map(r => r.slice()),
      v = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ];
    for (let sweep = 0; sweep < 60; sweep++) {
      let off = Math.abs(a[0][1]) + Math.abs(a[0][2]) + Math.abs(a[1][2]);
      if (off < 1e-18) break;
      for (const [p, q] of [
        [0, 1],
        [0, 2],
        [1, 2],
      ]) {
        if (Math.abs(a[p][q]) < 1e-20) continue;
        const th = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
        const c = 1 / Math.sqrt(t * t + 1),
          s = t * c;
        for (let k = 0; k < 3; k++) {
          const akp = a[k][p],
            akq = a[k][q];
          a[k][p] = c * akp - s * akq;
          a[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < 3; k++) {
          const apk = a[p][k],
            aqk = a[q][k];
          a[p][k] = c * apk - s * aqk;
          a[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < 3; k++) {
          const vkp = v[k][p],
            vkq = v[k][q];
          v[k][p] = c * vkp - s * vkq;
          v[k][q] = s * vkp + c * vkq;
        }
      }
    }
    return { vals: [a[0][0], a[1][1], a[2][2]], vecs: v };
  }
  // sunrise azimuth at the summer/winter solstice for latitude φ (flat horizon, no refraction)
  function solsticeAz(lat) {
    const e = 23.44 * D2R,
      c = Math.sin(e) / Math.cos(lat * D2R);
    if (Math.abs(c) >= 1) return null;
    const az = Math.acos(c) * R2D; // summer sunrise
    return { sumRise: az, winRise: 180 - az, sumSet: 360 - az, winSet: 180 + az };
  }
  // reproducible RNG
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  }
  function randomPoint(r) {
    const z = 2 * r() - 1,
      l = r() * 360 - 180;
    return [Math.asin(z) * R2D, l];
  }
  return {
    R,
    vec,
    ll,
    dot,
    cross,
    norm,
    add,
    scale,
    sampleRange,
    dist,
    bearing,
    dest,
    frame,
    pointAt,
    track,
    distToLine,
    sample,
    offsetSample,
    intersect,
    bestFit,
    solsticeAz,
    rng,
    randomPoint,
  };
})();
