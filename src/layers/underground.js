// Draws the underground layers on the map: deposits, faults, plates, magnetic grids
import { mercY } from '../domain/underground.js';
import { req } from '../map/draw.js';
import {
  DEPV,
  MAG,
  UG,
  UGBIT,
  UGNAME,
  WMAGD,
  depData,
  depPrim,
  depVecs,
  faultData,
  plateData,
  ugMask,
} from '../domain/underground.js';
import { D2R, wrap } from '../core/util.js';
import { DPR, H, VIEW, W, ctx, inView } from '../map/canvas.js';
import { CAMV, visible } from '../map/draw.js';
import { C } from '../render/palette.js';
import { V2 } from '../state/preferences.js';
import { S } from '../state/state.js';

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
function magImage(MAG) {
  const key = document.documentElement.dataset.theme; // one cached image per theme
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
// ---- magnetic layer on the globe ----
// The flat map can stretch the stored picture into place. On the globe every screen cell is
// traced back to its latitude and longitude instead, and coloured from the grids directly.
const MAG_LUT = (() => {
  // the same colours as magImage: blue = weaker than average, red = stronger
  const lut = new Uint8ClampedArray(256 * 4);
  for (let q = 1; q < 256; q++) {
    const t = (q - 128) / 127,
      a = Math.abs(t);
    lut[q * 4] = t > 0 ? Math.round(200 + 55 * (1 - a)) : Math.round(255 * (1 - a * 0.85));
    lut[q * 4 + 1] = Math.round(255 * (1 - a * 0.75));
    lut[q * 4 + 2] = t < 0 ? Math.round(200 + 55 * (1 - a)) : Math.round(255 * (1 - a * 0.85));
    lut[q * 4 + 3] = Math.round(70 + 150 * Math.min(1, a * 1.4));
  }
  return lut;
})();
// the stored value (1–255, 0 = no data) of a grid at a place
function gridByte(M, lat, lon) {
  const G = M.G;
  if (lat < G.lat0 || lat > G.lat1 || lon < G.lon0 || lon > G.lon1) return 0;
  const y0 = mercY(G.lat0),
    y1 = mercY(G.lat1),
    r = Math.min(M.h - 1, Math.max(0, Math.floor(((y1 - mercY(lat)) / (y1 - y0)) * M.h))),
    c = Math.min(M.w - 1, Math.max(0, Math.floor(((lon - G.lon0) / (G.lon1 - G.lon0)) * M.w)));
  return M.a[r * M.w + c];
}
let GLOBEMAG = null; // { key, step, cv }
export function drawMagGlobe() {
  if (S.view !== 'globe' || (!WMAGD && !MAG)) return;
  const key = [S.cam.lon, S.cam.lat, S.cam.k, W, H].join('|');
  // coarse while the globe is moving, fine once it has stopped
  const still = GLOBEMAG && GLOBEMAG.key === key;
  const step = still ? 3 : 7;
  if (!still || GLOBEMAG.step !== step) {
    const w = Math.ceil(W / step),
      h = Math.ceil(H / step),
      cv = (GLOBEMAG && GLOBEMAG.cv) || document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const g = cv.getContext('2d'),
      img = g.createImageData(w, h),
      px = img.data;
    const k = S.cam.k,
      sin0 = Math.sin(S.cam.lat * D2R),
      cos0 = Math.cos(S.cam.lat * D2R);
    for (let j = 0; j < h; j++) {
      const y = (H / 2 - (j + 0.5) * step) / k;
      for (let i = 0; i < w; i++) {
        const x = ((i + 0.5) * step - W / 2) / k,
          r2 = x * x + y * y;
        if (r2 >= 1) continue; // off the globe
        const z = Math.sqrt(1 - r2);
        const lat = Math.asin(z * sin0 + y * cos0) / D2R,
          lon = wrap(S.cam.lon + Math.atan2(x, z * cos0 - y * sin0) / D2R);
        const q = (MAG && gridByte(MAG, lat, lon)) || (WMAGD && gridByte(WMAGD, lat, lon)) || 0;
        if (!q) continue;
        const o = (j * w + i) * 4;
        px[o] = MAG_LUT[q * 4];
        px[o + 1] = MAG_LUT[q * 4 + 1];
        px[o + 2] = MAG_LUT[q * 4 + 2];
        px[o + 3] = MAG_LUT[q * 4 + 3];
      }
    }
    g.putImageData(img, 0, 0);
    GLOBEMAG = { key, step, cv };
    if (step > 3) setTimeout(req, 140); // come back for the sharp version once things settle
  }
  ctx.save();
  ctx.globalAlpha = (0.85 * V2.overlayOpacity) / 100;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(
    GLOBEMAG.cv,
    0,
    0,
    GLOBEMAG.cv.width,
    GLOBEMAG.cv.height,
    0,
    0,
    GLOBEMAG.cv.width * GLOBEMAG.step,
    GLOBEMAG.cv.height * GLOBEMAG.step,
  );
  ctx.restore();
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

// Setters for variables that other modules change.
export function setHITS_UG(v) {
  return (HITS_UG = v);
}
