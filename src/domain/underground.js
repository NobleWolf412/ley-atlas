// Underground data: mineral deposits, faults, plate boundaries and magnetic grids (lookups only, no drawing)
import { DEPOSITS, FAULTS, LANDMASK, PLATES, UKMAG, WMAG } from '../data/datasets.js';
import { D2R, wrap } from '../core/util.js';
import { GEO } from '../core/geo.js';
import { dec } from '../core/polyline.js';
import { S } from '../state/state.js';
import { V2 } from '../state/preferences.js';

// ================= underground: mineral deposits, faults, plates, UK magnetic survey =================
export const UG = [
  ['iron', 'Iron ore', 'Iron ore, including magnetite where the record says so'],
  ['copper', 'Copper', 'Copper deposits and mines'],
  ['silver', 'Silver', 'Any deposit that records silver, including silver-bearing lead–zinc'],
  ['gold', 'Gold', 'Gold deposits (the largest group in the data)'],
  ['leadzinc', 'Lead & zinc', 'Lead–zinc deposits (galena often carries silver)'],
  ['crystal', 'Quartz, gems & crystals', 'Quartz, gemstones, pegmatites, diamonds'],
  ['other', 'Other minerals', 'Everything else: tin, manganese, uranium, salt, phosphate…'],
];
export const UGBIT = {
  iron: 1,
  copper: 2,
  silver: 4,
  gold: 8,
  leadzinc: 16,
  crystal: 32,
  magnetite: 64,
  other: 128,
};
export let UGNAME;
export const PRIMK = {
  i: 'iron',
  c: 'copper',
  s: 'silver',
  g: 'gold',
  l: 'leadzinc',
  x: 'crystal',
  m: 'magnetite',
  o: 'other',
};
export const STATUS = { p: 'Past producer', a: 'Producing when recorded', d: 'Deposit / occurrence' };
export let DEP = null;
export function depData() {
  if (DEP) return DEP;
  const n = DEPOSITS.n,
    lat = new Float32Array(n),
    lon = new Float32Array(n),
    m = new Uint8Array(n),
    big = new Uint8Array(n),
    grid = new Map();
  let i = 0,
    x = 0,
    y = 0,
    k;
  const s = DEPOSITS.pts;
  const nxt = () => {
    let r = 0,
      sh = 0,
      b;
    do {
      b = s.charCodeAt(i++) - 63;
      r |= (b & 0x1f) << sh;
      sh += 5;
    } while (b >= 0x20);
    return r & 1 ? ~(r >> 1) : r >> 1;
  };
  for (k = 0; k < n; k++) {
    y += nxt();
    x += nxt();
    lat[k] = y / 1e4;
    lon[k] = x / 1e4;
    m[k] = parseInt(DEPOSITS.m.substr(k * 2, 2), 16);
    big[k] = DEPOSITS.st[k] === DEPOSITS.st[k].toUpperCase() ? 1 : 0;
    const key = Math.floor(lat[k]) * 400 + Math.floor(lon[k]);
    let a = grid.get(key);
    if (!a) grid.set(key, (a = []));
    a.push(k);
  }
  // Records stacked on one shared point with unrelated names sit on a country or county centre, not on the mine itself.
  const approx = new Uint8Array(n),
    stack = new Map(),
    nm = DEPOSITS.names.split('|');
  for (let k = 0; k < n; k++) {
    const key = lat[k] + '|' + lon[k];
    let a = stack.get(key);
    if (!a) stack.set(key, (a = []));
    a.push(k);
  }
  let nApprox = 0;
  for (const a of stack.values()) {
    if (a.length < 4) continue;
    const pre = new Map();
    for (const k of a) {
      const p = (nm[k] || '')
        .toLowerCase()
        .replace(/[^a-z]/g, '')
        .slice(0, 6);
      pre.set(p, (pre.get(p) || 0) + 1);
    }
    if (Math.max(...pre.values()) / a.length >= 0.6) continue;
    for (const k of a) {
      approx[k] = 1;
      nApprox++;
    }
  }
  DEP = { n, lat, lon, m, big, grid, approx, nApprox, names: nm };
  return DEP;
}
export const depName = k => depData().names[k] || '';
export const depPrim = k => PRIMK[DEPOSITS.p[k]];
export function depInfo(k) {
  const D = depData(),
    b36 = c => '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.indexOf(c);
  const ti = b36(DEPOSITS.ty[k * 2]) * 62 + b36(DEPOSITS.ty[k * 2 + 1]),
    ci = b36(DEPOSITS.cc[k * 2]) * 62 + b36(DEPOSITS.cc[k * 2 + 1]);
  const mk = D.m[k],
    groups = UG.filter(g => mk & UGBIT[g[0]]).map(g => g[1]);
  return {
    k,
    n: depName(k) || 'Unnamed ' + (UGNAME[depPrim(k)] || 'iron ore').toLowerCase() + ' site',
    lat: D.lat[k],
    lon: D.lon[k],
    prim: depPrim(k),
    groups,
    magnetite: !!(mk & 64),
    status: STATUS[DEPOSITS.st[k].toLowerCase()] || '',
    type: DEPOSITS.types[ti] || '',
    cc: DEPOSITS.ccl[ci] || '',
    src: DEPOSITS.srcs[DEPOSITS.src.charCodeAt(k) - 97],
  };
}
// all deposits within r km of a point (optionally matching a bit mask)
export function depNear(lat, lon, r, mask) {
  const D = depData(),
    out = [],
    dl = Math.ceil(r / 111),
    clat = Math.cos(Math.min(85, Math.abs(lat)) * D2R),
    dn = Math.ceil(r / (111 * Math.max(0.05, clat)));
  const la0 = Math.floor(lat),
    lo0 = Math.floor(lon);
  for (let a = la0 - dl; a <= la0 + dl; a++)
    for (let b = lo0 - dn; b <= lo0 + dn; b++) {
      const bb = ((((b + 180) % 360) + 360) % 360) - 180,
        arr = D.grid.get(a * 400 + bb);
      if (!arr) continue;
      for (const k of arr) {
        if (D.approx[k] || (mask && !(D.m[k] & mask))) continue;
        if (Math.abs(D.lat[k] - lat) > r / 111 + 0.01) continue;
        const d = GEO.dist(lat, lon, D.lat[k], D.lon[k]);
        if (d <= r) out.push({ k, d });
      }
    }
  return out.sort((a, b) => a.d - b.d);
}
export function depNearest(lat, lon, mask, maxR = 400) {
  for (const r of [10, 50, 150, maxR]) {
    const a = depNear(lat, lon, r, mask);
    if (a.length) return a[0];
  }
  return null;
}
export function depAnyWithin(lat, lon, r, mask) {
  const D = depData(),
    dl = Math.ceil(r / 111),
    clat = Math.cos(Math.min(85, Math.abs(lat)) * D2R),
    dn = Math.ceil(r / (111 * Math.max(0.05, clat))),
    la0 = Math.floor(lat),
    lo0 = Math.floor(lon);
  for (let a = la0 - dl; a <= la0 + dl; a++)
    for (let b = lo0 - dn; b <= lo0 + dn; b++) {
      const bb = ((((b + 180) % 360) + 360) % 360) - 180,
        arr = D.grid.get(a * 400 + bb);
      if (!arr) continue;
      for (const k of arr) {
        if (D.approx[k] || (mask && !(D.m[k] & mask))) continue;
        if (Math.abs(D.lat[k] - lat) > r / 111 + 0.01) continue;
        if (GEO.dist(lat, lon, D.lat[k], D.lon[k]) <= r) return true;
      }
    }
  return false;
}
export let DEPV = null;
export function depVecs(mask) {
  // builds the unit-vector table once; returns vectors only when a mask is given
  const D = depData();
  if (!DEPV) {
    DEPV = new Float32Array(D.n * 3);
    for (let k = 0; k < D.n; k++) {
      const v = GEO.vec(D.lat[k], D.lon[k]);
      DEPV[k * 3] = v[0];
      DEPV[k * 3 + 1] = v[1];
      DEPV[k * 3 + 2] = v[2];
    }
  }
  if (!mask) return null;
  const out = [];
  for (let k = 0; k < D.n; k++) if (D.m[k] & mask) out.push([DEPV[k * 3], DEPV[k * 3 + 1], DEPV[k * 3 + 2]]);
  return out;
}
// faults & plates
export let FLT = null,
  PLT = null;
