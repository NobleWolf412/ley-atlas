// Map overlay: drawing preview, A/B handles, highlights
import { addDrawLayer } from '../map/hooks.js';
import { GEO } from '../core/geo.js';
import { findPoint } from '../domain/points.js';
import { v2Ends } from './create-lines.js';
import { glowColor } from './discovery.js';
import { ctx } from '../map/canvas.js';
import { visible } from '../map/draw.js';
import { lineCoords } from '../map/line-sampling.js';
import { C } from '../render/palette.js';
import { V2 } from '../state/preferences.js';
import { S } from '../state/state.js';

// ---------- map overlay: drawing preview, A/B handles, highlighted finding ----------
function v2DrawOverlay(P, path) {
  let ends = null,
    preview = false;
  if (V2.drag) {
    ends = V2.drag.ends;
    preview = true;
  } else if (S.mode === 'draw' && V2.drawPoints.length) {
    ends = [V2.drawPoints[0], V2.hover].filter(Boolean);
    preview = true;
  } else if (S.active === 'work' && S.work?.v2ends) ends = v2Ends(S.work);
  if ((V2.pick.a && !V2.pick.b && !S.work?.v2ends) || (V2.pick.a && !V2.pick.b && V2.picking)) {
    const a = findPoint(V2.pick.a),
      q = a && visible(P, a.lon, a.lat);
    if (q) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(q[0], q[1], 11, 0, 7);
      ctx.fillStyle = '#f5fbfa';
      ctx.fill();
      ctx.strokeStyle = '#087a7a';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = '#087a7a';
      ctx.font = '800 11px "Instrument Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('A', q[0], q[1] + 0.5);
      ctx.restore();
    }
  }
  if (!ends && V2.pick.a && !V2.pick.b && S.sel?.type === 'site' && S.sel.id !== V2.pick.a) {
    const a = findPoint(V2.pick.a),
      b = findPoint(S.sel.id);
    if (a && b) {
      ends = [
        [a.lat, a.lon],
        [b.lat, b.lon],
      ];
      preview = true;
    }
  }
  ctx.save();
  if (ends && ends.length) {
    if (preview && ends.length === 2) {
      const a = ends[0],
        b = ends[1],
        dd = GEO.dist(...a, ...b);
      if (dd > 0.025) {
        ctx.beginPath();
        path({
          type: 'MultiLineString',
          coordinates: lineCoords({ o: a, brg: GEO.bearing(...a, ...b), len: dd }),
        });
        ctx.strokeStyle = C.cyan;
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    const drag = !S.work?.sites;
    for (let i = 0; i < ends.length; i++) {
      const p = visible(P, ends[i][1], ends[i][0]);
      if (!p) continue;
      ctx.beginPath();
      ctx.arc(p[0], p[1], drag ? 13 : 11, 0, 7);
      ctx.fillStyle = 'rgba(6,39,44,.22)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p[0], p[1], drag ? 9 : 8, 0, 7);
      ctx.fillStyle = '#f5fbfa';
      ctx.fill();
      ctx.strokeStyle = '#087a7a';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = '#07575d';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(i === 0 ? 'A' : 'B', p[0], p[1] + 0.4);
    }
  }
  if (V2.hl) {
    const p = visible(P, V2.hl.lon, V2.hl.lat);
    if (p) {
      const col =
        V2.hl.kind === 'fault' || V2.hl.kind === 'plate'
          ? glowColor('fault')
          : V2.hl.kind === 'dep'
            ? glowColor('min')
            : C.red;
      ctx.beginPath();
      ctx.arc(p[0], p[1], 16, 0, 7);
      ctx.strokeStyle = col;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(p[0], p[1], 24, 0, 7);
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
}

export function initLineOverlay() {
  addDrawLayer('top', v2DrawOverlay);
}
