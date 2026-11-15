// Line sampling sized to the view
import { GEO } from '../core/geo.js';
import { PIR, R } from '../core/util.js';
import { VIEW } from './canvas.js';
import { S } from '../state/state.js';

// ================= line sampling sized to the view =================
export function lineCoords(sg, off = 0) {
  const f = sg.f || (sg.f = GEO.frame(sg.o[0], sg.o[1], sg.brg));
  const full = !isFinite(sg.len),
    lo = full ? -PIR : sg.back ? -sg.len : 0,
    hi = full ? PIR : sg.len;
  const rv = VIEW.rv * (S.view === 'map' ? 1.6 : 1.2);
  if (rv > 3000) {
    const span = hi - lo,
      step = Math.max(30, rv / 45);
    return [GEO.sampleRange(sg, lo, hi, Math.min(900, Math.max(8, Math.ceil(span / step))), off)];
  }
  const t = GEO.track(f, S.cam.lat, S.cam.lon),
    ax = Math.abs(t.xt - off);
  if (ax > rv) return [];
  const half = R * Math.acos(Math.min(1, Math.cos(rv / R) / Math.cos(ax / R))) * 1.1 + 0.05;
  let rs = [[t.at - half, t.at + half]];
  if (full) {
    const r = rs[0];
    rs = [];
    if (r[0] < -PIR) rs.push([r[0] + 2 * PIR, PIR], [-PIR, r[1]]);
    else if (r[1] > PIR) rs.push([r[0], PIR], [-PIR, r[1] - 2 * PIR]);
    else rs.push(r);
  } else rs = rs.map(r => [Math.max(lo, r[0]), Math.min(hi, r[1])]).filter(r => r[1] > r[0]);
  return rs.map(r =>
    GEO.sampleRange(
      sg,
      r[0],
      r[1],
      Math.max(8, Math.min(240, Math.ceil((r[1] - r[0]) / Math.max(0.002, rv / 120)))),
      off,
    ),
  );
}
