// Panels: explore, draw, analyze, menu, saved
import { screenParent, screenTitle } from './registry.js';
import { registerScreen, screenHtml } from './registry.js';
import { v2Menu, v2Saved } from './screens/menu.js';
import { v2Explore } from './screens/explore.js';
import { v2Draw } from './screens/draw-line.js';
import { v2Analysis } from './screens/analysis.js';
import { NAVIGATION } from './navigation.js';
import { registerAction } from './registry.js';
import { v2Analyze } from './screens/analyze.js';
import { $ } from '../core/util.js';
import { activeLine } from '../domain/lines.js';
import { findPoint } from '../domain/points.js';
import { v2Alert } from '../features/discovery.js';
import { UGNAME, depInfo, undergroundAt } from '../domain/underground.js';
import { flyTo } from '../map/camera.js';
import { H, W, cv, kForKm, proj } from '../map/canvas.js';
import { req } from '../map/draw.js';
import { fmtKm } from '../core/format.js';
import { setView } from '../map/interaction.js';
import { showDetail } from '../panels/detail.js';
import { revealPoint } from '../panels/lines-pane.js';
import { V2 } from '../state/preferences.js';
import { S } from '../state/state.js';
import { toast } from './intro.js';
import { setMode } from './modes.js';
import { changed, selectTab, setSheet } from './sheet.js';

// Full pages that open inside a tab (with a Back button), instead of a separate Tools tab
const HOSTS = {
  detail: ['explore', 'Full record'],
  lab: ['analysis', 'Comparisons'],
  data: ['menu', 'Resources'],
  layers: ['menu', 'Layers'],
  appearance: ['menu', 'Appearance'],
  tools: ['analysis', 'Map tools'],
};
import { screenHistory, captureScreen, restoreScreen } from './registry.js';
import { emit } from '../core/events.js';

export function v2Render() {
  emit('ui:screen', V2.tab);
  const tools = !!V2.host,
    home = !V2.tab && !tools;
  $('#app').classList.toggle('v2-tools', tools);
  $('#app').classList.toggle('atlas-menu', V2.tab === 'menu' && !tools);
  $('#app').classList.toggle('v2-home', home); // map only: the panel is closed
  $('#app').classList.toggle('v2-analyze', V2.tab === 'analyze');
  $('#v2tools').hidden = home;
  $('#v2-menu').setAttribute('aria-expanded', String(V2.tab === 'menu' && !tools));
  if (!home) {
    const par = v2Parent();
    $('#v2hostback').hidden = !par;
    $('#v2hostback').textContent = par ? '← ' + V2TITLE(par, true) : '✕ Close';
    $('#v2hostback').setAttribute('aria-label', par ? 'Back to ' + V2TITLE(par, true) : 'Close the panel');
    $('#v2hosttitle').textContent = tools ? HOSTS[V2.host][1] : V2TITLE(V2.tab);
  }
  $('#v2-draw').hidden = S.mode !== 'draw'; // only needed on the map while freehand drawing
  $('#v2cta').hidden = !home || S.mode === 'draw' || !!activeLine();
  v2Alert();
  const h = $('#v2hint');
  h.hidden = S.mode !== 'draw';
  if (!h.hidden)
    h.innerHTML = `<strong>${V2.drawPoints.length ? 'Point A set' : 'Freehand'}</strong> · ${V2.drawPoints.length ? 'tap point B' : 'tap point A, then B'}`;
  if (tools || home) return;
  const pnl = $('#v2panel'),
    sc = pnl.scrollTop,
    same = pnl.dataset.tab === V2.tab;
  pnl.innerHTML = screenHtml(V2.tab);
  pnl.dataset.tab = V2.tab;
  if (same) pnl.scrollTop = sc;
  if (V2.tab === 'explore' && S.sel?.type === 'site')
    setTimeout(() => {
      const e = $('#v2ug'),
        s = findPoint(S.sel?.id);
      if (!e || !s) return;
      const u = undergroundAt(s.lat, s.lon),
        parts = u.groups
          .filter(g => g.near && g.d <= 50)
          .map(g => `${UGNAME[g.g].toLowerCase()} ${fmtKm(g.d)}`);
      e.innerHTML = `<b>Underground nearby:</b> ${parts.length ? parts.join(' · ') : 'no deposit records within 50 km'}${u.fault ? ` · active fault ${fmtKm(u.fault.d)}` : ''}${u.mag != null ? ` · magnetic ${u.mag > 0 ? '+' : ''}${Math.round(u.mag)} nT` : ''}.`;
    }, 20);
}
export function v2Leave() {
  if (V2.host === 'tools' && ['measure', 'marker'].includes(S.mode)) setMode(null);
  V2.host = null;
}
// one header for every panel: where Back goes, and what each panel is called
const V2TITLE = (t, short) =>
  ({
    explore: S.sel
      ? short
        ? 'Site'
        : S.sel.type === 'dep'
          ? 'Mineral record'
          : S.sel.type === 'fault'
            ? 'Active fault'
            : 'Site'
      : 'Search',
    draw: S.work ? 'Your line' : 'Draw a line',
    analyze: 'Line details',
    saved: 'My lines',
    analysis: 'Analyze',
    menu: 'Menu',
  })[t] ||
  screenTitle(t) ||
  '';
