// Bottom sheet and legacy tabs
import { $, $$ } from '../core/util.js';
import { analyse } from '../domain/analysis.js';
import { buildLines } from '../domain/lines.js';
import { renderLab } from '../features/random-test.js';
import { req } from '../map/draw.js';
import { renderData } from '../panels/data-pane.js';
import { showDetail } from '../panels/detail.js';
import { V2, v2Persist } from '../state/preferences.js';
import { S, persist } from '../state/state.js';
import { renderChrome } from './map-chrome.js';
import { v2Render } from './panels.js';

// ================= sheet & tabs =================
const SNAP = () => ({
  peek: 118,
  half: Math.round(innerHeight * 0.46),
  full: Math.round(innerHeight * 0.86),
});
export function setSheet(s) {
  const el = $('#sheet');
  el.style.height = '';
  $('#app').classList.toggle('sheetopen', s !== 'peek');
  el.classList.toggle('peek', s === 'peek');
  el.classList.toggle('full', s === 'full');
  $('#app').classList.toggle('sheetfull', s === 'full' && innerWidth < 900);
}
export function selectTab(t) {
  S.tab = t;
  $$('.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === t));
  $$('.pane').forEach(p => (p.hidden = p.id !== 'p-' + t));
  renderTab(t);
}
export function renderTab(t) {
  if (!v2HostOpen()) return;
  ({ lab: renderLab, data: renderData })[t]?.();
}
// the Layers panel is drawn by v2Render
function v2HostOpen() {
  try {
    return !!V2.host;
  } catch (e) {
    return false;
  }
}
export function changed() {
  buildLines();
  analyse();
  persist();
  const pane = $('#p-' + S.tab),
    scr = pane?.scrollTop;
  if (!$('#p-detail').hidden && S.sel) showDetail(true);
  else {
    renderTab(S.tab);
    if (pane) pane.scrollTop = scr || 0;
  }
  renderChrome();
  v2Persist();
  v2Render();
  req();
}
export function keepScroll(id, fn) {
  const p = $(id),
    sc = p.scrollTop;
  fn();
  p.scrollTop = sc;
}

export function initSheet() {
  (() => {
    const g = $('#grab'),
      el = $('#sheet');
    let st = null;
    g.addEventListener('pointerdown', e => {
      if (innerWidth >= 900) return;
      g.setPointerCapture(e.pointerId);
      st = { y: e.clientY, h: el.getBoundingClientRect().height, moved: false };
      el.style.transition = 'none';
    });
    g.addEventListener('pointermove', e => {
      if (!st) return;
      const dy = e.clientY - st.y;
      if (Math.abs(dy) > 5) st.moved = true;
      if (st.moved) el.style.height = Math.max(90, Math.min(innerHeight * 0.92, st.h - dy)) + 'px';
    });
    const end = () => {
      if (!st) return;
      el.style.transition = '';
      const h = el.getBoundingClientRect().height,
        sn = SNAP();
      if (!st.moved)
        setSheet(el.classList.contains('peek') ? 'half' : el.classList.contains('full') ? 'peek' : 'full');
      else setSheet(Object.entries(sn).sort((a, b) => Math.abs(a[1] - h) - Math.abs(b[1] - h))[0][0]);
      st = null;
    };
    g.addEventListener('pointerup', end);
    g.addEventListener('pointercancel', end);
  })();
  $$('.tabs button').forEach(
    b =>
      (b.onclick = () => {
        selectTab(b.dataset.tab);
        if ($('#sheet').classList.contains('peek')) setSheet('half');
      }),
  );
}
