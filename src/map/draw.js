// Map drawing loop
import * as d3 from 'd3';
import { GEO } from '../core/geo.js';
import { $, D2R, wrap } from '../core/util.js';
import { DUFF } from '../data/catalog.js';
import { BASEMAP } from '../data/datasets.js';
import { INTS, MATCH, MATCHBY } from '../domain/analysis.js';
import { v2SiteVisible } from '../domain/categories.js';
import { LINES, PRIMARY_BRG, activeLine, lineShown, ob } from '../domain/lines.js';
import { ALLP, AUTO, FORTS, PT, shownP, srcOn } from '../domain/points.js';
import { v2Glow, v2PreDraw } from '../features/discovery.js';
import { LMHOT, lmFanDraw, lmPicking, lmTop, setLMHOT } from '../features/line-match.js';
import { HITS_UG, drawMag, drawUnder, setHITS_UG } from '../layers/underground.js';
import { borders110, cellRings, chunkPts, graticule, lakeRings, land110, outlineOf } from './basemap.js';
import {
  DPR,
  H,
  VIEW,
  W,
  ctx,
  inView,
  mainCtx,
  proj,
  ptInB,
  pxPerKm,
  setCtx,
  setH,
  setVIEW,
  setW,
  viewBounds,
} from './canvas.js';
import { lineCoords } from './line-sampling.js';
import { v2DrawOverlay } from './overlay.js';
import { drawTiles } from './tiles.js';
import {
  ZM,
  ZMHIDDEN,
  setZMHIDDEN,
  v2Bin,
  v2ClusterBegin,
  v2ClusterFlush,
  v2IsKey,
  v2Pinned,
} from './zoom-modes.js';
import { C, PAL, STY } from '../render/palette.js';
import { V2 } from '../state/preferences.js';
import { S } from '../state/state.js';
import { fmtKm, fmtLL, satUrl } from '../core/format.js';

// ================= drawing =================
export let raf = 0,
  HITS = [];
