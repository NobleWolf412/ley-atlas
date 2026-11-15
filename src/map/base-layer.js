// Base map: land, coast, lakes, rivers, borders and the coordinate grid
import { S } from '../state/state.js';
import { H, VIEW, W, ctx, inView, viewBounds } from './canvas.js';
import { C } from '../render/palette.js';
import { borders110, cellRings, chunkPts, graticule, lakeRings, land110 } from './basemap.js';
import { BASEMAP } from '../data/datasets.js';
import { ringPath } from './paths.js';
import { wrap } from '../core/util.js';

export function drawBase(P, path) {
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
export const GSTEPS = [
  10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01, 0.005, 0.002, 0.001, 0.0005, 0.0002, 0.0001,
];
export function gridSteps(B) {
  const [rl0, rl1, rlh] = B.r || [B.lat0, B.lat1, B.lh];
  const latPx = H / Math.max(1e-9, rl1 - rl0),
    lonPx = W / Math.max(1e-9, 2 * rlh);
  const pick = (pxPerDeg, minPx) => [...GSTEPS].reverse().find(s => s * pxPerDeg >= minPx) || 10;
  return { sla: pick(latPx, 44), slo: pick(lonPx, 78) };
}
export function drawGrid(P, B) {
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
export function drawGridLabels(P, B) {
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
