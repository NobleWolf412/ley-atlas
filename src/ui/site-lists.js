// Site lists (Explore and the A/B picker)
import { GEO } from '../core/geo.js';
import { $, esc, nf } from '../core/util.js';
import { DISP, dispMatch } from '../domain/categories.js';
import { dispIcon, siteIcon } from '../render/icons.js';
import { ALLP, findPoint, shownP, srcOn } from '../domain/points.js';
import { TYPENAME } from '../domain/site-types.js';
import { v2SetPoint } from '../features/create-lines.js';
import {
  LM,
  MSIG,
  lmBar,
  lmCombined,
  lmForAsync,
  lmMarkPicked,
  lmReady,
  lmWhy,
} from '../features/line-match.js';
import { flyTo } from '../map/camera.js';
import { kForKm, ptInB, viewBounds } from '../map/canvas.js';
import { req } from '../map/draw.js';
import { fmtKm } from '../core/format.js';
import { V2 } from '../state/preferences.js';
import { S } from '../state/state.js';
import { toast } from './intro.js';
import { setMode } from './modes.js';
import { v2Back, v2CloseHost, v2Done, v2Render } from './panels.js';
import { setSheet } from './sheet.js';

// ---------- site lists (Explore and the A/B picker share one renderer) ----------
export function v2Filtered(o) {
  const q = (o.query || '').trim().toLowerCase(),
    words = q.split(/\s+/).filter(Boolean),
    B = o.inView ? viewBounds() : null;
  let arr = ALLP.filter(p => p.set !== 'marker' || o.markers !== false).filter(
    p =>
      (o.cat === 'all' ? shownP(p) : srcOn(p) && dispMatch(o.cat, p)) &&
      (!words.length ||
        words.every(w =>
          (p.n + ' ' + (p.reg || '') + ' ' + (TYPENAME[p.cat] || '')).toLowerCase().includes(w),
        )) &&
      (!o.inView || ptInB(p.lat, p.lon, B)),
  );
  if (o.sort === 'match' && o.lm) {
    arr = arr.filter(p => o.lm.scores.has(p.id));
    for (const p of arr) p._m = lmCombined(o.lm.scores.get(p.id));
    arr.sort((a, b) => b._m - a._m || o.lm.scores.get(a.id).L - o.lm.scores.get(b.id).L);
  } else if (o.sort === 'near' || o.sort === 'match') {
    const c0 = o.from || S.cam;
    for (const p of arr) p._d = GEO.dist(c0.lat, c0.lon, p.lat, p.lon);
    arr.sort((a, b) => a._d - b._d);
  } else
    arr.sort((a, b) =>
      a.n.localeCompare(b.n, 'en', { sensitivity: 'base', ignorePunctuation: true, numeric: true }),
    );
  return arr;
}
function v2CatCounts(o) {
  const out = {};
  for (const [k] of DISP) out[k] = 0;
  for (const p of ALLP) {
    if (p.set === 'marker' || !srcOn(p)) continue;
    if (shownP(p)) out.all++;
    for (const [k, , f] of DISP) if (k !== 'all' && f(p)) out[k]++;
  }
  return out;
}
export let CATCOUNT = null,
  CATKEY = '';
