// Panel and button event wiring
import { $ } from '../core/util.js';
import { analyse } from '../domain/analysis.js';
import { DISP_CATS } from '../domain/categories.js';
import { findPoint } from '../domain/points.js';
import { v2SetGlobal, v2SetPoint, v2StartDraw } from '../features/create-lines.js';
import { v2LineChanged } from '../features/discovery.js';
import { depInfo, ugMask } from '../domain/underground.js';
import { req } from '../map/draw.js';
import { fmtKm } from '../core/format.js';
import { setView } from '../map/interaction.js';
import { V2, v2Persist } from '../state/preferences.js';
import { S } from '../state/state.js';
import { toast } from './intro.js';
import { renderKey, setFocus } from './map-chrome.js';
import { v2ChangeTab, v2HandleAction, v2Highlight, v2Home, v2Render, v2SelectSite } from './panels.js';
import { changed } from './sheet.js';
import { setCATCOUNT, v2OpenBrowser } from './site-lists.js';

export function initEvents() {
  // ---------- events ----------
  $('#v2panel').addEventListener('click', e => {
    const t = e.target;
    const sa = t.closest('[data-seta]');
    if (sa) {
      v2SetPoint('a', sa.dataset.seta);
      return;
    }
    const sb = t.closest('[data-setb]');
    if (sb) {
      v2SetPoint('b', sb.dataset.setb);
      return;
    }
    const gs = t.closest('[data-go-site]');
    if (gs) {
      v2SelectSite(gs.dataset.goSite);
      return;
    }
    const hs = t.closest('[data-hl-site]');
    if (hs) {
      const p = findPoint(hs.dataset.hlSite);
      v2SelectSite(hs.dataset.hlSite, true);
      toast(`${p.n} · ${fmtKm(+hs.dataset.off)} from the line`, 3500);
      return;
    }
    const hd = t.closest('[data-hl-dep]');
    if (hd) {
      const k = +hd.dataset.hlDep,
        i = depInfo(k),
        g = i.prim === 'magnetite' ? 'iron' : i.prim;
      if (!S.under[g]) {
        S.under[g] = true;
        v2Persist();
        renderKey();
      }
      S.sel = { type: 'dep', k };
      v2Highlight(i.lat, i.lon, i.n, +hd.dataset.off, 'dep');
      return;
    }
    const ha = t.closest('[data-hl-at]');
    if (ha) {
      const [la, lo] = ha.dataset.hlAt.split(',').map(Number),
        kind = ha.dataset.hlKind;
      if (kind === 'fault' && !S.under.faults) S.under.faults = true;
      if (kind === 'plate' && !S.under.plates) S.under.plates = true;
      if (kind === 'mag') {
        S.under.mag = true;
        setView('map');
      }
      v2Persist();
      renderKey();
      v2Highlight(la, lo, ha.dataset.hlLabel, +ha.dataset.off, kind);
      return;
    }
    const c = t.closest('[data-cat-d]');
    if (c) {
      V2.cat = c.dataset.catD;
      V2.limit = 60;
      for (const k of DISP_CATS[V2.cat] || []) S.layers.cat[k] = true;
      v2Persist();
      changed();
      v2Render();
      return;
    }
    const so = t.closest('[data-sort]');
    if (so) {
      V2.sort = so.dataset.sort;
      v2Render();
      return;
    }
    if (t.closest('[data-view]')) {
      V2.inView = !V2.inView;
      v2Render();
      return;
    }
    const w = t.closest('[data-width]');
    if (w) {
      S.corridorKm = +w.dataset.width;
      analyse();
      v2Persist();
      v2LineChanged();
      v2Render();
      return;
    }
    const lc = t.closest('[data-linecol]');
    if (lc) {
      V2.lineColor = lc.dataset.linecol || null;
      v2Persist();
      v2Render();
      req();
      return;
    }
    const b = t.closest('[data-v2]');
    if (b) v2HandleAction(b.dataset.v2, b.dataset.id);
  });
  $('#v2panel').addEventListener('input', e => {
    if (e.target.id === 'v2brg') V2.bear.brg = e.target.value;
    if (e.target.id === 'v2search') {
      V2.query = e.target.value;
      V2.limit = 60;
      const pos = e.target.selectionStart;
      clearTimeout(V2.st);
      V2.st = setTimeout(() => {
        v2Render();
        const i = $('#v2search');
        if (i) {
          i.focus();
          i.setSelectionRange(pos, pos);
        }
      }, 140);
    }
    if (e.target.id === 'v2name' && S.work) S.work.name = e.target.value;
  });
  $('#v2panel').addEventListener('change', e => {
    if (e.target.id === 'v2global' && S.work) v2SetGlobal(e.target.checked);
    if (e.target.matches('[data-corronly]')) {
      S.corridorOnly = e.target.checked;
      changed();
    }
    if (e.target.id === 'v2brg') V2.bear.brg = e.target.value;
    if (e.target.id === 'v2blen') V2.bear.len = e.target.value;
    const pf = e.target.dataset?.pref;
    if (pf) {
      if (pf === 'glow') V2.glow = e.target.checked;
      if (pf === 'alert') {
        V2.alertOff = !e.target.checked;
        if (V2.alertOff) $('#v2alert').hidden = true;
      }
      v2Persist();
      req();
    }
  });
  $('#v2layers').addEventListener('click', e => {
    const ud = e.target.closest('[data-ugs-dep]'),
      uf = e.target.closest('[data-ugs-fault]');
    if (ud || uf) {
      if (ud) {
        V2.ugDep = ud.dataset.ugsDep;
        if (V2.ugDep === 'heat' && !ugMask()) for (const g of ['iron', 'copper', 'silver']) S.under[g] = true;
      }
      if (uf) {
        V2.ugFault = uf.dataset.ugsFault;
        S.under.faults = true;
      }
      v2Persist();
      v2Render();
      renderKey();
      req();
      return;
    }
    const z = e.target.closest('[data-zm]');
    if (z) {
      V2.zoomMode = z.dataset.zm;
      v2Persist();
      v2Render();
      req();
      return;
    }
    const b = e.target.closest('[data-v2]');
    if (b) v2HandleAction(b.dataset.v2, b.dataset.id);
  });
  $('#v2layers').addEventListener('change', e => {
    const t = e.target.dataset.tgl;
    if (!t) return;
    if (t.startsWith('cat:')) {
      S.layers.cat[t.slice(4)] = e.target.checked;
      setCATCOUNT(null);
      changed();
    } else if (t.startsWith('src:')) {
      S.src[t.slice(4)] = e.target.checked;
      setCATCOUNT(null);
      changed();
    } else if (t.startsWith('under:')) {
      const k = t.slice(6);
      S.under[k] = e.target.checked;
      if (k === 'mag' && e.target.checked) {
        setView('map');
        toast('Magnetic field: red = stronger than average, blue = weaker', 3500);
      }
    } else if (t === 'sat') {
      S.layers.sat = e.target.checked;
      if (S.layers.sat) setView('map');
    } else if (t === 'labels') S.layers.labels = e.target.checked;
    else if (t === 'all') setFocus(!e.target.checked);
    v2Persist();
    v2Render();
    renderKey();
    req();
  });
  $('#v2layers').addEventListener('input', e => {
    if (e.target.matches('[data-v2opacity]')) {
      V2.overlayOpacity = +e.target.value;
      $('#v2opacitylabel').textContent = V2.overlayOpacity + '%';
      v2Persist();
      req();
    }
  });
  $('#v2-draw').onclick = () => {
    if (S.mode === 'draw') v2StartDraw();
  };
  $('#v2cta').onclick = () => {
    V2.picking = true;
    V2.pick = { a: null, b: null };
    v2ChangeTab('draw');
    v2OpenBrowser('a', true);
  };
  $('#v2-menu').onclick = () => {
    if (V2.tab === 'menu') v2Home();
    else v2ChangeTab('menu');
  };
  $('#v2-search').onclick = () => {
    if (S.sel) {
      S.sel = null;
      V2.hl = null;
    }
    v2ChangeTab('explore');
    setTimeout(() => $('#v2search')?.focus(), 80);
  };
  $('#lyr').onclick = () => v2HandleAction('layers');
}
