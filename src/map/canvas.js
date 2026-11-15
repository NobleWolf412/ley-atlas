// Canvas, projection and camera limits
import * as d3 from 'd3';
import { $, D2R, R, R2D, wrap } from '../core/util.js';
import { req, setBC } from './draw.js';
import { S } from '../state/state.js';

// ================= canvas & projection =================
export let cv, mainCtx;
export let ctx;
export let W = 0,
  H = 0,
  DPR = 1,
  VIEW = { rv: 1, ppk: 1 };
export function resize() {
  setBC(null);
  const r = cv.getBoundingClientRect();
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = r.width;
  H = r.height;
  cv.width = Math.round(W * DPR);
  cv.height = Math.round(H * DPR);
  clampCam();
  req();
}
export function proj() {
  const c = S.cam;
  if (S.view === 'globe')
    return d3
      .geoOrthographic()
      .rotate([-c.lon, -c.lat])
      .scale(c.k)
      .translate([W / 2, H / 2])
      .clipAngle(90)
      .precision(0);
  return d3
    .geoMercator()
    .rotate([-c.lon, 0])
    .center([0, c.lat])
    .scale(c.k * Math.cos(c.lat * D2R))
    .translate([W / 2, H / 2])
    .clipExtent([
      [-40, -40],
      [W + 40, H + 40],
    ])
    .precision(0);
}
export const pxPerKm = () => S.cam.k / R;
export const kForKm = km => ((Math.min(W, H) || 400) / km) * R;
let GOODCAM;
export function clampCam() {
  if (!isFinite(S.cam.lon) || !isFinite(S.cam.lat) || !isFinite(S.cam.k)) S.cam = { ...GOODCAM };
  const c = S.cam;
  c.lon = wrap(c.lon);
  const g = S.view === 'globe';
  c.lat = Math.max(g ? -89.9 : -82, Math.min(g ? 89.9 : 82, c.lat));
  const minK = g ? Math.min(W, H) * 0.3 : (W || 400) / (2 * Math.PI) / Math.cos(c.lat * D2R);
  c.k = Math.max(minK, Math.min(R * 2e4, c.k));
  GOODCAM = { ...c };
}
export function viewBounds() {
  if (S.view === 'globe') {
    const a = ((VIEW.rv * 1.25) / R) * R2D;
    if (a > 75) return null;
    const lat0 = Math.max(-90, S.cam.lat - a),
      lat1 = Math.min(90, S.cam.lat + a),
      ml = Math.max(Math.abs(lat0), Math.abs(lat1));
    return { lat0, lat1, lh: ml >= 88 ? 180 : Math.min(180, a / Math.cos(ml * D2R)) };
  }
  const P = proj();
  let lat0 = 90,
    lat1 = -90,
    lh = 0;
  for (const [x, y] of [
    [0, 0],
    [W, 0],
    [0, H],
    [W, H],
    [W / 2, 0],
    [W / 2, H],
    [0, H / 2],
    [W, H / 2],
  ]) {
    const g = P.invert([x, y]);
    if (!g || !isFinite(g[1])) continue;
    lat0 = Math.min(lat0, g[1]);
    lat1 = Math.max(lat1, g[1]);
    lh = Math.max(lh, Math.abs(wrap(g[0] - S.cam.lon)));
  }
  const pad = Math.min(0.5, (lat1 - lat0) * 0.2);
  return { lat0: lat0 - pad, lat1: lat1 + pad, lh: Math.min(180, lh + pad), r: [lat0, lat1, lh] };
}
export function inView(b, B) {
  if (!B) return true;
  if (b[3] < B.lat0 || b[1] > B.lat1) return false;
  const hw = (b[2] - b[0]) / 2,
    d = Math.abs(wrap((b[0] + b[2]) / 2 - S.cam.lon));
  if (S.view === 'map' && d + hw > 179) return false;
  return d - hw <= B.lh;
}
export const ptInB = (lat, lon, B) =>
  !B || (lat >= B.lat0 && lat <= B.lat1 && Math.abs(wrap(lon - S.cam.lon)) <= B.lh);

export function initCanvas() {
  // ================= canvas & projection =================
  cv = $('#map');
  mainCtx = cv.getContext('2d');
  ctx = mainCtx;
  new ResizeObserver(resize).observe(cv);
  GOODCAM = { ...S.cam };
}

// Setters for variables that other modules change.
export function setCtx(v) {
  return (ctx = v);
}
export function setW(v) {
  return (W = v);
}
export function setH(v) {
  return (H = v);
}
export function setVIEW(v) {
  return (VIEW = v);
}