function v2Parent() {
  if (V2.host) return V2.tab;
  if (V2.tab === 'analyze') return S.work ? 'draw' : null;
  if (V2.tab === 'saved') return 'menu';
  return screenParent(V2.tab) || null;
}
export function v2Back() {
  if (!V2.host && screenHistory(V2.tab) && history.state?.atlasPanel?.tab === V2.tab) {
    history.back();
    return;
  }
  if (V2.host) {
    v2CloseHost();
    return;
  }
  if (V2.tab === 'explore' && (S.sel || V2.hl)) {
    v2Done();
    return;
  }
  const p = v2Parent();
  if (p) {
    v2ChangeTab(p);
    return;
  }
  v2Home();
}
export function v2Home() {
  emit('ui:navigate', V2.tab, null);
  v2Leave();
  V2.tab = null;
  V2.layersOpen = false;
  if (S.mode === 'draw') {
    setMode(null);
    V2.drawPoints = [];
  }
  v2Render();
  $('#v2-menu').focus({ preventScroll: true });
  req();
}
export function v2ChangeTab(t, navigation = {}) {
  if (!t) {
    v2Home();
    return;
  }
  const previous = V2.tab;
  if (navigation.history !== false && previous !== t && (screenHistory(previous) || screenHistory(t))) {
    history.replaceState(
      { ...history.state, atlasPanel: { tab: previous || 'explore', state: captureScreen(previous) } },
      '',
    );
    history.pushState({ ...history.state, atlasPanel: { tab: t, state: captureScreen(t) } }, '');
  }
  emit('ui:navigate', previous, t);
  v2Leave();
  V2.tab = HOSTS[t] ? HOSTS[t][0] : t;
  V2.layersOpen = false;
  v2Render();
  $('#v2panel').scrollTop = 0;
  if ($('#sheet').classList.contains('peek')) setSheet('half');
  $('#v2hosttitle').focus({ preventScroll: true });
}
export function v2OpenHost(h) {
  if (h === 'detail' && !S.sel) return;
  if (S.mode === 'draw') {
    setMode(null);
    V2.drawPoints = [];
  }
  V2.host = h;
  V2.tab = V2.tab || HOSTS[h][0];
  V2.layersOpen = false;
  v2Render(); // Back returns to wherever it was opened from
  if (h === 'detail') showDetail();
  else selectTab(h);
  if ($('#sheet').classList.contains('peek')) setSheet('half');
  $('#v2hosttitle').focus({ preventScroll: true });
}
export function v2CloseHost() {
  v2Leave();
  v2Render();
  $('#v2panel').scrollTop = 0;
}
function v2Remember() {
  if (!V2.prevCam)
    V2.prevCam = {
      ...S.cam,
      view: S.view,
      sheet: $('#sheet').classList.contains('peek')
        ? 'peek'
        : $('#sheet').classList.contains('full')
          ? 'full'
          : 'half',
    };
  v2PushHistory();
}
export function v2PushHistory() {
  if (V2.hist) return;
  try {
    history.pushState({ leyatlas: 1 }, '', '#detail');
    V2.hist = true;
  } catch (e) {}
}
// Done: close whatever is selected and go back to the view you had before
export function v2Done(fromBack) {
  const prev = V2.prevCam;
  S.sel = null;
  V2.hl = null;
  V2.prevCam = null;
  if (V2.host === 'detail') V2.host = null;
  if (V2.tab === 'explore') V2.tab = null;
  if (V2.hist && !fromBack) {
    V2.hist = false;
    try {
      history.back();
    } catch (e) {}
  } else V2.hist = false;
  if (prev) {
    if (prev.view !== S.view) setView(prev.view);
    flyTo(prev.lon, prev.lat, prev.k, 700);
  }
  setSheet('peek');
  v2Render();
  req();
}
// after the panel opens the map is shorter: if the chosen point now sits under the top buttons or off the edge, slide it to the middle
export function v2KeepSelVisible() {
  const s = S.sel?.type === 'site' ? findPoint(S.sel.id) : S.sel?.type === 'dep' ? depInfo(S.sel.k) : null;
  if (!s) return;
  const p = proj()([s.lon, s.lat]);
  if (!p) return;
  const top = $('#v2bar').getBoundingClientRect().bottom - cv.getBoundingClientRect().top + 12;
  if (p[0] < 24 || p[0] > W - 70 || p[1] < top || p[1] > H - 30) flyTo(s.lon, s.lat, S.cam.k, 450);
}
export function v2SelectSite(id, keepTab) {
  const p = findPoint(id);
  if (!p) return;
  v2Remember();
  S.sel = { type: 'site', id };
  if (revealPoint(p)) changed();
  flyTo(p.lon, p.lat, Math.max(S.cam.k, kForKm(p.cat === 'fort' || p.cat === 'castle' ? 4 : 30)), 800);
  if (!keepTab) V2.tab = 'explore';
  setSheet('half');
  v2Render();
  req();
}
export function v2Highlight(lat, lon, label, off, kind) {
  v2Remember();
  V2.hl = { lat, lon, label, kind };
  flyTo(lon, lat, Math.max(S.cam.k, kForKm(kind === 'plate' ? 400 : 40)), 800);
  toast(`${label} · ${off === 0 ? 'on the line' : fmtKm(off) + ' from the line'}`, 3500);
  v2Render();
  req();
}

export function initPanels() {
  registerScreen('explore', v2Explore);
  registerScreen('draw', v2Draw);
  registerScreen('analyze', v2Analyze);
  registerScreen('saved', v2Saved);
  registerScreen('menu', v2Menu);
  registerScreen('analysis', v2Analysis, { title: 'Analyze', parent: 'menu' });
  for (const item of NAVIGATION) {
    registerAction(item.action, () => {
      if (HOSTS[item.id]) {
        v2ChangeTab('menu');
        v2OpenHost(item.id);
      } else v2ChangeTab(item.id);
    });
  }
  registerAction('menu-tools', () => v2OpenHost('tools'));
  $('#v2hostback').onclick = v2Back;
  $('#v2close').onclick = v2Home;
  $('#sheet').addEventListener('keydown', e => {
    if (e.key === 'Escape' && !e.target.closest('input, textarea, select')) v2Back();
  });
  addEventListener('popstate', event => {
    if (event.state?.atlasPanel) {
      const { tab, state } = event.state.atlasPanel;
      restoreScreen(tab, state);
      v2ChangeTab(tab, { history: false });
      return;
    }
    if (V2.hist) {
      V2.hist = false;
      if (S.sel || V2.hl) v2Done(true);
    }
  });
}
