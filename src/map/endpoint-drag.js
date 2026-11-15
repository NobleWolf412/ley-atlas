// Endpoint dragging for freehand lines
import { $, wrap } from '../core/util.js';
import { v2ApplyEnds, v2Ends, v2SyncPick } from '../features/create-lines.js';
import { v2Discover } from '../features/discovery.js';
import { clampCam, cv, kForKm, proj } from './canvas.js';
import { req, visible } from './draw.js';
import { V2, v2IsAdvanced } from '../state/preferences.js';
import { S } from '../state/state.js';
import { renderChrome } from '../ui/map-chrome.js';
import { v2Render } from '../ui/panels.js';

const v2DragEnd = e => {
  if (!V2.drag || V2.drag.id !== e.pointerId) return;
  const p = V2.drag;
  V2.drag = null;
  cv.style.cursor = '';
  e.preventDefault();
  e.stopImmediatePropagation();
  v2ApplyEnds(p.ends, S.work.name, S.work.len == null);
  V2.tab = 'draw';
  v2Render();
};
export function v2Init() {
  $('.brand h1').textContent = 'LEY ATLAS';
  S.explored = true;
  S.intro = null;
  $('#explore').hidden = true;
  $('#skip').hidden = true;
  S.cam = { lon: 14, lat: 44, k: kForKm(innerWidth < 700 ? 3200 : 2600) };
  clampCam();
  v2SyncPick();
  V2.tab = null;
  V2.sort = 'near';
  v2Discover();
  v2Render();
  renderChrome(); // map first: the panel opens only when something asks for it
}

export function initEndpointDrag() {
  // ---------- endpoint dragging for freehand lines ----------
  cv.addEventListener(
    'pointerdown',
    e => {
      if (v2IsAdvanced() || S.mode || !S.work?.v2ends || S.work.sites || S.active !== 'work') return;
      const pts = v2Ends(S.work),
        P = proj();
      let nearest = -1,
        best = 24;
      for (let i = 0; i < 2; i++) {
        const xy = visible(P, pts[i][1], pts[i][0]);
        if (!xy) continue;
        const d = Math.hypot(xy[0] - e.offsetX, xy[1] - e.offsetY);
        if (d < best) {
          best = d;
          nearest = i;
        }
      }
      if (nearest < 0) return;
      V2.drag = { id: e.pointerId, i: nearest, ends: pts };
      cv.setPointerCapture(e.pointerId);
      cv.style.cursor = 'grabbing';
      e.preventDefault();
      e.stopImmediatePropagation();
    },
    true,
  );
  cv.addEventListener(
    'pointermove',
    e => {
      if (V2.drag && V2.drag.id === e.pointerId) {
        const g = proj().invert([e.offsetX, e.offsetY]);
        if (g && Number.isFinite(g[0]))
          V2.drag.ends[V2.drag.i] = [Math.max(-89.8, Math.min(89.8, g[1])), wrap(g[0])];
        req();
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      if (S.mode === 'draw' && V2.drawPoints.length) {
        const g = proj().invert([e.offsetX, e.offsetY]);
        if (g && Number.isFinite(g[0])) V2.hover = [g[1], g[0]];
        req();
      }
    },
    true,
  );
  cv.addEventListener('pointerup', v2DragEnd, true);
  cv.addEventListener('pointercancel', v2DragEnd, true);
}
