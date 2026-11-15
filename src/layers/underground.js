// Underground layers: deposits, faults, plates, magnetic grids
import { GEO } from '../core/geo.js';
import { $, $$, D2R, esc, wrap } from '../core/util.js';
import { DEPOSITS, FAULTS, LANDMASK, PLATES, UKMAG, WMAG } from '../data/datasets.js';
import { enabledPoints } from '../domain/points.js';
import { dec } from '../map/basemap.js';
import { DPR, H, VIEW, W, ctx, inView } from '../map/canvas.js';
import { CAMV, req, visible } from '../map/draw.js';
import { fmtKm, satUrl } from '../core/format.js';
import { copyText } from '../panels/data-pane.js';
import { closeDetail } from '../panels/detail.js';
import { bindSiteRows } from '../panels/lines-pane.js';
import { C } from '../render/palette.js';
import { V2 } from '../state/preferences.js';
import { S } from '../state/state.js';
import { setSheet } from '../ui/sheet.js';
import { THEME } from '../ui/theme.js';

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
const PRIMK = {
  i: 'iron',
  c: 'copper',
  s: 'silver',
  g: 'gold',
  l: 'leadzinc',
  x: 'crystal',
  m: 'magnetite',
  o: 'other',
};
const STATUS = { p: 'Past producer', a: 'Producing when recorded', d: 'Deposit / occurrence' };
let DEP = null;
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
const depName = k => depData().names[k] || '';
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
function depNear(lat, lon, r, mask) {
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
function depNearest(lat, lon, mask, maxR = 400) {
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
let FLT = null,
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
function linePathG(P, pts) {
  // like ringPath, but lifts the pen behind the globe
  let pen = false,
    px = 1e9,
    py = 1e9;
  for (const q of pts) {
    if (CAMV) {
      const cl = Math.cos(q[1] * D2R),
        d =
          cl * Math.cos(q[0] * D2R) * CAMV[0] +
          cl * Math.sin(q[0] * D2R) * CAMV[1] +
          Math.sin(q[1] * D2R) * CAMV[2];
      if (d < 0.02) {
        pen = false;
        continue;
      }
    }
    const p = P(q);
    if (!p) {
      pen = false;
      continue;
    }
    if (!pen) {
      ctx.moveTo(p[0], p[1]);
      pen = true;
      px = p[0];
      py = p[1];
      continue;
    }
    if (Math.abs(p[0] - px) + Math.abs(p[1] - py) < 1) continue;
    ctx.lineTo(p[0], p[1]);
    px = p[0];
    py = p[1];
  }
}
const loRes = r => r.lo || (r.lo = r.pts.filter((q, i) => i % 4 === 0 || i === r.pts.length - 1));
function segDist(lat, lon, a, b) {
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
function plateNearest(lat, lon) {
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
const PLATE_NAMES = {
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
let LAND = null,
  MAG = null,
  WMAGD = null;
function decodePng(b64, cb) {
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
const mercY = la => Math.log(Math.tan(Math.PI / 4 + (la * D2R) / 2));
function gridAt(M, lat, lon) {
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
const magSrc = (lat, lon) => (gridAt(MAG, lat, wrap(lon)) != null ? 'uk' : 'world');
function magImage(MAG) {
  const key = THEME;
  if (MAG.img[key]) return MAG.img[key];
  const c = document.createElement('canvas');
  c.width = MAG.w;
  c.height = MAG.h;
  const x = c.getContext('2d'),
    id = x.createImageData(MAG.w, MAG.h);
  for (let i = 0; i < MAG.w * MAG.h; i++) {
    const q = MAG.a[i];
    if (!q) {
      id.data[i * 4 + 3] = 0;
      continue;
    }
    const t = (q - 128) / 127,
      a = Math.abs(t); // blue = weaker than average, red = stronger
    const r = t > 0 ? 255 : Math.round(255 * (1 - a * 0.85)),
      g = Math.round(255 * (1 - a * 0.75)),
      b = t < 0 ? 255 : Math.round(255 * (1 - a * 0.85));
    id.data[i * 4] = t > 0 ? Math.round(200 + 55 * (1 - a)) : r;
    id.data[i * 4 + 1] = g;
    id.data[i * 4 + 2] = t < 0 ? Math.round(200 + 55 * (1 - a)) : b;
    id.data[i * 4 + 3] = Math.round(70 + 150 * Math.min(1, a * 1.4));
  }
  x.putImageData(id, 0, 0);
  return (MAG.img[key] = c);
}
export function drawMag(P) {
  if (S.view !== 'map') return;
  ctx.save();
  ctx.globalAlpha = (0.85 * V2.overlayOpacity) / 100;
  for (const M of [WMAGD, MAG]) {
    // world first, Britain's detailed survey on top
    if (!M) continue;
    const G = M.G,
      pt = P([S.cam.lon, G.lat1]),
      pb = P([S.cam.lon, G.lat0]);
    if (!pt || !pb) continue;
    // placed by longitude maths, not by projecting the corners: the map is centred on the camera, so ±180° can fall mid-screen
    const s = S.cam.k * Math.cos(S.cam.lat * D2R),
      worldW = 2 * Math.PI * s,
      ax = W / 2 + wrap(G.lon0 - S.cam.lon) * D2R * s,
      dw = (G.lon1 - G.lon0) * D2R * s,
      ay = pt[1],
      dh = pb[1] - pt[1];
    if (dw <= 0 || dh <= 0) continue;
    for (const off of [-worldW, 0, worldW]) {
      // the copy either side covers the seam
      const a0 = ax + off,
        x0 = Math.max(0, a0),
        y0 = Math.max(0, ay),
        x1 = Math.min(W, a0 + dw),
        y1 = Math.min(H, ay + dh);
      if (x1 <= x0 || y1 <= y0) continue;
      const sx = ((x0 - a0) / dw) * M.w,
        sy = ((y0 - ay) / dh) * M.h,
        sw = ((x1 - x0) / dw) * M.w,
        sh = ((y1 - y0) / dh) * M.h; // crop to what is on screen
      ctx.imageSmoothingEnabled = M === WMAGD || VIEW.rv > 60;
      ctx.drawImage(magImage(M), sx, sy, Math.max(sw, 0.5), Math.max(sh, 0.5), x0, y0, x1 - x0, y1 - y0);
    }
  }
  ctx.restore();
}
export function ugMask() {
  let m = 0;
  for (const g of UG) if (S.under[g[0]]) m |= UGBIT[g[0]];
  return m;
}
// soft density shading: bins screen points into cells, one radial glow per cell in the dominant colour
let HEATCV = null;
const CLEARC = new Map();
export function clear(col) {
  // same colour, fully transparent
  let c = CLEARC.get(col);
  if (c) return c;
  const x = document.createElement('canvas').getContext('2d');
  x.fillStyle = col;
  const v = x.fillStyle;
  if (v[0] === '#') {
    const n = parseInt(v.slice(1), 16);
    c = `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},0)`;
  } else c = v.replace(/rgba?\(([^,]+),([^,]+),([^,)]+).*$/, 'rgba($1,$2,$3,0)');
  CLEARC.set(col, c);
  return c;
}
function heatDraw(cells, colOf, label) {
  // blobs are painted on their own sheet first, then laid over the map once,
  // so overlapping blobs build up colour without darkening the map underneath
  const op = (typeof V2 !== 'undefined' ? V2.overlayOpacity : 100) / 100;
  if (!HEATCV) HEATCV = document.createElement('canvas');
  const w = Math.round(W * DPR),
    h = Math.round(H * DPR);
  if (HEATCV.width !== w || HEATCV.height !== h) {
    HEATCV.width = w;
    HEATCV.height = h;
  }
  const hx = HEATCV.getContext('2d');
  hx.setTransform(1, 0, 0, 1, 0, 0);
  hx.clearRect(0, 0, w, h);
  hx.setTransform(DPR, 0, 0, DPR, 0, 0);
  for (const c of cells.values()) {
    let top = null,
      best = 0;
    for (const [k, v] of Object.entries(c.by))
      if (v > best) {
        best = v;
        top = k;
      }
    const x = c.x / c.n,
      y = c.y / c.n,
      r = 12 + Math.min(18, Math.log2(c.n + 1) * 4),
      col = colOf(top);
    const g = hx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col);
    g.addColorStop(1, clear(col));
    hx.globalAlpha = Math.min(1, 0.35 + Math.log2(c.n + 1) * 0.12);
    hx.fillStyle = g;
    hx.beginPath();
    hx.arc(x, y, r, 0, 7);
    hx.fill();
    HITS_UG.push({ x, y, r: Math.max(14, r * 0.55), type: 'ugheat', ref: { n: c.n, label }, pri: -1 });
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 0.55 * op;
  ctx.drawImage(HEATCV, 0, 0);
  ctx.restore();
}
function heatAdd(cells, x, y, key, cell = 22) {
  const k = Math.floor(x / cell) + ',' + Math.floor(y / cell);
  let c = cells.get(k);
  if (!c) cells.set(k, (c = { x: 0, y: 0, n: 0, by: {} }));
  c.x += x;
  c.y += y;
  c.n++;
  c.by[key] = (c.by[key] || 0) + 1;
}
export function drawUnder(P, B, rv) {
  if (S.under.plates) {
    ctx.beginPath();
    for (const r of plateData()) if (inView(r.b, B)) linePathG(P, r.pts);
    ctx.strokeStyle = C.plate;
    ctx.lineWidth = 2.2;
    ctx.setLineDash([10, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (S.under.faults && typeof V2 !== 'undefined' && V2.ugFault === 'heat') {
    const F = faultData(),
      cells = new Map();
    for (const r of F.rows) {
      if (!inView(r.b, B)) continue;
      for (const q of rv > 800 ? loRes(r) : r.pts) {
        if (CAMV) {
          const cl = Math.cos(q[1] * D2R);
          if (
            cl * Math.cos(q[0] * D2R) * CAMV[0] +
              cl * Math.sin(q[0] * D2R) * CAMV[1] +
              Math.sin(q[1] * D2R) * CAMV[2] <
            0.02
          )
            continue;
        }
        const p = P(q);
        if (!p || p[0] < -20 || p[0] > W + 20 || p[1] < -20 || p[1] > H + 20) continue;
        heatAdd(cells, p[0], p[1], 'f');
      }
    }
    heatDraw(cells, () => C.fault, 'mapped fault points');
  } else if (S.under.faults) {
    const F = faultData(),
      minLen = rv > 3000 ? 0.8 : rv > 1200 ? 0.3 : rv > 400 ? 0.08 : 0;
    ctx.beginPath();
    for (const r of F.rows) {
      if (!inView(r.b, B)) continue;
      if (minLen && r.b[2] - r.b[0] + (r.b[3] - r.b[1]) < minLen) continue;
      linePathG(P, rv > 800 ? loRes(r) : r.pts);
    }
    ctx.strokeStyle = C.fault;
    ctx.lineWidth = rv < 200 ? 2 : 1.3;
    ctx.stroke();
    if (rv < 150)
      for (const r of F.rows) {
        if (!r.name || !inView(r.b, B)) continue;
        const mid = r.pts[r.pts.length >> 1],
          q = visible(P, mid[0], mid[1]);
        if (q) HITS_UG.push({ x: q[0], y: q[1], r: 14, type: 'fault', ref: r, pri: 0 });
      }
  }
  const mask = ugMask();
  if (!mask) return;
  const heat = typeof V2 !== 'undefined' && V2.ugDep === 'heat',
    heatGroups = heat ? UG.map(([g]) => g).filter(g => S.under[g]) : [],
    cells = heat ? Object.fromEntries(heatGroups.map(g => [g, new Map()])) : null;
  depVecs(0);
  const D = depData(),
    sz = rv > 2500 ? 2 : rv > 600 ? 2.6 : rv > 80 ? 4 : 5,
    onlyBig = rv > 1200 && !heat,
    groups = new Map();
  const order = ['silver', 'copper', 'iron', 'crystal', 'leadzinc', 'gold', 'other'];
  const colOf = k => {
    const p = depPrim(k),
      pk = p === 'magnetite' ? 'iron' : p;
    if (S.under[pk]) return C.dep[pk];
    for (const g of order) if (S.under[g] && D.m[k] & UGBIT[g]) return C.dep[g];
    return C.dep.other;
  };
  const la0 = B ? Math.floor(B.lat0) : -90,
    la1 = B ? Math.floor(B.lat1) : 89,
    lh = B ? Math.ceil(B.lh) + 1 : 180,
    lc = Math.floor(S.cam.lon);
  for (let a = la0; a <= la1; a++)
    for (let d = -lh; d <= lh; d++) {
      const b = ((((lc + d + 180) % 360) + 360) % 360) - 180,
        arr = D.grid.get(a * 400 + b);
      if (!arr) continue;
      for (const k of arr) {
        if (D.approx[k] || !(D.m[k] & mask) || (onlyBig && !D.big[k])) continue;
        if (CAMV && DEPV[k * 3] * CAMV[0] + DEPV[k * 3 + 1] * CAMV[1] + DEPV[k * 3 + 2] * CAMV[2] < 0.01)
          continue;
        const p = P([D.lon[k], D.lat[k]]);
        if (!p || p[0] < -10 || p[0] > W + 10 || p[1] < -10 || p[1] > H + 10) continue;
        if (heat) {
          for (const g of heatGroups) if (D.m[k] & UGBIT[g]) heatAdd(cells[g], p[0], p[1], g);
          continue;
        } // a deposit counts for every switched-on mineral it contains
        const col = colOf(k);
        let g = groups.get(col);
        if (!g) groups.set(col, (g = []));
        g.push(p[0], p[1]);
        if (rv < 400) HITS_UG.push({ x: p[0], y: p[1], r: 9, type: 'dep', ref: k, pri: 0 });
      }
    }
  if (heat) {
    for (const g of ['other', 'gold', 'leadzinc', 'crystal', 'silver', 'copper', 'iron'])
      if (cells[g]) heatDraw(cells[g], () => C.dep[g], UGNAME[g].toLowerCase() + ' records');
    return;
  } // each mineral shaded in its own point colour, on its own sheet so colours don't mix into mud
  for (const [col, a] of groups) {
    if (sz < 3) {
      ctx.fillStyle = col;
      const h = sz * 0.85;
      for (let i = 0; i < a.length; i += 2) ctx.fillRect(a[i] - h, a[i + 1] - h, h * 2, h * 2);
      continue;
    } // cheap squares when zoomed out
    ctx.beginPath();
    for (let i = 0; i < a.length; i += 2) {
      const x = a[i],
        y = a[i + 1];
      ctx.moveTo(x, y - sz);
      ctx.lineTo(x + sz, y);
      ctx.lineTo(x, y + sz);
      ctx.lineTo(x - sz, y);
      ctx.closePath();
    }
    ctx.fillStyle = col;
    ctx.fill();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = C.depEdge;
    ctx.stroke();
  }
}
export let HITS_UG = [];
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
export function ugBlock(s) {
  const u = undergroundAt(s.lat, s.lon);
  const rows = u.groups
    .map(
      ({ g, near, d }) =>
        `<tr data-dep="${near ? near.k : ''}"><td><span class="ugsw" style="background:${C.dep[g]}"></span>${esc(UGNAME[g])}</td><td>${near ? esc(near.n) + `<div class="small">${esc(near.status)}${near.magnetite ? ' · magnetite' : ''}</div>` : '<span class="small">none within 300 km in the data</span>'}</td><td class="n">${d != null ? fmtKm(d) : '—'}</td></tr>`,
    )
    .join('');
  const thin = u.n100 < 5;
  return `<h2>What’s underground nearby</h2>
  <p class="small" style="margin:-2px 0 8px">Nearest recorded deposit of each kind. Distances are to the deposit’s map point, not to the ore body itself.</p>
  <div class="tblwrap"><table class="tbl"><tr><th>Kind</th><th>Nearest recorded</th><th style="text-align:right">Distance</th></tr>${rows}</table></div>
  <div class="statgrid"><div><span>Within 10 km</span><b>${u.n10}</b></div><div><span>Within 50 km</span><b>${u.n50}</b></div><div><span>Within 100 km</span><b>${u.n100}</b></div></div>
  ${thin ? `<p class="note warn">Very few deposits are recorded around here. That can mean poor data coverage for this country, not empty ground: the deposit lists are most complete for the USA and Canada.</p>` : ''}
  <dl class="kv" style="margin-top:10px">
    <dt>Active fault</dt><dd class="t">${u.fault ? `${fmtKm(u.fault.d)} · ${esc(u.fault.r.name || 'unnamed')}${u.fault.r.st ? ' (' + esc(u.fault.r.st.replace(/_/g, ' ').toLowerCase()) + ')' : ''}` : 'none mapped within ~300 km'}</dd>
    <dt>Plate boundary</dt><dd class="t">${u.plate ? `${fmtKm(u.plate.d)} · ${esc(plateLabel(u.plate.r.name))}` : '—'}</dd>
    ${u.mag != null ? `<dt>Magnetic field</dt><dd class="t">${u.mag > 0 ? '+' : ''}${Math.round(u.mag)} nT vs the regional average: ${magWord(u.mag)}. ${magSrc(s.lat, s.lon) === 'uk' ? 'From the Britain survey (2 km detail). Most of Britain lies between −170 and +300 nT.' : 'From the world magnetic model (about 25 km detail, so it shows the regional rock, not one building).'}</dd>` : ''}
  </dl>`;
}
export function showDeposit(k) {
  const d = depInfo(k),
    el = $('#p-detail');
  const nearSites = enabledPoints()
    .map(p => ({ p, d: GEO.dist(d.lat, d.lon, p.lat, p.lon) }))
    .filter(o => o.d < 25)
    .sort((a, b) => a.d - b.d)
    .slice(0, 8);
  el.innerHTML = `<button class="back" id="d-back">← Back</button><div class="detail"><div class="row"><span class="ugsw lg" style="background:${C.dep[d.prim === 'magnetite' ? 'iron' : d.prim]}"></span><span class="small">Mineral deposit · ${esc(d.cc)}</span></div>
  <h3>${esc(d.n)}</h3>
  <dl class="kv" style="margin-top:10px"><dt>Minerals</dt><dd class="t">${esc(d.groups.join(', '))}${d.magnetite ? ' (magnetite recorded)' : ''}</dd><dt>Status</dt><dd class="t">${esc(d.status)}</dd>${d.type ? `<dt>Deposit type</dt><dd class="t">${esc(d.type)}</dd>` : ''}<dt>Position</dt><dd>${d.lat.toFixed(4)}, ${d.lon.toFixed(4)}</dd><dt>Source</dt><dd class="t">${esc(d.src)}</dd></dl>
  <div class="wrap" style="margin:12px 0"><a class="btn" href="${satUrl(d.lat, d.lon, 15)}" target="_blank" rel="noopener">Google Maps ↗</a><button class="btn ghost" id="d-copy">Copy coords</button></div>
  <h2>Sites within 25 km</h2>${nearSites.length ? `<div class="tblwrap"><table class="tbl">${nearSites.map(o => `<tr data-site="${esc(o.p.id)}"><td>${esc(o.p.n)}</td><td class="n">${fmtKm(o.d)}</td></tr>`).join('')}</table></div>` : '<p class="empty">No switched-on sites within 25 km.</p>'}</div>`;
  $('#d-back').onclick = () => {
    S.sel = null;
    closeDetail();
    req();
  };
  $('#d-copy').onclick = () => copyText(`${d.lat.toFixed(5)}, ${d.lon.toFixed(5)}`);
  bindSiteRows('#p-detail');
  $$('.pane').forEach(p => (p.hidden = p.id !== 'p-detail'));
  el.scrollTop = 0;
  if ($('#sheet').classList.contains('peek')) setSheet('half');
}
export function showFault(r) {
  const el = $('#p-detail');
  el.innerHTML = `<button class="back" id="d-back">← Back</button><div class="detail"><span class="small">Active fault</span><h3>${esc(r.name || 'Unnamed fault')}</h3><dl class="kv" style="margin-top:10px"><dt>Movement</dt><dd class="t">${esc((r.st || 'not recorded').replace(/_/g, ' '))}</dd><dt>Catalogue</dt><dd class="t">${esc(r.cat)}</dd><dt>Source</dt><dd class="t">GEM Global Active Faults Database (CC BY-SA 4.0)</dd></dl><p class="note">“Active” means it has moved in the recent geological past and can produce earthquakes. Old, inactive faults are not in this map.</p></div>`;
  $('#d-back').onclick = () => {
    closeDetail();
    req();
  };
  $$('.pane').forEach(p => (p.hidden = p.id !== 'p-detail'));
  el.scrollTop = 0;
  if ($('#sheet').classList.contains('peek')) setSheet('half');
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
function loadMagneticGrids(onGrid) {
  decodePng(UKMAG.png, (d, w, h) => {
    const a = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) a[i] = d[i * 4];
    MAG = { a, w, h, img: {}, G: UKMAG };
    V2.disc = null;
    V2.magCache = null;
    req();
    onGrid?.();
  });
  decodePng(WMAG.png, (d, w, h) => {
    const a = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) a[i] = d[i * 4];
    WMAGD = { a, w, h, img: {}, G: WMAG };
    V2.disc = null;
    V2.magCache = null;
    req();
    onGrid?.();
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

// Setters for variables that other modules change.
export function setHITS_UG(v) {
  return (HITS_UG = v);
}
