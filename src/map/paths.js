// Canvas path helpers shared by the drawing modules
import { ctx } from './canvas.js';
import { C } from '../render/palette.js';

export function strokeMulti(path, coords, st, wm = 1) {
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
export function ringPath(P, pts, close) {
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
