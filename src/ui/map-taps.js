// What a tap on the map does: pick a site, deposit or fault, place a point, or close what is open
import { H, W, proj } from '../map/canvas.js';
import { S } from '../state/state.js';
import { HITS, req } from '../map/draw.js';
import { toast } from './intro.js';
import { $, nf } from '../core/util.js';
import { zoomAnimated } from '../map/interaction.js';
import { CATWORD } from '../map/zoom-modes.js';
import { showDeposit, showFault } from '../panels/underground-detail.js';
import { closeDetail, showDetail } from '../panels/detail.js';
import { V2, v2IsAdvanced } from '../state/preferences.js';
import { v2Done, v2Home, v2KeepSelVisible, v2PushHistory, v2Render } from './panels.js';
import { changed, renderTab, setSheet } from './sheet.js';
import { v2MapPoint } from '../features/create-lines.js';
import { setBanner, setMode } from './modes.js';
import { rebuildPoints } from '../domain/points.js';
import { on } from '../core/events.js';

const mapTapHandlers = [];
export function registerMapTapHandler(handler) {
  mapTapHandlers.push(handler);
}

function onTap(x, y) {
  if (!S.mode && mapTapHandlers.some(handler => handler(x, y))) return;
  const g = proj().invert([x, y]);
  if (S.mode && g && isFinite(g[0])) {
    modePoint([g[1], g[0]]);
    return;
  }
  let best = null;
  for (const h of HITS) {
    const d = Math.hypot(h.x - x, h.y - y);
    if (d < h.r && (!best || h.pri > best.pri || (h.pri === best.pri && d < best.d))) best = { ...h, d };
  }
  if (best && best.type === 'ugheat') {
    toast(`${nf(best.ref.n)} ${best.ref.label} here · zooming in`, 2200);
    zoomAnimated(best.x, best.y, 2.6);
    return;
  }
  if (best && best.type === 'cluster') {
    const o = best.ref;
    toast(
      `${nf(best.n)} sites here: ${o
        .slice(0, 3)
        .map(([c, n]) => `${n} ${CATWORD[c] || c}`)
        .join(', ')}${o.length > 3 ? '…' : ''}`,
      2600,
    );
    zoomAnimated(best.x, best.y, 2.6);
    return;
  }
  if (best && best.type === 'dep') {
    S.sel = { type: 'dep', k: best.ref };
    showDeposit(best.ref);
  } else if (best && best.type === 'fault') {
    S.sel = { type: 'fault', ref: best.ref };
    showFault(best.ref);
  } else if (best) {
    S.sel = best.type === 'site' ? { type: 'site', id: best.ref.id } : { type: 'int', ref: best.ref };
    showDetail();
  } else if (S.sel || V2.hl) {
    if (!v2IsAdvanced()) {
      v2Done();
      return;
    }
    S.sel = null;
    closeDetail();
  } else if (V2.tab || V2.host || V2.layersOpen) {
    v2Home();
    return;
  }
  if (!v2IsAdvanced()) {
    if (S.sel) {
      v2PushHistory();
      V2.tab = 'explore';
      V2.hl = null;
      setSheet('half');
      setTimeout(v2KeepSelVisible, 330);
    }
    v2Render();
  }
  req();
}
function modePoint(ll) {
  if (S.mode === 'draw') {
    v2MapPoint(ll);
    return;
  }
  if (S.mode === 'measure') {
    if (S.measure.length >= 3) S.measure = [];
    S.measure.push(ll);
    renderTab(S.tab);
    setBanner();
    req();
    return;
  }
  if (S.mode === 'marker') {
    const name = ($('#mk-name') && $('#mk-name').value.trim()) || `Marker ${S.markers.length + 1}`;
    S.markers.push({ id: 'm' + Date.now(), n: name, lat: ll[0], lon: ll[1], reg: 'Your marker', unc: 0 });
    setMode(null);
    rebuildPoints();
    changed();
    toast('Marker added');
  }
}

export function initMapTaps() {
  on('map:tap', onTap);
  // "Add a point here" button: the point under the centre of the map
  $('#addhere').onclick = () => {
    const g = proj().invert([W / 2, H / 2]);
    if (g) modePoint([g[1], g[0]]);
  };
}
