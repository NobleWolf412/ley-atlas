// Map drawing loop
import { drawMagGlobe } from '../layers/underground.js';
import { drawBase, drawGridLabels } from './base-layer.js';
import { ringPath, strokeMulti } from './paths.js';
import { drawIcon } from './site-icons.js';
import { placeLabels } from './labels.js';
import { updateHud } from './hud.js';
import { highlightedSites, runDrawLayers } from './hooks.js';
import * as d3 from 'd3';
import { GEO } from '../core/geo.js';
import { D2R } from '../core/util.js';
import { DUFF } from '../data/catalog.js';
import { BASEMAP } from '../data/datasets.js';
import { INTS, MATCH, MATCHBY } from '../domain/analysis.js';
import { v2SiteVisible } from '../domain/categories.js';
import { LINES, PRIMARY_BRG, activeLine, lineShown, ob } from '../domain/lines.js';
import { ALLP, AUTO, FORTS, PT, shownP, srcOn } from '../domain/points.js';
import { HITS_UG, drawMag, drawUnder, setHITS_UG } from '../layers/underground.js';
import { outlineOf } from './basemap.js';
import {
  DPR,
  H,
  VIEW,
  W,
  ctx,
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
import { fmtKm } from '../core/format.js';

// ================= drawing =================
export let raf = 0,
  HITS = [];
export function req() {
  if (!raf) raf = requestAnimationFrame(draw);
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
  if (S.under.mag) {
    if (globe) drawMagGlobe();
    else drawMag(P);
  }
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
  runDrawLayers('beforeLines', P, path);
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
  runDrawLayers('underLines', P, path);
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
  const hot = highlightedSites(); // e.g. the best line matches while point B is being chosen
  for (const s of ALLP) {
    if (!shownP(s) || !ptInB(s.lat, s.lon, B)) continue;
    if (!v2SiteVisible(s) && !(S.sel && S.sel.id === s.id)) continue;
    if (S.corridorOnly) {
      const m = MATCHBY.get(s.id);
      if (!m || m.status === 'out') continue;
    }
    const isSel = (S.sel && S.sel.id === s.id) || (hot && hot.has(s.id)); // highlighted sites are always drawn in full
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
    if (hot && hot.has(s.id) && !sel) {
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
  runDrawLayers('top', P, path);
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

// Setters for variables that other modules change.
export function setBC(v) {
  return (BC = v);
}