export function faultData() {
  if (FLT) return FLT;
  const rows = FAULTS.f.map(r => ({
    pts: dec(r[0]),
    b: r[1],
    name: r[2],
    st: FAULTS.st[r[3]] || '',
    cat: FAULTS.cat[r[4]] || '',
  }));
  const grid = new Map();
  rows.forEach((r, i) => {
    for (let a = Math.floor(r.b[1]); a <= Math.floor(r.b[3]); a++)
      for (let b = Math.floor(r.b[0]); b <= Math.floor(r.b[2]); b++) {
        const key = a * 400 + b;
        let g = grid.get(key);
        if (!g) grid.set(key, (g = []));
        g.push(i);
      }
  });
  return (FLT = { rows, grid });
}
export function plateData() {
  return PLT || (PLT = PLATES.map(r => ({ pts: dec(r[0]), b: r[1], name: r[2] })));
}
export function segDist(lat, lon, a, b) {
  // km from point to segment a-b ([lon,lat]); small-segment planar approx in local km
  const c = Math.cos(lat * D2R),
    ax = (a[0] - lon) * c * 111.32,
    ay = (a[1] - lat) * 110.57,
    bx = (b[0] - lon) * c * 111.32,
    by = (b[1] - lat) * 110.57;
  const dx = bx - ax,
    dy = by - ay,
    L = dx * dx + dy * dy;
  let t = L ? -(ax * dx + ay * dy) / L : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(ax + t * dx, ay + t * dy);
}
export function faultNearest(lat, lon, maxDeg = 3) {
  const F = faultData();
  let best = null;
  const seen = new Set();
  for (let a = Math.floor(lat) - maxDeg; a <= Math.floor(lat) + maxDeg; a++)
    for (let b = Math.floor(lon) - maxDeg; b <= Math.floor(lon) + maxDeg; b++) {
      const g = F.grid.get(a * 400 + b);
      if (!g) continue;
      for (const i of g) {
        if (seen.has(i)) continue;
        seen.add(i);
        const r = F.rows[i];
        for (let j = 0; j < r.pts.length - 1; j++) {
          const d = segDist(lat, lon, r.pts[j], r.pts[j + 1]);
          if (!best || d < best.d) best = { d, r };
        }
      }
    }
  return best;
}
export function plateNearest(lat, lon) {
  let best = null;
  for (const r of plateData()) {
    if (lat < r.b[1] - 25 || lat > r.b[3] + 25) continue;
    for (let j = 0; j < r.pts.length - 1; j++) {
      const a = r.pts[j],
        b = r.pts[j + 1];
      if (Math.abs(wrap(a[0] - lon)) > 60) continue;
      const d = segDist(lat, lon, a, b);
      if (!best || d < best.d) best = { d, r };
    }
  }
  return best;
}
export const PLATE_NAMES = {
  AF: 'African',
  AN: 'Antarctic',
  AR: 'Arabian',
  AU: 'Australian',
  CA: 'Caribbean',
  CO: 'Cocos',
  EU: 'Eurasian',
  IN: 'Indian',
  NA: 'North American',
  NZ: 'Nazca',
  PA: 'Pacific',
  SA: 'South American',
  SO: 'Somali',
  PS: 'Philippine Sea',
  JF: 'Juan de Fuca',
  AT: 'Anatolian',
  AS: 'Aegean Sea',
  YA: 'Yangtze',
  AM: 'Amurian',
  OK: 'Okhotsk',
  ON: 'Okinawa',
  SU: 'Sunda',
  BU: 'Burma',
  SC: 'Scotia',
  SW: 'Sandwich',
  CR: 'Caroline',
  BS: 'Banda Sea',
  MS: 'Molucca Sea',
  TI: 'Timor',
  BH: 'Birds Head',
  MA: 'Mariana',
  NB: 'North Bismarck',
  SB: 'South Bismarck',
  SS: 'Solomon Sea',
  WL: 'Woodlark',
  FT: 'Futuna',
  NI: 'Niuafo’ou',
  TO: 'Tonga',
  KE: 'Kermadec',
  NH: 'New Hebrides',
  CL: 'Conway Reef',
  BR: 'Balmoral Reef',
  MN: 'Manus',
  EA: 'Easter',
  JZ: 'Juan Fernandez',
  GP: 'Galápagos',
  RI: 'Rivera',
  ND: 'North Andes',
  AP: 'Altiplano',
  PM: 'Panama',
};
export const plateLabel = n =>
  n
    .split(/[-/\\]/)
    .map(c => PLATE_NAMES[c] || c)
    .join(' – ');