export function v2Chips(sel, attr) {
  const key =
    ALLP.length + JSON.stringify(S.src) + JSON.stringify(S.layers.cat) + S.imports.map(i => i.on).join();
  if (!CATCOUNT || CATKEY !== key) {
    CATCOUNT = v2CatCounts();
    CATKEY = key;
  }
  return `<div class="v2-chips" role="group" aria-label="Site categories">${DISP.map(([k, t]) => `<button class="v2-chip" ${attr}="${k}" aria-pressed="${sel === k}">${dispIcon(k)}${esc(t)} <small>${nf(CATCOUNT[k])}</small></button>`).join('')}</div>`;
}
export function v2SiteRows(arr, o) {
  const pk = V2.pick;
  return arr
    .map(p => {
      const d = GEO.dist(S.cam.lat, S.cam.lon, p.lat, p.lon);
      return `<div class="v2-site">${siteIcon(p)}<button class="go" data-go-site="${esc(p.id)}"><strong>${esc(p.n)}</strong><small>${p.set === 'roman' ? esc(p.reg) : esc(TYPENAME[p.cat] || '') + (p.reg ? ' · ' + esc(p.reg) : '')}</small></button><span class="km">${fmtKm(d)}</span>${o.ab ? `<span class="ab"><button data-seta="${esc(p.id)}" class="${pk.a === p.id ? 'on' : ''}" aria-label="Use ${esc(p.n)} as point A">A</button><button data-setb="${esc(p.id)}" class="${pk.b === p.id ? 'on' : ''}" aria-label="Use ${esc(p.n)} as point B">B</button></span>` : ''}</div>`;
    })
    .join('');
}
function v2ListTools(o, prefix) {
  return `<div class="v2-tools-row"><span class="v2-muted">${nf(o.total)} site${o.total === 1 ? '' : 's'}${o.total > o.shown ? ` · showing ${nf(o.shown)}` : ''}</span><div class="seg" role="group" aria-label="Sort">${o.match ? `<button data-${prefix}sort="match" aria-pressed="${o.sort === 'match'}">Best match</button>` : ''}<button data-${prefix}sort="az" aria-pressed="${o.sort === 'az'}">A–Z</button><button data-${prefix}sort="near" aria-pressed="${o.sort === 'near'}">Nearest</button><button data-${prefix}view="1" aria-pressed="${o.inView}">In view</button></div></div>`;
}
// A/B picker modal
export function v2OpenBrowser(which, chain) {
  const A = which === 'b' && V2.pick.a ? findPoint(V2.pick.a) : null;
  V2.browser = {
    which,
    chain,
    query: '',
    cat: V2.cat,
    sort: A ? 'match' : 'near',
    inView: false,
    limit: 80,
    from: A,
    lm: A && lmReady(A.id) ? LM : null,
  };
  if (A && !V2.browser.lm)
    lmForAsync(
      A.id,
      M => {
        const o = V2.browser;
        if (!o || o.from !== A) return;
        o.lm = M;
        v2RenderBrowser();
      },
      p => {
        const el = $('#v2bbody .lm-wait');
        if (el) el.textContent = `Scoring every direction from here… ${Math.round(p * 100)}%`;
      },
    );
  $('#v2btitle').textContent =
    which === 'a'
      ? 'Point A · starting site'
      : which === 'from'
        ? 'Start the line from…'
        : 'Point B · destination site';
  $('#v2browser').hidden = false;
  v2RenderBrowser(true);
}
function v2RenderBrowser(focus) {
  const o = V2.browser;
  if (!o) return;
  const arr = v2Filtered(o),
    shown = arr.slice(0, o.limit);
  const A = o.from,
    lm = o.lm,
    km = p => fmtKm(GEO.dist((A || S.cam).lat, (A || S.cam).lon, p.lat, p.lon));
  const head = A
    ? `<div class="lm-head"><div>From <b>${esc(A.n)}</b>: ${lm ? `each site is scored by how much more lines up along the line to it than along the 30 directions just beside it (±15°). <b>28/30</b> means it beats 28 of them. Higher = a sharper alignment. A guide, not proof.` : '<span class="lm-wait">Scoring every direction from here…</span>'}</div>
    <div class="lm-sig" role="group" aria-label="What counts">${MSIG.map(([k, t, col]) => `<button data-msig="${k}" aria-pressed="${V2.msig[k]}"><span class="lm-dot" style="background:${col}"></span>${t}</button>`).join('')}${lm ? '<button data-bmap="1" class="lm-map">Show on map</button>' : ''}</div></div>`
    : '';
  const row = p => {
    const s = lm && lm.scores.get(p.id);
    return `<div class="v2-site">${siteIcon(p)}<button class="go" data-pick="${esc(p.id)}"><strong>${esc(p.n)}</strong><small>${s ? esc(lmWhy(s)) : p.set === 'roman' ? esc(p.reg) : esc(TYPENAME[p.cat] || '') + (p.reg ? ' · ' + esc(p.reg) : '')}</small></button>${s ? `<span class="lm-right">${lmBar(s)}<span class="km">${km(p)}</span></span>` : `<span class="km">${km(p)}</span>`}<span class="ab"><button data-pick="${esc(p.id)}" class="on" aria-label="Use ${esc(p.n)} as point ${o.which.toUpperCase()}">${o.which.toUpperCase()}</button></span></div>`;
  };
  $('#v2bbody').innerHTML =
    `<div class="v2-search"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><input type="search" id="v2bq" placeholder="Search name, country or type" value="${esc(o.query)}" autocomplete="off" aria-label="Search sites"></div>${head}${v2Chips(o.cat, 'data-bcat')}${v2ListTools({ total: arr.length, shown: shown.length, sort: o.sort, inView: o.inView, match: !!A }, 'b')}<div class="v2b-list">${shown.map(row).join('') || '<div class="v2-empty">No site matches. Try another category or clear the search.</div>'}${arr.length > shown.length ? `<button class="v2-action full" id="v2bmore" style="margin:10px 0">Show ${nf(Math.min(80, arr.length - shown.length))} more</button>` : ''}</div>`;
  const inp = $('#v2bq');
  inp.oninput = e => {
    o.query = e.target.value;
    o.limit = 80;
    const pos = e.target.selectionStart;
    clearTimeout(v2RenderBrowser._t);
    v2RenderBrowser._t = setTimeout(() => {
      v2RenderBrowser();
      const i2 = $('#v2bq');
      i2.focus();
      i2.setSelectionRange(pos, pos);
    }, 120);
  };
  if (focus && innerWidth >= 700) setTimeout(() => $('#v2bq')?.focus(), 40);
}

