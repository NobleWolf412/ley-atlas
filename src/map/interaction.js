// Pointer, wheel and button interaction
import { emit } from '../core/events.js';
import * as d3 from 'd3';
import { $, D2R, R2D, reduceMotion } from '../core/util.js';
import { anim, flyTo, setAnim } from './camera.js';
import { H, W, clampCam, cv, kForKm, proj } from './canvas.js';
import { req } from './draw.js';
import { S } from '../state/state.js';

// ================= interaction =================
const ptrs = new Map();
export let gest = null,
  tapStart = null,
  lastTap = null,
  vel = null,
  inertia = 0;
const up = e => {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.delete(e.pointerId);
  const now = performance.now();
  if (tapStart && now - tapStart.t < 400) {
    if (
      lastTap &&
      now - lastTap.t < 320 &&
      Math.hypot(lastTap.x - tapStart.x, lastTap.y - tapStart.y) < 30 &&
      !S.mode
    ) {
      zoomAnimated(tapStart.x, tapStart.y, 2.2);
      lastTap = null;
    } else {
      emit('map:tap', tapStart.x, tapStart.y);
      lastTap = { ...tapStart, t: now };
    }
  } else if (!ptrs.size && vel && now - vel.t < 60 && Math.hypot(vel.vx, vel.vy) > 0.25 && !reduceMotion)
    startInertia(vel.vx, vel.vy);
  tapStart = null;
  gest = ptrs.size ? snapshotGesture() : null;
};
function startInertia(vx, vy) {
  let last = performance.now();
  const step = now => {
    const dt = now - last;
    last = now;
    pan(vx * dt, vy * dt);
    const d = Math.pow(0.93, dt / 16);
    vx *= d;
    vy *= d;
    inertia = Math.hypot(vx, vy) > 0.02 ? requestAnimationFrame(step) : 0;
  };
  inertia = requestAnimationFrame(step);
}
function snapshotGesture() {
  const a = [...ptrs.values()];
  if (!a.length) return null;
  const cx = a.reduce((s, p) => s + p.x, 0) / a.length,
    cy = a.reduce((s, p) => s + p.y, 0) / a.length;
  return {
    cx,
    cy,
    d: a.length > 1 ? Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) : 0,
    n: a.length,
    cam: { ...S.cam },
  };
}
function applyGesture() {
  const g = gest;
  if (!g) return;
  const now = snapshotGesture();
  if (!now || now.n !== g.n) {
    gest = now;
    return;
  }
  S.cam = { ...g.cam };
  if (g.n > 1 && g.d > 0) zoomAt(g.cx, g.cy, now.d / g.d, true);
  pan(now.cx - g.cx, now.cy - g.cy, true);
}
function pan(dx, dy, noReq) {
  if (S.view === 'globe') {
    S.cam.lon -= (dx / (S.cam.k * Math.max(0.15, Math.cos(S.cam.lat * D2R)))) * R2D;
    S.cam.lat += (dy / S.cam.k) * R2D;
  } else {
    const P = proj(),
      m = S.cam.k * Math.cos(S.cam.lat * D2R),
      g = P.invert([W / 2 - dx, H / 2 - dy]);
    if (g && isFinite(g[0])) {
      S.cam.lon = g[0];
      S.cam.lat = Math.max(-82, Math.min(82, g[1]));
      S.cam.k = m / Math.cos(S.cam.lat * D2R);
    }
  }
  clampCam();
  if (!noReq) req();
}
function zoomAt(x, y, f, noReq) {
  const g = proj().invert([x, y]);
  S.cam.k *= f;
  clampCam();
  if (g && isFinite(g[0]) && (S.view === 'map' || d3.geoDistance(g, [S.cam.lon, S.cam.lat]) < 1.4)) {
    const p2 = proj()(g);
    if (p2) {
      const m = S.cam.k * Math.cos(S.cam.lat * D2R),
        c = proj().invert([W / 2 + p2[0] - x, H / 2 + p2[1] - y]);
      if (c && isFinite(c[0])) {
        S.cam.lon = c[0];
        S.cam.lat = c[1];
        if (S.view === 'map') {
          S.cam.lat = Math.max(-82, Math.min(82, c[1]));
          S.cam.k = m / Math.cos(S.cam.lat * D2R);
        }
        clampCam();
      }
    }
  }
  if (!noReq) req();
}
export function zoomAnimated(x, y, f) {
  if (reduceMotion) {
    zoomAt(x, y, f);
    return;
  }
  const t0 = performance.now(),
    ms = 260;
  let done = 1;
  cancelAnimationFrame(anim);
  const step = now => {
    const u = Math.min(1, (now - t0) / ms),
      e = 1 - (1 - u) ** 3,
      target = Math.pow(f, e);
    zoomAt(x, y, target / done);
    done = target;
    setAnim(u < 1 ? requestAnimationFrame(step) : null);
  };
  setAnim(requestAnimationFrame(step));
}
export function setView(v) {
  if (S.view === v) return;
  S.view = v;
  $('#v-map').setAttribute('aria-pressed', v === 'map');
  $('#v-globe').setAttribute('aria-pressed', v === 'globe');
  if (v === 'globe' && S.cam.k < Math.min(W, H) * 0.42) S.cam.k = Math.min(W, H) * 0.42;
  clampCam();
  req();
}

export function initInteraction() {
  cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
    cancelAnimationFrame(inertia);
    inertia = 0;
    if (anim) {
      cancelAnimationFrame(anim);
      setAnim(null);
    }
    emit('map:gesture-start');
    tapStart = ptrs.size === 1 ? { x: e.offsetX, y: e.offsetY, t: performance.now() } : null;
    gest = snapshotGesture();
    vel = { x: e.offsetX, y: e.offsetY, t: performance.now(), vx: 0, vy: 0 };
  });
  cv.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
    if (tapStart && Math.hypot(e.offsetX - tapStart.x, e.offsetY - tapStart.y) > 7) tapStart = null;
    if (ptrs.size === 1 && vel) {
      const now = performance.now(),
        dt = Math.max(1, now - vel.t);
      vel.vx = 0.6 * vel.vx + (0.4 * (e.offsetX - vel.x)) / dt;
      vel.vy = 0.6 * vel.vy + (0.4 * (e.offsetY - vel.y)) / dt;
      vel.x = e.offsetX;
      vel.y = e.offsetY;
      vel.t = now;
    }
    applyGesture();
    req();
  });
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener(
    'wheel',
    e => {
      e.preventDefault();
      emit('map:wheel');
      zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * 0.0018));
    },
    { passive: false },
  );
  $('#zin').onclick = () => zoomAnimated(W / 2, H / 2, 2);
  $('#zout').onclick = () => zoomAnimated(W / 2, H / 2, 0.5);
  $('#home').onclick = () => {
    setView('map');
    flyTo(14, 44, kForKm(innerWidth < 700 ? 3200 : 2600), 1200);
  };
  $('#v-map').onclick = () => setView('map');
  $('#v-globe').onclick = () => setView('globe');
}