export function req() {
  if (!raf) raf = requestAnimationFrame(draw);
}
function strokeMulti(path, coords, st, wm = 1) {
  if (!coords.length) return;
  const g = { type: 'MultiLineString', coordinates: coords };
  ctx.setLineDash([]);
  if (C.under) {
    ctx.beginPath();
    path(g);
    ctx.strokeStyle = C.under;
    ctx.lineWidth = st.w * wm + 3;
    ctx.stroke();
  } else if (C.glowA) {
    ctx.beginPath();
    path(g);
    ctx.strokeStyle = st.c;
    ctx.globalAlpha = C.glowA;
    ctx.lineWidth = st.w * wm + 5;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.beginPath();
  path(g);
  ctx.strokeStyle = st.c;
  ctx.lineWidth = st.w * wm;
  ctx.setLineDash(st.dash);
  ctx.stroke();
  ctx.setLineDash([]);
}
function ringPath(P, pts, close) {
  let px = 1e9,
    py = 1e9,
    first = true;
  for (const p of pts) {
    const q = P(p);
    if (!q) continue;
    if (first) {
      ctx.moveTo(q[0], q[1]);
      first = false;
      px = q[0];
      py = q[1];
      continue;
    }
    if (Math.abs(q[0] - px) + Math.abs(q[1] - py) < 0.7) continue;
    ctx.lineTo(q[0], q[1]);
    px = q[0];
    py = q[1];
  }
  if (close && !first) ctx.closePath();
}
function drawBase(P, path) {
  const globe = S.view === 'globe',
    rv = VIEW.rv,
    B = viewBounds();
  const world = rv > (globe ? 1800 : 3500) || (globe && !B); // the globe redraws every frame, so it switches to the light coastline sooner
  if (globe) {
    ctx.beginPath();
    path({ type: 'Sphere' });
    ctx.fillStyle = C.sphere;
    ctx.fill();
  }
  if (world || rv > 250) {
    ctx.beginPath();
    path(graticule);
    ctx.strokeStyle = C.grat;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  if (world) {
    ctx.beginPath();
    path(land110);
    ctx.fillStyle = C.land;
    ctx.fill();
    ctx.strokeStyle = C.coast;
    ctx.lineWidth = 0.8;
    ctx.stroke();
    if (S.layers.borders) {
      ctx.beginPath();
      path(borders110);
      ctx.strokeStyle = C.border;
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }
  } else {
    const cells = (rv > 400 ? BASEMAP.land50 : BASEMAP.land10).filter(c => inView(c.b, B));
    ctx.beginPath();
    for (const c of cells) for (const r of cellRings(c)) ringPath(P, r, true);
    ctx.fillStyle = C.land;
    ctx.fill('evenodd');
    ctx.beginPath();
    for (const c of cells) {
      const [x0, y0, x1, y1] = c.b,
        e = 1e-6;
      const on = (a, b) =>
        (Math.abs(a[0] - b[0]) < e && (Math.abs(a[0] - x0) < e || Math.abs(a[0] - x1) < e)) ||
        (Math.abs(a[1] - b[1]) < e && (Math.abs(a[1] - y0) < e || Math.abs(a[1] - y1) < e));
      for (const r of cellRings(c)) {
        let pen = false;
        for (let i = 0; i < r.length; i++) {
          const a = r[i],
            b = r[(i + 1) % r.length];
          if (on(a, b)) {
            pen = false;
            continue;
          }
          const qa = P(a),
            qb = P(b);
          if (!qa || !qb) {
            pen = false;
            continue;
          }
          if (!pen) ctx.moveTo(qa[0], qa[1]);
          ctx.lineTo(qb[0], qb[1]);
          pen = true;
        }
      }
    }
    ctx.strokeStyle = C.coast;
    ctx.lineWidth = 0.9;
    ctx.stroke();
    if (rv <= 2500) {
      const ls = rv > 1000 ? 2 : rv > 300 ? 6 : 12;
      ctx.beginPath();
      for (const l of BASEMAP.lakes)
        if (l.s <= ls && inView(l.b, B)) for (const r of lakeRings(l)) ringPath(P, r, true);
      ctx.fillStyle = C.lake;
      ctx.fill('evenodd');
      ctx.strokeStyle = C.coast;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
    if (S.layers.rivers && rv <= 2000 && rv > 25) {
      const rs = rv > 1000 ? 3 : rv > 300 ? 7 : 12;
      ctx.beginPath();
      for (const ch of BASEMAP.rivers)
        if ((ch.s ?? 9) <= rs && inView(ch.b, B)) ringPath(P, chunkPts(ch), false);
      ctx.strokeStyle = C.river;
      ctx.lineWidth = rv < 60 ? 2 : 1.1;
      ctx.stroke();
    }
    if (S.layers.borders) {
      ctx.beginPath();
      for (const ch of rv > 400 ? BASEMAP.bord50 : BASEMAP.bord10)
        if (inView(ch.b, B)) ringPath(P, chunkPts(ch), false);
      ctx.strokeStyle = C.border;
      ctx.lineWidth = 0.9;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (rv <= 250) drawGrid(P, B);
  }
  if (globe) {
    ctx.beginPath();
    path({ type: 'Sphere' });
    ctx.strokeStyle = C.sphereEdge;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
const GSTEPS = [10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01, 0.005, 0.002, 0.001, 0.0005, 0.0002, 0.0001];
function gridSteps(B) {
  const [rl0, rl1, rlh] = B.r || [B.lat0, B.lat1, B.lh];
  const latPx = H / Math.max(1e-9, rl1 - rl0),
    lonPx = W / Math.max(1e-9, 2 * rlh);
  const pick = (pxPerDeg, minPx) => [...GSTEPS].reverse().find(s => s * pxPerDeg >= minPx) || 10;
  return { sla: pick(latPx, 44), slo: pick(lonPx, 78) };
}
function drawGrid(P, B) {
  const { sla, slo } = gridSteps(B),
    st = Math.min(sla, slo);
  ctx.strokeStyle = C.grid;
  ctx.lineWidth = 1;
  const lon0 = S.cam.lon - B.lh,
    lon1 = S.cam.lon + B.lh;
  ctx.beginPath();
  for (let la = Math.ceil(B.lat0 / st) * st; la <= B.lat1; la += st) {
    const a = P([lon0, la]),
      b = P([lon1, la]);
    if (a && b) {
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
    }
  }
  for (let lo = Math.ceil(lon0 / st) * st; lo <= lon1; lo += st) {
    const a = P([lo, B.lat0]),
      b = P([lo, B.lat1]);
    if (a && b) {
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
    }
  }
  ctx.stroke();
}
function drawGridLabels(P, B) {
  if (!B || H < 240) return;
  const { sla, slo } = gridSteps(B),
    lon0 = S.cam.lon - B.lh,
    lon1 = S.cam.lon + B.lh;
  const dla = Math.max(0, Math.ceil(-Math.log10(sla))),
    dlo = Math.max(0, Math.ceil(-Math.log10(slo)));
  ctx.font = '500 10px "JetBrains Mono", monospace';
  ctx.textBaseline = 'alphabetic';
  ctx.lineWidth = 3;
  ctx.strokeStyle = C.halo;
  ctx.fillStyle = C.gridText;
  const t = (s, x, y) => {
    ctx.strokeText(s, x, y);
    ctx.fillText(s, x, y);
  };
  for (let la = Math.ceil(B.lat0 / sla) * sla; la <= B.lat1; la += sla) {
    const q = P([S.cam.lon, la]);
    if (q && q[1] > 160 && q[1] < H - 120) t(la.toFixed(dla) + '°', 6, q[1] - 3);
  }
  for (let lo = Math.ceil(lon0 / slo) * slo; lo <= lon1; lo += slo) {
    const q = P([lo, S.cam.lat]);
    if (q && q[0] > 60 && q[0] < W - 70) t(wrap(lo).toFixed(dlo) + '°', q[0] + 3, 172);
  }
}
// basemap cache: in the 2D map a pan keeps the scale, so the cached base is slid instead of redrawn
export let BC = null,
  bcTimer = 0,
  lastM = 0;
const baseKey = () => [S.layers.borders, S.layers.rivers, W, H, DPR, C === PAL.dark].join('|');
function buildBaseCache() {
  if (S.view !== 'map') return;
  const M = Math.round(Math.max(W, H) * 0.3),
    bw = W + 2 * M,
    bh = H + 2 * M;
  const off =
    BC && BC.cv.width === Math.round(bw * DPR) && BC.cv.height === Math.round(bh * DPR)
      ? BC.cv
      : document.createElement('canvas');
  off.width = Math.round(bw * DPR);
  off.height = Math.round(bh * DPR);
  const sW = W,
    sH = H,
    sV = VIEW;
  setCtx(off.getContext('2d'));
  setW(bw);
  setH(bh);
  try {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = C.ocean;
    ctx.fillRect(0, 0, W, H);
    setVIEW({ ppk: pxPerKm() });
    VIEW.rv = Math.hypot(sW, sH) / 2 / VIEW.ppk;
    const P = proj();
    drawBase(P, d3.geoPath(P, ctx));
  } finally {
    setCtx(mainCtx);
    setW(sW);
    setH(sH);
    setVIEW(sV);
  }
  BC = {
    cv: off,
    lon: S.cam.lon,
    lat: S.cam.lat,
    m: S.cam.k * Math.cos(S.cam.lat * D2R),
    M,
    bw,
    bh,
    key: baseKey(),
  };
}
function blitBase(P) {
  const m = S.cam.k * Math.cos(S.cam.lat * D2R);
  if (!BC || S.view !== 'map' || BC.key !== baseKey() || Math.abs(BC.m - m) > m * 1e-9) return false;
  const c = P([BC.lon, BC.lat]);
  if (!c) return false;
  const dx = c[0] - W / 2,
    dy = c[1] - H / 2;
  if (Math.abs(dx) > BC.M * 0.92 || Math.abs(dy) > BC.M * 0.92) return false;
  ctx.drawImage(BC.cv, (BC.M - dx) * DPR, (BC.M - dy) * DPR, W * DPR, H * DPR, 0, 0, W, H);
  return true;
}
export function draw() {
  raf = 0;
  if (!W) return;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  setVIEW({ ppk: pxPerKm() });
  VIEW.rv = Math.hypot(W, H) / 2 / VIEW.ppk;
  const P = proj(),
    path = d3.geoPath(P, ctx),
    globe = S.view === 'globe',
    B = viewBounds(),
    rv = VIEW.rv;
  CAMV = globe ? GEO.vec(S.cam.lat, S.cam.lon) : null;
  ctx.fillStyle = C.ocean;
  ctx.fillRect(0, 0, W, H);
  const mNow = S.cam.k * Math.cos(S.cam.lat * D2R),
    zooming = Math.abs(mNow - lastM) > mNow * 1e-9;
  lastM = mNow;
  if (!blitBase(P)) {
    drawBase(P, path);
    if (S.view === 'map') {
      BC = null;
      clearTimeout(bcTimer);
      bcTimer = setTimeout(buildBaseCache, zooming ? 220 : 60);
    }
  }
  if (!globe && S.layers.sat && !S.satFailed) drawTiles();
  if (S.under.mag && !globe) drawMag(P);
  if (S.view === 'map' && rv <= 250) drawGridLabels(P, B);
  if (S.layers.outlines && S.layers.cat.fort && rv < 40) {
    ctx.beginPath();
    for (const f of FORTS) {
      const a = AUTO[f.id];
      if (!a || !a.ol || !srcOn(f) || !ptInB(f.lat, f.lon, B)) continue;
      const ring = outlineOf(a.ol);
      if (ring) ringPath(P, ring, true);
    }
    ctx.fillStyle = C.olFill;
    ctx.fill();
    ctx.strokeStyle = C.olEdge;
    ctx.lineWidth = rv < 4 ? 1.8 : 1.2;
    ctx.stroke();
  }
  setHITS_UG([]);
  ctx.save();
  ctx.globalAlpha = V2.overlayOpacity / 100;
  drawUnder(P, B, rv);
  ctx.restore();
  const act = activeLine();
  if (S.layers.corridor && act) {
    ctx.save();
    ctx.strokeStyle = C.corridor;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([2, 4]);
    for (const sg of act.segs)
      for (const s of [1, -1]) {
        const co = lineCoords(sg, s * S.corridorKm);
        if (co.length) {
          ctx.beginPath();
          path({ type: 'MultiLineString', coordinates: co });
          ctx.stroke();
        }
      }
    ctx.restore();
  }
  v2PreDraw();
  const intro = S.intro,
    batches = new Map();
  for (const l of LINES) {
    if (!lineShown(l) || (intro && l.id === 'primary')) continue;
    const wm = (l.width || 1) * (l.id === S.active ? 1.2 : 1),
      k = l.style + '|' + wm;
    let bt = batches.get(k);
    if (!bt) batches.set(k, (bt = { st: STY[l.style], wm, co: [] }));
    for (const sg of l.segs) for (const c of lineCoords(sg)) bt.co.push(c);
  }
  v2Glow(path);
  lmFanDraw(P);
  for (const bt of batches.values()) strokeMulti(path, bt.co, bt.st, bt.wm);
  if (intro && intro.lineKm > 0) {
    const len = intro.lineKm,
      sg = { o: [ob.lat, ob.lon], brg: PRIMARY_BRG, len: isFinite(len) ? len : Infinity, back: intro.back };
    strokeMulti(path, lineCoords(sg), STY.primary, 1.2);
  }
  if (S.layers.duff && !S.focus) {
    const m = PT.get(DUFF.site),
      q = visible(P, m.lon, m.lat);
    if (q) {
      ctx.save();
      ctx.strokeStyle = C.purple;
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(q[0], q[1], 18, 0, 7);
      ctx.stroke();
      ctx.restore();
    }
  }
  if (S.measure.length) {
    ctx.strokeStyle = C.text;
    ctx.lineWidth = 1.6;
    for (let i = 0; i < S.measure.length - 1; i++) {
      const a = S.measure[i],
        b = S.measure[i + 1],
        sg = { o: a, brg: GEO.bearing(...a, ...b), len: GEO.dist(...a, ...b) };
      ctx.beginPath();
      path({ type: 'MultiLineString', coordinates: lineCoords(sg) });
      ctx.stroke();
    }
    for (const m of S.measure) {
      const p = P([m[1], m[0]]);
      if (p) {
        ctx.beginPath();
        ctx.arc(p[0], p[1], 4, 0, 7);
        ctx.fillStyle = C.text;
        ctx.fill();
      }
    }
  }
  HITS = HITS_UG.slice();
  if (act && S.layers.corridor && rv < 3000)
    for (const m of MATCH) {
      if (m.status === 'out') continue;
      if (!m.onSpan || !ptInB(m.p.lat, m.p.lon, B)) continue;
      const p = visible(P, m.p.lon, m.p.lat);
      if (!p) continue;
      const f = m.seg.f,
        v = m.p.v,
        dn = GEO.dot(f.n, v),
        foot = GEO.ll(GEO.add(v, f.n, -dn)),
        q = P([foot[1], foot[0]]);
      if (!q) continue;
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (len < 4) continue;
      ctx.strokeStyle = C.tick;
      ctx.lineWidth = 1;
      ctx.setLineDash([1, 3]);
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(q[0], q[1]);
      ctx.stroke();
      ctx.setLineDash([]);
      if (len > 40) {
        ctx.font = '600 10px "JetBrains Mono", monospace';
        ctx.lineWidth = 3;
        ctx.strokeStyle = C.halo;
        const tx = (p[0] + q[0]) / 2 + 4,
          ty = (p[1] + q[1]) / 2;
        ctx.strokeText(fmtKm(m.d), tx, ty);
        ctx.fillStyle = C.text;
        ctx.fillText(fmtKm(m.d), tx, ty);
      }
    }
  if (S.layers.intersections)
    for (const x of INTS) {
      if (S.hideTrivial && x.trivial) continue;
      const p = visible(P, x.lon, x.lat);
      if (!p) continue;
      const r = 6 + Math.min(6, x.near.length * 1.5);
      ctx.beginPath();
      ctx.arc(p[0], p[1], r, 0, 7);
      ctx.strokeStyle = C.red;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(p[0], p[1], 2.2, 0, 7);
      ctx.fillStyle = C.red;
      ctx.fill();
      HITS.push({ x: p[0], y: p[1], r: r + 8, type: 'int', ref: x, pri: 2 });
    }
  const labels = [],
    icons = [],
    small = rv > 250,
    dots = new Map(),
    dr = rv < 60 ? 3 : 2.2;
  const addDot = (col, p) => {
    let a = dots.get(col);
    if (!a) dots.set(col, (a = []));
    a.push(p[0], p[1]);
  };
  const clustering = v2ClusterBegin(rv),
    keyOnly = ZM === 'key';
  setLMHOT(lmPicking() ? lmTop() : null);
  for (const s of ALLP) {
    if (!shownP(s) || !ptInB(s.lat, s.lon, B)) continue;
    if (!v2SiteVisible(s) && !(S.sel && S.sel.id === s.id)) continue;
    if (S.corridorOnly) {
      const m = MATCHBY.get(s.id);
      if (!m || m.status === 'out') continue;
    }
    const isSel = (S.sel && S.sel.id === s.id) || (LMHOT && LMHOT.has(s.id)); // best matches while choosing B are always drawn in full
    if (s.set === 'castle' && !isSel && s.rank > (rv > 1500 ? 500 : rv > 500 ? 2000 : 1e9)) continue;
    if (keyOnly && !v2IsKey(s) && !v2Pinned(s)) {
      setZMHIDDEN(ZMHIDDEN + 1);
      continue;
    }
    const p = visibleV(P, s.lon, s.lat, s.v);
    if (!p) continue;
    if (clustering && !v2Pinned(s)) {
      v2Bin(s, p);
      continue;
    }
    if (s.set === 'fort' && rv > 800 && !isSel) {
      addDot(C.dotFort, p);
      HITS.push({ x: p[0], y: p[1], r: 10, type: 'site', ref: s, pri: 1 });
      continue;
    }
    if (s.set === 'castle' && (rv > 400 || (rv > 90 && s.rank > 1500)) && !isSel) {
      addDot(C.dotCastle, p);
      HITS.push({ x: p[0], y: p[1], r: 10, type: 'site', ref: s, pri: 1 });
      if (rv < 200 && s.rank < 3000) labels.push({ t: s.n, x: p[0], y: p[1], pri: 1, place: true });
      continue;
    }
    if (s.set === 'roman' && rv > 120 && !isSel) {
      addDot(C.dotRoman, p);
      HITS.push({ x: p[0], y: p[1], r: 10, type: 'site', ref: s, pri: 0 });
      continue;
    }
    if ((s.set === 'pleiades' || s.set === 'unesco') && !isSel) {
      addDot(s.set === 'pleiades' ? C.dotPle : C.dotUn, p);
      HITS.push({ x: p[0], y: p[1], r: 10, type: 'site', ref: s, pri: 0 });
      if (rv < 40) labels.push({ t: s.n, x: p[0], y: p[1], pri: 1, place: true });
      continue;
    }
    icons.push([s, p]);
  }
  for (const [col, a] of dots) {
    ctx.fillStyle = col;
    ctx.beginPath();
    for (let i = 0; i < a.length; i += 2) {
      ctx.moveTo(a[i] + dr, a[i + 1]);
      ctx.arc(a[i], a[i + 1], dr, 0, 6.2832);
    }
    ctx.fill();
  }
  v2ClusterFlush(icons);
  const starBatch = [];
  const flushStars = () => {
    if (!starBatch.length) return;
    ctx.beginPath();
    for (let i = 0; i < starBatch.length; i += 3) {
      const x = starBatch[i],
        y = starBatch[i + 1],
        k = starBatch[i + 2];
      for (let j = 0; j < 10; j++) {
        const r = (j % 2 ? 3.4 : 8) * k,
          an = -Math.PI / 2 + (j * Math.PI) / 5;
        j
          ? ctx.lineTo(x + Math.cos(an) * r, y + Math.sin(an) * r)
          : ctx.moveTo(x + Math.cos(an) * r, y + Math.sin(an) * r);
      }
      ctx.closePath();
    }
    ctx.fillStyle = C.star;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = C.iconEdge;
    ctx.stroke();
    starBatch.length = 0;
  };
  icons.sort((u, v) => (v[0].set === 'fort') - (u[0].set === 'fort'));
  for (const [s, p] of icons) {
    if (s.set !== 'fort' && starBatch.length) flushStars();
    const m = MATCHBY.get(s.id),
      hl = intro && intro.hl && intro.hl.includes(s.id),
      sel = S.sel && S.sel.type === 'site' && S.sel.id === s.id;
    const ur = ((s.unc || 0) / 1000) * VIEW.ppk;
    if (ur > 8 && ur < 3000 && s.set !== 'fort') {
      ctx.beginPath();
      ctx.arc(p[0], p[1], ur, 0, 7);
      ctx.strokeStyle = C.unc;
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    const sc =
      sel || hl
        ? 1.35
        : s.set === 'fort' && small
          ? 0.62
          : s.set === 'import' && small && s.cat !== 'fort'
            ? 0.8
            : 1;
    if (s.cat === 'fort' && !sel && !hl) starBatch.push(p[0], p[1], sc);
    else drawIcon(s.set === 'roman' ? 'roman' : s.cat, p[0], p[1], sc);
    if (sel || hl) {
      ctx.beginPath();
      ctx.arc(p[0], p[1], 14, 0, 7);
      ctx.strokeStyle = C.red;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    if (S.layers.stonework && s.stone) {
      ctx.beginPath();
      ctx.moveTo(p[0], p[1] - 13);
      ctx.lineTo(p[0] + 13, p[1]);
      ctx.lineTo(p[0], p[1] + 13);
      ctx.lineTo(p[0] - 13, p[1]);
      ctx.closePath();
      ctx.strokeStyle = C.stoneRing;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    if (lmPicking() && lmTop().has(s.id) && !sel) {
      ctx.beginPath();
      ctx.arc(p[0], p[1], 15, 0, 7);
      ctx.strokeStyle = C.gold;
      ctx.lineWidth = 2.4;
      ctx.stroke();
    }
    if (S.follow && S.follow.hot.has(s.id)) {
      ctx.beginPath();
      ctx.arc(p[0], p[1], 16, 0, 7);
      ctx.strokeStyle = C.gold;
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }
    HITS.push({ x: p[0], y: p[1], r: 18, type: 'site', ref: s, pri: s.set === 'fort' ? 2 : 3 });
    const pri =
      sel || hl
        ? 6
        : m && m.status !== 'out'
          ? 5
          : s.set === 'core'
            ? 4
            : s.set === 'wonder' || s.set === 'megalith' || (S.layers.stonework && s.stone)
              ? 3
              : s.set === 'castle'
                ? s.rank < 400
                  ? 2
                  : 1
                : 2;
    if (!(s.set === 'fort' && rv > 600 && pri < 5)) labels.push({ t: s.n, x: p[0], y: p[1], pri });
  }
  flushStars();
  if (S.layers.places && rv <= 2500) {
    const sr = rv > 1200 ? 2 : rv > 400 ? 4 : rv > 60 ? 6 : 7;
    let n = 0;
    ctx.fillStyle = C.place;
    for (const pl of BASEMAP.places) {
      if (pl[3] > sr || !ptInB(pl[1], pl[2], B)) continue;
      const p = visible(P, pl[2], pl[1]);
      if (!p) continue;
      ctx.beginPath();
      ctx.arc(p[0], p[1], 1.9, 0, 7);
      ctx.fill();
      labels.push({ t: pl[0], x: p[0], y: p[1], pri: 0, place: true });
      if (++n > 70) break;
    }
  }
  if (S.layers.labels) placeLabels(labels);
  v2DrawOverlay(P, path);
  updateHud();
}
export let CAMV = null;
function visibleV(P, lon, lat, v) {
  if (CAMV && v[0] * CAMV[0] + v[1] * CAMV[1] + v[2] * CAMV[2] < 0.01) return null;
  const p = P([lon, lat]);
  return p && p[0] > -30 && p[0] < W + 30 && p[1] > -30 && p[1] < H + 30 ? p : null;
}
export function visible(P, lon, lat) {
  if (S.view === 'globe' && d3.geoDistance([lon, lat], [S.cam.lon, S.cam.lat]) > Math.PI / 2 - 0.01)
    return null;
  const p = P([lon, lat]);
  return p && p[0] > -30 && p[0] < W + 30 && p[1] > -30 && p[1] < H + 30 ? p : null;
}
function drawIcon(cat, x, y, sc = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sc, sc);
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = C.iconEdge;
  ctx.beginPath();
  if (cat === 'fort') {
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 3.4 : 8,
        a = -Math.PI / 2 + (i * Math.PI) / 5;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fillStyle = C.star;
  } else if (cat === 'obelisk') {
    ctx.moveTo(0, -9);
    ctx.lineTo(2.6, -5.5);
    ctx.lineTo(3, 6);
    ctx.lineTo(-3, 6);
    ctx.lineTo(-2.6, -5.5);
    ctx.closePath();
    ctx.fillStyle = C.obelisk;
  } else if (cat === 'temple') {
    ctx.moveTo(-7, -2);
    ctx.lineTo(0, -7);
    ctx.lineTo(7, -2);
    ctx.closePath();
    ctx.rect(-6, -1, 12, 6.5);
    ctx.fillStyle = C.temple;
  } else if (cat === 'church') {
    ctx.rect(-1.8, -8, 3.6, 15);
    ctx.rect(-6, -4, 12, 3.6);
    ctx.fillStyle = C.church;
  } else if (cat === 'ruin') {
    ctx.rect(-5.5, -5.5, 11, 11);
    ctx.fillStyle = C.ruin;
  } else if (cat === 'mountain') {
    ctx.moveTo(-8, 6);
    ctx.lineTo(0, -7);
    ctx.lineTo(8, 6);
    ctx.closePath();
    ctx.fillStyle = C.mountain;
  } else if (cat === 'landmark') {
    ctx.arc(0, 0, 5.5, 0, 7);
    ctx.fillStyle = C.landmark;
  } else if (cat === 'heritage') {
    ctx.arc(0, 0, 4.5, 0, 7);
    ctx.fillStyle = C.dotUn;
  } else if (cat === 'castle') {
    const P2 = [
      -6, 7, -6, -8, -3.6, -8, -3.6, -5.2, -1.2, -5.2, -1.2, -8, 1.2, -8, 1.2, -5.2, 3.6, -5.2, 3.6, -8, 6,
      -8, 6, 7,
    ];
    ctx.moveTo(P2[0], P2[1]);
    for (let i = 2; i < P2.length; i += 2) ctx.lineTo(P2[i], P2[i + 1]);
    ctx.closePath();
    ctx.fillStyle = C.castle;
  } else if (cat === 'roman') {
    ctx.moveTo(-7.5, -4);
    ctx.lineTo(0, -8);
    ctx.lineTo(7.5, -4);
    ctx.closePath();
    ctx.rect(-6, -3, 2.4, 8);
    ctx.rect(-1.2, -3, 2.4, 8);
    ctx.rect(3.6, -3, 2.4, 8);
    ctx.rect(-7.5, 5, 15, 2);
    ctx.fillStyle = C.roman;
  } else if (cat === 'megalith') {
    ctx.rect(-6.5, -3, 3.6, 10);
    ctx.rect(2.9, -3, 3.6, 10);
    ctx.rect(-8, -7.5, 16, 3.6);
    ctx.fillStyle = C.megalith;
  } else {
    ctx.arc(0, 0, 5.5, 0, 7);
    ctx.fillStyle = C.marker;
  }
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
function placeLabels(L) {
  L.sort((a, b) => b.pri - a.pri);
  const boxes = [];
  ctx.textBaseline = 'middle';
  let n = 0;
  for (const l of L) {
    if (n > 140) break;
    ctx.font = l.place
      ? '500 11px "Instrument Sans", system-ui, sans-serif'
      : '600 12px "Instrument Sans", system-ui, sans-serif';
    const w = ctx.measureText(l.t).width + 6,
      b = { x: l.x + (l.place ? 5 : 11), y: l.y - 8, w, h: 16 };
    if (b.x + w > W - 4) b.x = l.x - (l.place ? 5 : 11) - w;
    if (boxes.some(o => b.x < o.x + o.w && b.x + b.w > o.x && b.y < o.y + o.h && b.y + b.h > o.y)) continue;
    boxes.push(b);
    n++;
    ctx.lineWidth = 3.5;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = C.halo;
    ctx.strokeText(l.t, b.x + 3, l.y);
    ctx.fillStyle = l.place ? C.place : l.pri >= 5 ? C.strong : C.text;
    ctx.fillText(l.t, b.x + 3, l.y);
  }
}
function updateHud() {
  const ppk = VIEW.ppk,
    km = 100 / ppk,
    p10 = 10 ** Math.floor(Math.log10(km)),
    nice =
      [1, 2, 5, 10]
        .map(m => m * p10)
        .filter(v => v <= km)
        .pop() || p10;
  $('#scalebar').style.width = Math.round(nice * ppk) + 'px';
  $('#scaletxt').textContent = fmtKm(nice);
  $('#readout').textContent = fmtLL(S.cam.lat, S.cam.lon, 4);
  const z = Math.max(2, Math.min(20, Math.round(Math.log2((ppk * 40075) / 256)) + 1));
  $('#satlink').href = satUrl(S.cam.lat, S.cam.lon, z);
  const satOn = S.layers.sat && !S.satFailed && S.view === 'map';
  $('#attrib').textContent =
    (satOn ? 'Imagery © Esri, Maxar, Earthstar Geographics · ' : '') +
    'Natural Earth' +
    (VIEW.rv < 40 && S.layers.outlines ? ' · Fort outlines © OpenStreetMap contributors (ODbL)' : '');
  const ex = $('#explore');
  if (!S.explored && !S.intro && !S.mode) ex.hidden = VIEW.rv < 30;
  const street = VIEW.rv < 4 && !satOn && !S.intro && !S.mode;
  $('#street').hidden = !street;
  if (street) $('#street').href = satUrl(S.cam.lat, S.cam.lon, z);
}

// Setters for variables that other modules change.
export function setBC(v) {
  return (BC = v);
}
