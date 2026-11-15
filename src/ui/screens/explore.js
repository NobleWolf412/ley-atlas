// Explore screen: search and browse sites, or the selected site
import { S } from '../../state/state.js';
import { findPoint } from '../../domain/points.js';
import { depInfo } from '../../domain/underground.js';
import { V2 } from '../../state/preferences.js';
import { NO_MATCH, v2Chips, v2CountrySelect, v2Filtered, v2SiteRows } from '../site-lists.js';
import { siteIcon } from '../../render/icons.js';
import { esc, nf } from '../../core/util.js';
import { TYPENAME } from '../../domain/site-types.js';
import { lmCardLine } from '../../features/line-match.js';
import { v2Button, v2Peek } from '../panel-parts.js';
import { satUrl } from '../../core/format.js';
import { DISPBY } from '../../domain/categories.js';
import { ROMAN } from '../../data/datasets.js';

const exploreOptions = () => ({
  query: V2.query,
  cat: V2.cat,
  country: V2.country,
  sort: V2.sort,
  inView: V2.inView,
  limit: V2.limit,
});
/** The part of Explore that changes while typing: the count and the rows. */
export function exploreResults(arr = v2Filtered(exploreOptions())) {
  const shown = arr.slice(0, V2.limit);
  return (
    `<p class="v2-muted" style="margin:4px 0 2px">${nf(arr.length)} ${V2.query.trim() ? `result${arr.length === 1 ? '' : 's'}, best matches first` : `site${arr.length === 1 ? '' : 's'}, nearest first`}</p>` +
    `<div id="v2sitelist">${v2SiteRows(shown, { ab: false }) || NO_MATCH}</div>` +
    (arr.length > shown.length
      ? `<button class="v2-action full" data-v2="more" style="margin-top:10px">Show ${nf(Math.min(60, arr.length - shown.length))} more</button>`
      : '')
  );
}
export function v2Explore() {
  const s = S.sel?.type === 'site' ? findPoint(S.sel.id) : null,
    dep = S.sel?.type === 'dep' ? depInfo(S.sel.k) : null;
  const o = exploreOptions(),
    arr = v2Filtered(o);
  const card = s
    ? `<div class="v2-card tinted"><div class="v2-row" style="justify-content:flex-start;gap:8px">${siteIcon(s)}<h3 style="margin:0">${esc(s.n)}</h3></div><div class="v2-muted" style="margin-top:4px">${esc(TYPENAME[s.cat] || s.cat)}${s.reg ? ' · ' + esc(s.reg) : ''}${s.built ? ' · ' + esc(s.built) : ''}</div>${lmCardLine(s)}<div class="v2-actions">${V2.pick.a && !V2.pick.b && V2.pick.a !== s.id ? v2Button('site-line', `Draw the line to here`, 'primary') + v2Button('site-restart', 'Start here instead') : v2Button('site-restart', 'Start a line here', 'primary')}${v2Button('site-full', 'More details')}<a class="v2-action" href="${satUrl(s.lat, s.lon, 18)}" target="_blank" rel="noopener">Google Maps ↗</a></div>${s.stone ? `<p class="v2-muted" style="margin-top:8px">Stonework: masonry ${s.stone.masonry}/4, precision ${s.stone.precision}/4${s.stone.tons ? `, largest block ${nf(s.stone.tons)} t` : ''}${s.stone.rock ? ', rock-cut' : ''}.</p>` : ''}<div id="v2ug" class="v2-muted" style="margin-top:6px">Checking what lies underground nearby…</div></div>`
    : dep
      ? `<div class="v2-card tinted"><h3>${esc(dep.n)}</h3><p class="v2-sub">${esc(dep.groups.join(', '))}${dep.magnetite ? ' (magnetite)' : ''} · ${esc(dep.cc)} · ${esc(dep.status)}${dep.type ? ' · ' + esc(dep.type) : ''}</p><p class="v2-muted">${esc(dep.src)}</p><div class="v2-actions"><a class="v2-action" href="${satUrl(dep.lat, dep.lon)}" target="_blank" rel="noopener">Google Maps ↗</a></div></div>`
      : S.sel?.type === 'fault'
        ? `<div class="v2-card tinted"><h3>${esc(S.sel.ref.name || 'Unnamed fault')}</h3><p class="v2-sub">${esc((S.sel.ref.st || 'movement not recorded').replace(/_/g, ' '))} · ${esc(S.sel.ref.cat || '')} · GEM Global Active Faults</p></div>`
        : '';
  const word =
    V2.cat === 'all' ? 'all sites' : DISPBY[V2.cat][1].replace(/^(?!Roman)\w/, ch => ch.toLowerCase());
  return (
    v2Peek(
      s
        ? esc(s.n)
        : dep
          ? esc(dep.n)
          : V2.query.trim()
            ? `“${esc(V2.query.trim())}” · ${nf(arr.length)} result${arr.length === 1 ? '' : 's'}${V2.cat === 'all' ? '' : ' in ' + esc(word)}`
            : `${esc(word[0].toUpperCase() + word.slice(1))} · ${nf(arr.length)}`,
    ) +
    (card
      ? card // a chosen site shows on its own; the search list is for finding one
      : `<div class="v2-search"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><input type="search" id="v2search" value="${esc(V2.query)}" placeholder="Search name, country or type" autocomplete="off" aria-label="Search sites"></div>` +
        v2Chips(V2.cat, 'data-cat-d') +
        (V2.cat === 'roman'
          ? `<p class="v2-muted" style="margin:2px 0 6px">${nf(ROMAN.rows.length)} dated Roman-era monuments from Pleiades, plus sites whose name says Roman${S.src.pleiades ? '' : ` (turn on Pleiades temples in Layers for ${ROMAN.plRoman.length} more)`}. Thorough, not complete.</p>`
          : '') +
        v2CountrySelect(o, 'data-country') +
        `<div id="v2xresults">${exploreResults(arr)}</div>`)
  );
}
