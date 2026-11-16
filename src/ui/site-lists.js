// Site lists (Explore and the A/B picker)
import { GEO } from '../core/geo.js';
import { fold, matchRank, orderTop, queryWords } from '../core/text-search.js';
import { assignCountries, countryCounts } from '../domain/countries.js';
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
// what the search box looks through, built once per site: name, then region, type and country
function searchText(p) {
  if (!p._q)
    p._q = {
      name: fold(p.n),
      strong: fold(`${TYPENAME[p.cat] || ''} ${p.country || ''}`),
      rest: fold(p.reg || ''),
    };
  return p._q;
}
const AZ = new Intl.Collator('en', { sensitivity: 'base', ignorePunctuation: true, numeric: true });
const inCategory = (o, p) => (o.cat === 'all' ? shownP(p) : srcOn(p) && dispMatch(o.cat, p));
export function v2Filtered(o) {
  assignCountries(ALLP);
  const words = queryWords(o.query || ''),
    B = o.inView ? viewBounds() : null;
  let arr = [];
  for (const p of ALLP) {
    if (p.set === 'marker' && o.markers === false) continue;
    if (!inCategory(o, p)) continue;
    if (o.country && p.country !== o.country) continue;
    if (B && !ptInB(p.lat, p.lon, B)) continue;
    if (words.length) {
      p._r = matchRank(searchText(p), words);
      if (!p._r) continue;
    }
    arr.push(p);
  }
  if (o.sort === 'match' && o.lm) {
    arr = arr.filter(p => o.lm.scores.has(p.id));
    for (const p of arr) p._m = lmCombined(o.lm.scores.get(p.id));
    arr.sort((a, b) => b._m - a._m || o.lm.scores.get(a.id).L - o.lm.scores.get(b.id).L);
    return arr;
  }
  // One numeric key per site, so the list is sorted once: best name matches first, and within a
  // rank nearest first. Nearness uses the sites' ready-made unit vectors (no trigonometry).
  const rank = p => (words.length ? p._r * 4 : 0);
  if (o.sort === 'near' || o.sort === 'match') {
    const c0 = o.from || S.cam,
      c = GEO.vec(c0.lat, c0.lon);
    for (const p of arr) p._k = -(p.v[0] * c[0] + p.v[1] * c[1] + p.v[2] * c[2]) - rank(p);
    orderTop(arr, p => p._k, o.limit || arr.length); // only the rows that will be shown need ordering
  } else arr.sort((a, b) => rank(b) - rank(a) || AZ.compare(a.n, b.n));
  return arr;
}
// ---------- country filter ----------
/** Moves the map to frame the sites of one country (no-op when it has none). */
export function flyToCountry(country) {
  const pts = ALLP.filter(p => p.country === country && p.set !== 'marker');
  if (!pts.length) return;
  const sum = [0, 0, 0];
  for (const p of pts) for (let i = 0; i < 3; i++) sum[i] += p.v[i];
  const [lat, lon] = GEO.ll(sum);
  let far = 0;
  for (const p of pts) far = Math.max(far, GEO.dist(lat, lon, p.lat, p.lon));
  flyTo(lon, lat, kForKm(Math.max(300, Math.min(7000, far * 2.6))), 900);
}
let COUNTRYOPTS = null;
/** A country drop-down for the sites in category `o.cat`. `attr` marks it for the change handler. */
export function v2CountrySelect(o, attr) {
  assignCountries(ALLP);
  const key = [o.cat, ALLP.length, JSON.stringify(S.src), JSON.stringify(S.layers.cat)].join('|');
  if (!COUNTRYOPTS || COUNTRYOPTS.key !== key)
    COUNTRYOPTS = { key, list: countryCounts(ALLP.filter(p => p.set !== 'marker' && inCategory(o, p))) };
  const list =
    COUNTRYOPTS.list.some(([c]) => c === o.country) || !o.country
      ? COUNTRYOPTS.list
      : [[o.country, 0], ...COUNTRYOPTS.list];
  return `<label class="v2-country"><span>Country</span><select ${attr} aria-label="Filter by country"><option value="">All countries</option>${list.map(([c, n]) => `<option value="${esc(c)}"${c === o.country ? ' selected' : ''}>${esc(c)} (${nf(n)})</option>`).join('')}</select></label>`;
}
function v2CatCounts(country) {
  if (country) assignCountries(ALLP);
  const out = {};
  for (const [k] of DISP) out[k] = 0;
  for (const p of ALLP) {
    if (p.set === 'marker' || !srcOn(p)) continue;
    if (country && p.country !== country) continue;
    if (shownP(p)) out.all++;
    for (const [k, , f] of DISP) if (k !== 'all' && f(p)) out[k]++;
  }
  return out;
}
export let CATCOUNT = null,
  CATKEY = '';