export function initSiteLists() {
  $('#v2bbody').addEventListener('click', e => {
    const o = V2.browser;
    if (!o) return;
    const pk = e.target.closest('[data-pick]');
    if (pk) {
      const id = pk.dataset.pick,
        chain = o.chain && o.which === 'a';
      $('#v2browser').hidden = true;
      V2.browser = null;
      if (o.which === 'from') {
        V2.bear.from = id;
        v2Render();
        return;
      }
      v2SetPoint(o.which, id);
      if (o.which === 'b') lmMarkPicked();
      if (chain && !V2.pick.b) setTimeout(() => v2OpenBrowser('b'), 60);
      return;
    }
    const sg = e.target.closest('[data-msig]');
    if (sg) {
      const k = sg.dataset.msig;
      V2.msig[k] = !V2.msig[k];
      if (LM) LM.top = null;
      v2RenderBrowser();
      req();
      return;
    }
    if (e.target.closest('[data-bmap]')) {
      $('#v2browser').hidden = true;
      V2.browser = null;
      V2.picking = true;
      V2.tab = 'draw';
      setSheet('peek');
      const A = findPoint(V2.pick.a);
      if (A) flyTo(A.lon, A.lat, Math.min(S.cam.k, kForKm(2600)), 900);
      v2Render();
      req();
      toast('Gold wedges = promising directions from A. Ringed sites are the best matches.', 4200);
      return;
    }
    const c = e.target.closest('[data-bcat]');
    if (c) {
      o.cat = c.dataset.bcat;
      o.limit = 80;
      v2RenderBrowser();
      return;
    }
    const so = e.target.closest('[data-bsort]');
    if (so) {
      o.sort = so.dataset.bsort;
      v2RenderBrowser();
      return;
    }
    if (e.target.closest('[data-bview]')) {
      o.inView = !o.inView;
      v2RenderBrowser();
      return;
    }
    if (e.target.id === 'v2bmore') {
      o.limit += 80;
      v2RenderBrowser();
    }
  });
  $('#v2bclose').onclick = () => {
    $('#v2browser').hidden = true;
    V2.browser = null;
  };
  $('#v2browser').addEventListener('click', e => {
    if (e.target.id === 'v2browser') {
      $('#v2browser').hidden = true;
      V2.browser = null;
    }
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    if (!$('#modal').hidden || !$('#picker').hidden) return;
    if (!$('#v2browser').hidden) {
      $('#v2browser').hidden = true;
      V2.browser = null;
    } else if (V2.layersOpen) {
      V2.layersOpen = false;
      v2Render();
    } else if (V2.host) v2CloseHost();
    else if (S.mode !== 'draw' && !(S.sel || V2.hl) && V2.tab) v2Back();
    else if ((S.sel || V2.hl) && S.mode !== 'draw') v2Done();
    else if (S.mode === 'draw') {
      setMode(null);
      V2.drawPoints = [];
      V2.hover = null;
      v2Render();
      req();
    }
  });
}

// Setters for variables that other modules change.
export function setCATCOUNT(v) {
  return (CATCOUNT = v);
}
