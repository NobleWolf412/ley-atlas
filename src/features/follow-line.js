// Follow this line
import { on } from '../core/events.js';
import { GEO } from '../core/geo.js';
import { $, PIR } from '../core/util.js';
import { MATCH } from '../domain/analysis.js';
import { activeLine, lineDist } from '../domain/lines.js';
import { clampCam, kForKm } from '../map/canvas.js';
import { req } from '../map/draw.js';
import { fmtKm } from '../core/format.js';
import { setView } from '../map/interaction.js';
import { S } from '../state/state.js';
import { toast } from '../ui/intro.js';
import { setSheet } from '../ui/sheet.js';

// ================= follow this line =================
export function startFollow() {
  const L = activeLine();
  if (!L) return;
  const sg = L.segs[0],
    f = sg.f || (sg.f = GEO.frame(sg.o[0], sg.o[1], sg.brg));
  const full = !isFinite(sg.len),
    lo = full ? 0 : sg.back ? -sg.len : 0,
    hi = full ? 2 * PIR : sg.len;
  const span = hi - lo;
  if (full || span > 2500) {
    setView('globe');
    S.cam.k = Math.min(Math.max(S.cam.k, kForKm(3000)), kForKm(1200));
  } else {
    S.cam.k = kForKm(Math.max(40, Math.min(1200, span / 2.5)));
  }
  S.follow = {
    L,
    f,
    at: lo,
    lo,
    hi,
    speed: span / (full ? 40 : Math.min(20, 8 + span / 300)),
    last: performance.now(),
    hot: new Set(),
    log: [],
    cand: MATCH.filter(m => m.status !== 'out').map(m => m.p),
  };
  $('#ticker').hidden = false;
  setSheet('peek');
  stepFollow();
}
function stepFollow() {
  const F = S.follow;
  if (!F) return;
  const now = performance.now(),
    dt = Math.min(0.1, (now - F.last) / 1000);
  F.last = now;
  F.at += F.speed * dt;
  if (F.at > F.hi) {
    stopFollow();
    return;
  }
  const g = GEO.ll(GEO.pointAt(F.f, F.at));
  S.cam.lat = g[0];
  S.cam.lon = g[1];
  clampCam();
  F.hot = new Set();
  let msg = '';
  for (const p of F.cand) {
    const r = lineDist(F.L, p.lat, p.lon),
      dAlong = Math.abs(((((r.at - F.at) % (2 * PIR)) + 3 * PIR) % (2 * PIR)) - PIR);
    if (r.d <= S.corridorKm && dAlong < 400) {
      F.hot.add(p.id);
      msg = `${p.n} · ${fmtKm(r.d)} off-line`;
      if (!F.log.includes(p.n)) F.log.push(p.n);
    }
  }
  $('#tickertxt').textContent =
    msg || `${F.L.short || F.L.name} · ${fmtKm(F.at - F.lo)} travelled · ±${fmtKm(S.corridorKm)}`;
  req();
  requestAnimationFrame(stepFollow);
}
export function stopFollow() {
  if (!S.follow) return;
  const log = S.follow.log;
  S.follow = null;
  $('#ticker').hidden = true;
  req();
  if (log.length)
    toast(
      `Passed within ±${fmtKm(S.corridorKm)}: ${log.slice(0, 12).join(' · ')}${log.length > 12 ? ` +${log.length - 12} more` : ''}`,
      7000,
    );
}

export function initFollowLine() {
  on('map:gesture-start', () => {
    if (S.follow) stopFollow();
  });
  $('#tickerstop').onclick = stopFollow;
}