/** The category chips. With a country chosen, each count is the number of sites in that country. */
export function v2Chips(sel, attr, country = '') {
  const key =
    ALLP.length +
    JSON.stringify(S.src) +
    JSON.stringify(S.layers.cat) +
    S.imports.map(i => i.on).join() +
    '|' +
    country;
  if (!CATCOUNT || CATKEY !== key) {
    CATCOUNT = v2CatCounts(country);
    CATKEY = key;
  }
  return `<div class="v2-chips" role="group" aria-label="Site categories${country ? ' in ' + esc(country) : ''}">${DISP.map(([k, t]) => `<button class="v2-chip${CATCOUNT[k] ? '' : ' none'}" ${attr}="${k}" aria-pressed="${sel === k}">${dispIcon(k)}${esc(t)} <small>${nf(CATCOUNT[k])}</small></button>`).join('')}</div>`;
}
// the small line under a site's name: type, region, and the country when the region does not say it
function siteSub(p) {
  const base = p.set === 'roman' ? p.reg || '' : (TYPENAME[p.cat] || '') + (p.reg ? ' · ' + p.reg : '');
  return esc(p.country && !base.includes(p.country) ? `${base} · ${p.country}` : base);
}
export const NO_MATCH = '<div class="v2-empty">No site matches. Try another word, category or country.</div>';
export function v2SiteRows(arr, o) {
  const pk = V2.pick;
  return arr
    .map(p => {
      const d = GEO.dist(S.cam.lat, S.cam.lon, p.lat, p.lon);
      return `<div class="v2-site">${siteIcon(p)}<button class="go" data-go-site="${esc(p.id)}"><strong>${esc(p.n)}</strong><small>${siteSub(p)}</small></button><span class="km">${fmtKm(d)}</span>${o.ab ? `<span class="ab"><button data-seta="${esc(p.id)}" class="${pk.a === p.id ? 'on' : ''}" aria-label="Use ${esc(p.n)} as point A">A</button><button data-setb="${esc(p.id)}" class="${pk.b === p.id ? 'on' : ''}" aria-label="Use ${esc(p.n)} as point B">B</button></span>` : ''}</div>`;
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
    country: '',
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
// the part of the picker that changes while typing: count, sort buttons and the rows
function v2BrowserResults() {
  const o = V2.browser,
    arr = v2Filtered(o),
    shown = arr.slice(0, o.limit);
  const A = o.from,
    lm = o.lm,
    km = p => fmtKm(GEO.dist((A || S.cam).lat, (A || S.cam).lon, p.lat, p.lon));
  const row = p => {
    const s = lm && lm.scores.get(p.id);
    return `<div class="v2-site">${siteIcon(p)}<button class="go" data-pick="${esc(p.id)}"><strong>${esc(p.n)}</strong><small>${s ? esc(lmWhy(s)) : siteSub(p)}</small></button>${s ? `<span class="lm-right">${lmBar(s)}<span class="km">${km(p)}</span></span>` : `<span class="km">${km(p)}</span>`}<span class="ab"><button data-pick="${esc(p.id)}" class="on" aria-label="Use ${esc(p.n)} as point ${o.which.toUpperCase()}">${o.which.toUpperCase()}</button></span></div>`;
  };
  return (
    v2ListTools({ total: arr.length, shown: shown.length, sort: o.sort, inView: o.inView, match: !!A }, 'b') +
    `<div class="v2b-list">${shown.map(row).join('') || NO_MATCH}${arr.length > shown.length ? `<button class="v2-action full" id="v2bmore" style="margin:10px 0">Show ${nf(Math.min(80, arr.length - shown.length))} more</button>` : ''}</div>`
  );
}
function v2RenderBrowser(focus) {
  const o = V2.browser;
  if (!o) return;
  const A = o.from,
    lm = o.lm;
  const head = A
    ? `<div class="lm-head"><div>From <b>${esc(A.n)}</b>: ${lm ? `each site is scored by how much more lines up along the line to it than along the 30 directions just beside it (±15°). <b>28/30</b> means it beats 28 of them. Higher = a sharper alignment. A guide, not proof.` : '<span class="lm-wait">Scoring every direction from here…</span>'}</div>
    <div class="lm-sig" role="group" aria-label="What counts">${MSIG.map(([k, t, col]) => `<button data-msig="${k}" aria-pressed="${V2.msig[k]}"><span class="lm-dot" style="background:${col}"></span>${t}</button>`).join('')}${lm ? '<button data-bmap="1" class="lm-map">Show on map</button>' : ''}</div></div>`
    : '';
  $('#v2bbody').innerHTML =
    `<div class="v2-search"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><input type="search" id="v2bq" placeholder="Search name, country or type" value="${esc(o.query)}" autocomplete="off" aria-label="Search sites"></div>${head}${v2Chips(o.cat, 'data-bcat', o.country)}${v2CountrySelect(o, 'data-bcountry')}<div id="v2bresults">${v2BrowserResults()}</div>`;
  // typing only redraws the results, so the search box keeps its focus and the keyboard stays up
  $('#v2bq').oninput = e => {
    o.query = e.target.value;
    o.limit = 80;
    clearTimeout(v2RenderBrowser._t);
    v2RenderBrowser._t = setTimeout(() => {
      const el = $('#v2bresults');
      if (el && V2.browser === o) el.innerHTML = v2BrowserResults();
    }, 50);
  };
  if (focus && innerWidth >= 700) setTimeout(() => $('#v2bq')?.focus(), 40);
}

export function initSiteLists() {
  // work out every site's country and search text shortly after start-up, so the first search does not wait
  setTimeout(() => {
    assignCountries(ALLP);
    ALLP.forEach(searchText);
  }, 1500);
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
  $('#v2bbody').addEventListener('change', e => {
    const o = V2.browser;
    if (!o || !e.target.matches('[data-bcountry]')) return;
    o.country = e.target.value;
    o.limit = 80;
    v2RenderBrowser();
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