// land mask & magnetic grids (decoded from embedded PNGs): detailed Britain survey + world model
export let LAND = null,
  MAG = null,
  WMAGD = null;
export function decodePng(b64, cb) {
  const im = new Image();
  im.onload = () => {
    const c = document.createElement('canvas');
    c.width = im.width;
    c.height = im.height;
    const x = c.getContext('2d');
    x.drawImage(im, 0, 0);
    cb(x.getImageData(0, 0, im.width, im.height).data, im.width, im.height);
  };
  im.src = 'data:image/png;base64,' + b64;
}
export const landAt = (lat, lon) => {
  if (!LAND) return true;
  const r = Math.min(LAND.h - 1, Math.max(0, Math.floor((90 - lat) / LANDMASK.res))),
    c = Math.min(LAND.w - 1, Math.max(0, Math.floor((wrap(lon) + 180) / LANDMASK.res)));
  return LAND.a[r * LAND.w + c] === 1;
};
export const mercY = la => Math.log(Math.tan(Math.PI / 4 + (la * D2R) / 2));
export function gridAt(M, lat, lon) {
  // value (nT) from a Mercator-row grid, or null outside it / where it has no data
  const G = M && M.G;
  if (!G || lat < G.lat0 || lat > G.lat1 || lon < G.lon0 || lon > G.lon1) return null;
  const y0 = mercY(G.lat0),
    y1 = mercY(G.lat1),
    r = Math.floor(((y1 - mercY(lat)) / (y1 - y0)) * M.h),
    c = Math.floor(((lon - G.lon0) / (G.lon1 - G.lon0)) * M.w);
  const q = M.a[Math.max(0, Math.min(M.h - 1, r)) * M.w + Math.max(0, Math.min(M.w - 1, c))];
  if (!q) return null;
  const t = Math.max(-0.995, Math.min(0.995, (q - 128) / 127));
  return G.scale * Math.atanh(t);
}
// magnetic anomaly: the 2 km Britain survey where it exists, otherwise the world model (~25 km detail, land and sea)
export function magAt(lat, lon) {
  const v = gridAt(MAG, lat, wrap(lon));
  return v != null ? v : gridAt(WMAGD, lat, wrap(lon));
}
export const magSrc = (lat, lon) => (gridAt(MAG, lat, wrap(lon)) != null ? 'uk' : 'world');
export function ugMask() {
  let m = 0;
  for (const g of UG) if (S.under[g[0]]) m |= UGBIT[g[0]];
  return m;
}
// summary of what lies under / near one point (used by site cards)
export function undergroundAt(lat, lon) {
  const res = { groups: [], fault: null, plate: null, mag: magAt(lat, lon), n10: 0, n50: 0, n100: 0 };
  for (const [g] of UG) {
    const a = depNearest(lat, lon, UGBIT[g], 300);
    res.groups.push({ g, near: a ? depInfo(a.k) : null, d: a ? a.d : null });
  }
  res.n10 = depNear(lat, lon, 10).length;
  res.n50 = depNear(lat, lon, 50).length;
  res.n100 = depNear(lat, lon, 100).length;
  res.fault = faultNearest(lat, lon, 3);
  res.plate = plateNearest(lat, lon);
  return res;
}
export function magWord(v) {
  const a = Math.abs(v);
  return a < 60
    ? 'ordinary (close to the regional average)'
    : a < 200
      ? v > 0
        ? 'moderately stronger than average'
        : 'moderately weaker than average'
      : v > 0
        ? 'strongly above average: magnetic rock nearby'
        : 'strongly below average';
}
export function initUnderground() {
  UGNAME = Object.fromEntries(UG.map(g => [g[0], g[1]]));
  decodePng(LANDMASK.png, (d, w, h) => {
    const a = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) a[i] = d[i * 4] > 127 ? 1 : 0;
    LAND = { a, w, h };
  });
}
/** Decodes the magnetic grids. Called when the deferred datasets arrive. */
export function loadMagneticGrids(onGrid) {
  decodePng(UKMAG.png, (d, w, h) => {
    const a = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) a[i] = d[i * 4];
    MAG = { a, w, h, img: {}, G: UKMAG };
    V2.disc = null;
    V2.magCache = null;
    onGrid?.(); // the caller redraws
  });
  decodePng(WMAG.png, (d, w, h) => {
    const a = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) a[i] = d[i * 4];
    WMAGD = { a, w, h, img: {}, G: WMAG };
    V2.disc = null;
    V2.magCache = null;
    onGrid?.(); // the caller redraws
  });
}
/**
 * Drops everything derived from the deferred datasets and decodes the magnetic grids.
 * @param {() => void} [onGrid] called each time a magnetic grid has finished decoding
 */
export function resetUndergroundData(onGrid) {
  DEP = null;
  DEPV = null;
  FLT = null;
  PLT = null;
  loadMagneticGrids(onGrid);
}
