// Panels: explore, draw, analyze, menu, saved
import { shareCurrent } from '../features/share-link.js';
import { GEO } from '../core/geo.js';
import { $, esc, nf } from '../core/util.js';
import { ROMAN } from '../data/datasets.js';
import { DISPBY } from '../domain/categories.js';
import { siteIcon } from '../render/icons.js';
import { activeLine, lineDist } from '../domain/lines.js';
import { findPoint, rebuildPoints } from '../domain/points.js';
import { TYPENAME } from '../domain/site-types.js';
import {
  v2ApplyEnds,
  v2ConnectSites,
  v2DrawBearing,
  v2Ends,
  v2SaveWork,
  v2SetPoint,
  v2StartDraw,
  v2SyncPick,
} from '../features/create-lines.js';
import {
  KINDTXT,
  glowColor,
  v2Alert,
  v2DiscFor,
  v2Discover,
  v2LineChanged,
  v2Summary,
} from '../features/discovery.js';
import { startFollow } from '../features/follow-line.js';
import { LM, lmCardLine, lmMarkPicked, lmRankLine } from '../features/line-match.js';
import { UG, UGNAME, depData, depInfo, magWord, plateLabel, undergroundAt } from '../domain/underground.js';
import { flyTo, flyToLine } from '../map/camera.js';
import { H, W, cv, kForKm, proj } from '../map/canvas.js';
import { draw, req } from '../map/draw.js';
import { fmtKm, fmtLL, satUrl } from '../core/format.js';
import { setView } from '../map/interaction.js';
import { ZOOM_MODES } from '../map/zoom-modes.js';
import { confirmBox, csv, geojson, loadState, openHtml, openText, stateCode } from '../panels/data-pane.js';
import { showDetail } from '../panels/detail.js';
import { renderLayers } from '../panels/layers-pane.js';
import { precisionBlock, revealPoint, setActive } from '../panels/lines-pane.js';
import { C } from '../render/palette.js';
import { CORRIDORS, V2, v2Persist } from '../state/preferences.js';
import { S, persistImports, stripF } from '../state/state.js';
import { toast, toastUndo } from './intro.js';
import { renderKey, setFocus } from './map-chrome.js';
import { setMode } from './modes.js';
import { openLinePicker } from './picker.js';
import { changed, selectTab, setSheet } from './sheet.js';
import { v2Chips, v2Filtered, v2OpenBrowser, v2SiteRows } from './site-lists.js';

// ---------- panels ----------
function v2ButtonId(action, id, label, cls = '') {
  return `<button class="v2-action ${cls}" data-v2="${action}" data-id="${esc(id)}">${label}</button>`;
}
// rows you can swipe left to reveal Delete (or swipe all the way to delete); the action still offers Undo
export function v2SwipeRow(action, id, name, inner) {
  return `<div class="v2-swipe"><button class="v2-swipe-del" data-v2="${action}" data-id="${esc(id)}" tabindex="-1" aria-label="Delete ${esc(name)}">Delete</button><div class="v2-swipe-row" data-swipe="${action}" data-id="${esc(id)}">${inner}</div></div>`;
}
function v2Button(action, label, cls = '') {
  return `<button class="v2-action ${cls}" data-v2="${action}">${label}</button>`;
}
function v2Peek(text) {
  return `<div class="v2-peek"><span>${text}</span><span aria-hidden="true">⌃ Expand</span></div>`;
}
function v2PointBtn(which, id) {
  const p = id && findPoint(id);
  return `<button class="v2-pt ${p ? '' : 'empty'}" data-v2="pick-${which}"><span class="tag">${which === 'from' ? '↗' : which.toUpperCase()}</span>${p ? siteIcon(p) : ''}<span class="nm"><strong>${p ? esc(p.n) : which === 'a' ? 'Choose the first site' : which === 'from' ? 'Choose the site to start from' : 'Choose the second site'}</strong><small>${p ? (p.set === 'roman' ? esc(p.reg) : esc(TYPENAME[p.cat] || '') + (p.reg ? ' · ' + esc(p.reg) : '')) : 'Castles, forts, temples, stones…'}</small></span><svg width="14" height="14" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg></button>`;
}
function v2CorridorChips() {
  return `<div class="v2-actions" role="group" aria-label="Search corridor">${CORRIDORS.map(n => `<button class="v2-action ${Math.abs(S.corridorKm - n) < 1e-9 ? 'primary' : ''}" data-width="${n}">±${n} km</button>`).join('')}</div>`;
}
function v2Explore() {
  const s = S.sel?.type === 'site' ? findPoint(S.sel.id) : null,
    dep = S.sel?.type === 'dep' ? depInfo(S.sel.k) : null;
  const o = { query: V2.query, cat: V2.cat, sort: V2.sort, inView: V2.inView },
    arr = v2Filtered(o),
    shown = arr.slice(0, V2.limit);
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
        `<p class="v2-muted" style="margin:4px 0 2px">${nf(arr.length)} site${arr.length === 1 ? '' : 's'}, nearest first</p>` +
        `<div id="v2sitelist">${v2SiteRows(shown, { ab: false }) || '<div class="v2-empty">No site matches. Try another category or clear the search.</div>'}</div>` +
        (arr.length > shown.length
          ? `<button class="v2-action full" data-v2="more" style="margin-top:10px">Show ${nf(Math.min(60, arr.length - shown.length))} more</button>`
          : ''))
  );
}
function v2Draw() {
  v2SyncPick();
  const w = V2.picking ? null : S.work,
    ends = w ? v2Ends(w) : null,
    global = w && w.len == null;
  const d = w ? v2DiscFor(activeLine()) : null;
  if (S.mode === 'draw')
    return (
      v2Peek(V2.drawPoints.length ? 'Tap the second spot on the map' : 'Tap the first spot on the map') +
      `<div class="v2-guide"><strong>${V2.drawPoints.length ? 'First spot placed' : 'Drawing freehand'}</strong><p class="v2-sub" style="margin:5px 0 0">${V2.drawPoints.length ? 'Tap a second spot on the map.' : 'Tap any two spots on the map.'}</p>${v2Button('cancel-draw', 'Cancel')}</div>`
    );
  if (w)
    return (
      v2Peek(esc(v2Summary(d))) +
      `<div class="v2-card tinted"><h3 style="margin:0 0 4px">${esc(w.name || 'Your line')}</h3>
      <p class="v2-muted" style="margin:0">${global ? 'All the way round the globe' : fmtKm(GEO.dist(...ends[0], ...ends[1]))} · heading ${(w.brg || 0).toFixed(0)}°</p>
      <p class="v2-sum"><span class="v2-glowkey" style="background:${(d && glowColor(d.kind)) || 'var(--line)'}"></span>${esc(v2Summary(d))}</p>
      <div class="v2-actions">${v2Button('analyze', 'See what’s along it', 'primary')}${v2Button('follow', '▶ Follow it')}${v2Button('share', 'Share')}</div></div>` +
      `<div class="v2-card"><label class="v2-field" style="margin-top:0">Name<input id="v2name" type="text" maxlength="100" value="${esc(w.name || 'Untitled line')}"></label>
      <div class="v2-actions">${v2Button('save-work', V2.editId ? 'Save changes' : 'Save line', 'primary')}${v2Button('new-line', '＋ New line')}${v2Button('discard', 'Remove', 'danger')}</div>
      <details class="v2-more"><summary>More options</summary><label class="v2-feature"><span class="v2-description"><strong>Extend around the globe</strong><small>Draw the full circle, not just between the two points</small></span><input type="checkbox" id="v2global" ${global ? 'checked' : ''}></label><p class="v2-muted v2-mono" style="margin:6px 0 0">A ${fmtLL(ends[0][0], ends[0][1], 4)}<br>B ${fmtLL(ends[1][0], ends[1][1], 4)}</p></details></div>`
    );
  const guide =
    V2.pick.a && !V2.pick.b && LM && LM.A.id === V2.pick.a
      ? `<div class="v2-card soft lm-guide"><strong>Not sure where to go?</strong><p class="v2-sub" style="margin:4px 0 8px">Gold wedges on the map are directions from ${esc(findPoint(V2.pick.a)?.n || 'A')} where more minerals, faults, magnetic rock or sites line up than usual. Ringed sites are the best matches. A guide, not proof.</p>${v2Button('pick-best', 'See best matches', 'primary')}</div>`
      : '';
  return (
    v2Peek(V2.pick.a ? 'Now choose where the line goes' : 'Choose two sites') +
    `<p class="v2-sub" style="margin:0 0 10px">Pick two sites. The line appears on the map with what lies along it.</p>` +
    guide +
    `<div class="v2-card">${v2PointBtn('a', V2.pick.a)}<div class="v2-swap">${v2Button('swap', '⇅ Swap', 'ghost')}</div>${v2PointBtn('b', V2.pick.b)}</div>` +
    `<details class="v2-more v2-card soft"><summary>Other ways to draw</summary><div class="v2-actions">${v2Button('draw-start', '✎ Tap two spots on the map')}</div>
      <div class="v2-divide"></div><div class="v2-kicker">From a site at a set heading</div>${v2PointBtn('from', V2.bear.from)}
      <div class="v2-bear"><label class="v2-field">Heading (° from north)<input id="v2brg" type="number" step="0.01" min="0" max="360" inputmode="decimal" value="${esc(V2.bear.brg)}"></label><label class="v2-field">Length<select id="v2blen">${[
        ['100', '100 km'],
        ['1000', '1,000 km'],
        ['5000', '5,000 km'],
        ['g', 'Around the globe'],
      ]
        .map(([v, t]) => `<option value="${v}" ${V2.bear.len === v ? 'selected' : ''}>${t}</option>`)
        .join('')}</select></label></div>
      <div class="v2-actions">${v2Button('bearing-go', 'Draw it', V2.bear.from ? 'primary' : '')}</div></details>`
  );
}
function v2Find(attrs, title, sub, right) {
  return `<button class="v2-find" ${attrs}><span class="nm"><strong>${title}</strong><small>${sub}</small></span><span class="km">${right}</span></button>`;
}
function v2Analyze() {
  const L = activeLine();
  if (!L)
    return (
      v2Peek('No line yet') +
      `<p class="v2-sub">Draw a line between two sites and what lies along it shows up here. You can also open one of the published case-study lines.</p>` +
      `<div class="v2-actions">${v2Button('new-line', '＋ Draw a line', 'primary')}${v2Button('choose-line', 'Open a case-study line')}</div>`
    );
  const d = v2Discover(),
    sg = L.segs[0],
    ends = L.layer === 'user' && L.v2ends ? L.v2ends : null;
  const A = L.anchors[0] && findPoint(L.anchors[0]),
    B = L.anchors[1] && findPoint(L.anchors[L.style === 'primary' ? 1 : L.anchors.length - 1]); // a case study's extra anchors come after its two defining sites
  const lenTxt =
    L.segs.length > 1
      ? 'A path through several sites'
      : isFinite(sg.len)
        ? fmtKm(sg.len) + ' long'
        : 'All the way round the globe';
  const depRows = d.dep.near
    .slice(0, 12)
    .map(o => {
      const i = depInfo(o.k);
      return v2Find(
        `data-hl-dep="${o.k}" data-off="${o.d}"`,
        esc(i.n),
        `${esc(i.groups.join(', '))}${i.magnetite ? ' (magnetite)' : ''} · ${esc(i.cc)} · ${esc(i.status)}`,
        fmtKm(o.d),
      );
    })
    .join('');
  const fRows = d.fau.list
    .slice(0, 10)
    .map(h =>
      v2Find(
        `data-hl-at="${h.lat},${h.lon}" data-hl-label="${esc(h.r.name || 'Unnamed fault')}" data-hl-kind="fault" data-off="${h.d}"`,
        esc(h.r.name || 'Unnamed fault') +
          (h.d === 0
            ? '<span class="v2-badge ver">CROSSES</span>'
            : '<span class="v2-badge cor">IN CORRIDOR</span>'),
        `${esc((h.r.st || 'movement not recorded').replace(/_/g, ' '))} · ${esc(h.r.cat)}`,
        h.d === 0 ? 'on line' : fmtKm(h.d),
      ),
    )
    .join('');
  const pRows = d.pla.list
    .slice(0, 4)
    .map(h =>
      v2Find(
        `data-hl-at="${h.lat},${h.lon}" data-hl-label="${esc(plateLabel(h.r.name))} boundary" data-hl-kind="plate" data-off="${h.d}"`,
        esc(plateLabel(h.r.name)) +
          (h.d === 0
            ? '<span class="v2-badge ver">CROSSES</span>'
            : '<span class="v2-badge cor">IN CORRIDOR</span>'),
        'Plate boundary · Bird (2003)',
        h.d === 0 ? 'on line' : fmtKm(h.d),
      ),
    )
    .join('');
  const anch = L.anchors.map(findPoint).filter(Boolean);
  const anchorsRows =
    anch.length >= 2
      ? anch
          .map(s => {
            const r = lineDist(L, s.lat, s.lon);
            return `<tr><td>${esc(s.n)}</td><td class="n">${fmtKm(r.d)}${r.d > 0.0005 ? (r.xt > 0 ? ' L' : ' R') : ''}</td></tr>`;
          })
          .join('')
      : '';
  const precise =
    (L.sigma ? precisionBlock(L) : '') +
    (anchorsRows
      ? `<h2>How far each anchor is from the line</h2><div class="tblwrap"><table class="tbl"><tr><th>Anchor</th><th style="text-align:right">Off-line</th></tr>${anchorsRows}</table></div><p class="small">Anchors are not snapped to the line. L / R = left / right of the direction of travel.</p>`
      : '');
  const siteRows = d.sites
    .slice(0, V2.allSites ? 400 : 14)
    .map(m =>
      v2Find(
        `data-hl-site="${esc(m.p.id)}" data-off="${m.d}"`,
        `${siteIcon(m.p).replace('class="ic"', 'class="ic" width="16" height="16" style="vertical-align:-3px;margin-right:5px"')}${esc(m.p.n)}`,
        `${esc(TYPENAME[m.p.cat] || '')}${m.p.reg ? ' · ' + esc(m.p.reg) : ''} · ±${fmtKm((m.p.unc || 0) / 1000)} position`,
        fmtKm(m.d),
      ),
    )
    .join('');
  const forts = d.sites.filter(m => m.p.cat === 'fort').length,
    stone = d.sites.filter(m => m.p.stone || m.p.cat === 'megalith').length;
  const mg = d.mg;
  return (
    v2Peek(`${esc(KINDTXT[d.kind])} · ±${fmtKm(d.w)}`) +
    `<h2 style="margin:0 0 8px">${esc(L.short || L.name)}</h2>` +
    `<div class="v2-card tinted">
      <p class="v2-muted" style="margin:0 0 4px">${lenTxt} · heading ${sg.brg.toFixed(1)}°</p>
      <p class="v2-muted" style="margin:0">${A ? `A: ${esc(A.n)} (${fmtLL(A.lat, A.lon, 3)})` : ends ? `A: ${fmtLL(ends[0][0], ends[0][1], 3)}` : `Starts ${fmtLL(sg.o[0], sg.o[1], 3)}`}${B && B !== A ? `<br>B: ${esc(B.n)} (${fmtLL(B.lat, B.lon, 3)})` : ends ? `<br>B: ${fmtLL(ends[1][0], ends[1][1], 3)}` : ''}</p>
      <p class="v2-sub" style="margin:8px 0 4px"><span class="v2-glowkey" style="background:${glowColor(d.kind) || 'var(--line)'}"></span>${esc(KINDTXT[d.kind])}</p>
      <div class="v2-kicker" style="margin-top:8px">Look this far either side of the line</div>${v2CorridorChips()}
      <label class="v2-feature"><span class="v2-description"><strong>Only show sites inside the corridor</strong><small>Hides every other site on the map</small></span><input type="checkbox" data-corronly ${S.corridorOnly ? 'checked' : ''}></label>
      ${L.note ? `<p class="v2-muted" style="margin:6px 0 0">${esc(L.note)}</p>` : ''}
      ${lmRankLine(L)}
      ${L.layer === 'user' && L.id !== 'work' ? `<div class="v2-actions">${v2ButtonId('edit-saved', L.id, 'Edit')}${v2ButtonId('delete-saved', L.id, 'Delete', 'danger')}</div>` : ''}
      <div class="v2-actions">${v2Button('choose-line', 'Change line')}${v2Button('follow', '▶ Follow the line')}${v2Button('tool-lab', 'Is it unusual? (test)')}</div></div>` +
    `<h3 style="margin:16px 0 4px">Geological findings</h3>` +
    `<div class="v2-card"><div class="v2-row"><h3>Mineral deposits</h3><span class="v2-label">${nf(d.dep.total)} within ±${fmtKm(d.w)}</span></div>${
      d.dep.total
        ? `<div class="ugchips" style="margin:4px 0 6px">${UG.filter(([g]) => d.dep.counts[g])
            .map(
              ([g, t]) =>
                `<span class="ugchip" style="cursor:default"><span class="ugsw" style="background:${C.dep[g]}"></span>${esc(t)} <b class="mono">${d.dep.counts[g]}</b></span>`,
            )
            .join('')}</div>${depRows}`
        : '<p class="v2-muted">No deposit records inside the corridor.</p>'
    }<div class="v2-cov">USGS deposit records (MRDS and world catalogues). Positions are map points, often ±1–2 km. ${nf(depData().nApprox)} records that sit on a shared country or county centre point are left out. About 85% of records are in the USA and Canada, so an empty result in Europe or Asia usually means missing records, not missing minerals.</div></div>` +
    `<div class="v2-card"><div class="v2-row"><h3>Active faults</h3><span class="v2-label">${d.fau.crossed} cross · ${d.fau.n - d.fau.crossed} near</span></div>${fRows || '<p class="v2-muted">No mapped active fault crosses the line or comes inside the corridor.</p>'}<div class="v2-cov"><b>Crosses</b> means the mapped fault trace and the line actually intersect. <b>In corridor</b> means the trace comes within ±${fmtKm(d.w)} without crossing. Source: GEM Global Active Faults; old, inactive faults are not mapped.</div></div>` +
    `<div class="v2-card"><div class="v2-row"><h3>Tectonic plates</h3><span class="v2-label">${d.pla.crossed} cross</span></div>${pRows || '<p class="v2-muted">The line stays inside one plate.</p>'}</div>` +
    `<div class="v2-card"><div class="v2-row"><h3>Magnetic field</h3><span class="v2-label">${mg.km ? fmtKm(mg.km) + ' sampled' : 'no data'}</span></div>${mg.max ? `${v2Find(`data-hl-at="${mg.max.lat},${mg.max.lon}" data-hl-label="Strongest magnetic signal" data-hl-kind="mag" data-off="0"`, `Strongest signal: ${mg.max.v > 0 ? '+' : ''}${Math.round(mg.max.v)} nT`, esc(magWord(mg.max.v)), fmtLL(mg.max.lat, mg.max.lon, 2))}<p class="v2-muted">${fmtKm(mg.strong)} of the line is more than 200 nT from the regional average. Sampled every ~2 km; Britain uses its detailed survey, everywhere else (sea included) the world model at about 25 km detail.</p>` : '<p class="v2-muted">No magnetic data along this line (the world model stops at 80° north and south).</p>'}</div>` +
    `<h3 style="margin:16px 0 4px">Historical findings</h3>` +
    `<div class="v2-card"><div class="v2-row"><h3>Structures along the line</h3><span class="v2-label">${nf(d.sites.length)}${forts ? ` · ${forts} forts` : ''}${stone ? ` · ${stone} stonework` : ''}</span></div>${siteRows || '<p class="v2-muted">No switched-on site inside the corridor. Widen it, or switch on more site types under Layers.</p>'}${d.sites.length > 14 ? v2Button('sites-all', V2.allSites ? 'Show fewer' : `Show all ${nf(d.sites.length)}`) : ''}<div class="v2-cov">Counts every site type switched on in Layers, not just the category picked in Explore. Line ends (A and B) are not counted.</div></div>` +
    (precise
      ? `<details class="v2-card v2-more"><summary>How precise is this line?</summary>${precise}</details>`
      : '') +
    `<p class="v2-note">These are observations: what the maps record near the line. Being close to a fault or a mine is not evidence that the line carries energy or was planned. Use “Is it unusual?” to compare with random control lines.</p>`
  );
}
function v2Menu() {
  const row = (act, ic, t, sub) =>
    `<button class="v2-menurow" data-v2="${act}"><span class="ic" aria-hidden="true">${ic}</span><span class="nm"><strong>${t}</strong><small>${sub}</small></span><span aria-hidden="true">›</span></button>`;
  return (
    v2Peek('Menu') +
    row('menu-lines', '▤', 'My lines', `${S.userLines.length} saved · backup and export`) +
    row('menu-layers', '◧', 'Map layers', 'What shows on the map: site types, minerals, faults, lines') +
    row('tool-lab', '◈', 'Is it unusual?', 'Test a line or a set of sites against random ones') +
    row('tool-data', '⇪', 'Add sites & data sources', 'Import your own list; where every dataset comes from')
  );
}
function v2Saved() {
  const lines = [...S.userLines].sort((a, b) => (b.id || '').localeCompare(a.id || ''));
  const list = lines
    .map(u =>
      v2SwipeRow(
        'delete-saved',
        u.id,
        u.name || 'Untitled line',
        `<button class="v2-lrow" data-v2="open-saved" data-id="${esc(u.id)}"><span class="v2-swatch" style="background:${V2.lineColor || C.cyan}"></span><span class="v2-description"><strong>${esc(u.name || 'Untitled line')}</strong><small>${Number.isFinite(u.len) ? fmtKm(u.len) : 'All the way round the globe'}${S.active === u.id ? ' · on the map' : ''}</small></span><span aria-hidden="true" class="v2-chev">›</span></button>`,
      ),
    )
    .join('');
  return (
    v2Peek(`${lines.length} saved line${lines.length !== 1 ? 's' : ''}`) +
    `<p class="v2-sub" style="margin:0 0 10px">Kept in this browser. Make a backup to keep them safe or move them to another device.</p>` +
    `<div class="v2-card"><div class="v2-row"><h3>Saved lines</h3><span class="v2-label">${lines.length}</span></div>${list ? list + '<p class="v2-muted" style="margin:8px 0 0">Tap a line to open it. Swipe it left to delete.</p>' : '<div class="v2-empty">No saved lines yet. Draw a line, then tap Save line.</div>'}<div class="v2-actions">${v2Button('new-line', '＋ New line', 'primary')}${S.work ? v2Button('tab-draw', 'Finish the working line') : ''}</div></div>` +
    `<div class="v2-card"><h3>Backup and export</h3><p class="v2-sub">A backup holds your lines, markers, imports and settings.</p><div class="v2-actions">${v2Button('export-backup', 'Save a backup', 'primary')}${v2Button('import-backup', 'Restore a backup')}</div><div class="v2-kicker" style="margin-top:10px">Export</div><div class="v2-actions">${v2Button('export-geo', 'Lines (GeoJSON)')}${v2Button('export-csv', 'Sites along the line (CSV)')}${v2Button('export-png', 'Map picture')}</div></div>` +
    `<div class="v2-card soft"><h3>Line style</h3><label class="v2-feature"><span class="v2-description"><strong>Discovery glow</strong><small>Gold = minerals, coral = faults, purple = both, teal = historic sites only</small></span><input type="checkbox" data-pref="glow" ${V2.glow ? 'checked' : ''}></label><div class="v2-field">Your line colour<div class="v2-swatches">${[null, '#0b6fc9', '#c62a1d', '#1d8a4b', '#7b3fd0', '#111111', '#ffffff'].map(c => `<button data-linecol="${c || ''}" aria-pressed="${(V2.lineColor || null) === c}" style="background:${c || C.cyan}" aria-label="${c ? 'Colour ' + c : 'Default teal'}"></button>`).join('')}</div></div></div>`
  );
}
function v2LayersHtml() {
  // quick display settings; every on/off switch is in the panel below it (renderLayers)
  return (
    `<div class="v2-row"><div><div class="v2-kicker">Layers</div><h3>When zoomed out, show</h3></div><button class="v2-action ghost" data-v2="layers-close" aria-label="Close layers">✕</button></div>` +
    `<div class="v2-zm" role="radiogroup" aria-label="Zoomed-out display">${ZOOM_MODES.map(([k, t, d]) => `<button role="radio" aria-checked="${V2.zoomMode === k}" data-zm="${k}"><strong>${esc(t)}</strong><small>${esc(d)}</small></button>`).join('')}</div>` +
    `<p class="v2-muted" style="margin:6px 0 0">Up close, every switched-on site always shows. Sites on your line always show.</p>` +
    `<div class="v2-divide"></div><h3>Underground display</h3>` +
    `<div class="v2-ugstyle"><span>Deposits</span><div class="seg" role="group" aria-label="Deposit style"><button data-ugs-dep="points" aria-pressed="${V2.ugDep === 'points'}">Points</button><button data-ugs-dep="heat" aria-pressed="${V2.ugDep === 'heat'}">Density</button></div></div>` +
    `<div class="v2-ugstyle"><span>Faults</span><div class="seg" role="group" aria-label="Fault style"><button data-ugs-fault="lines" aria-pressed="${V2.ugFault === 'lines'}">Lines</button><button data-ugs-fault="heat" aria-pressed="${V2.ugFault === 'heat'}">Density</button></div></div>` +
    `<label class="v2-field">Opacity · <span id="v2opacitylabel">${V2.overlayOpacity}%</span><input data-v2opacity type="range" min="15" max="100" step="5" value="${V2.overlayOpacity}"></label><div class="v2-actions">${v2Button('layers-clear', 'Switch all underground off')}</div><div class="v2-divide"></div>`
  );
}
// Full pages that open inside a tab (with a Back button), instead of a separate Tools tab
const HOSTS = {
  detail: ['explore', 'Full record'],
  lab: ['analyze', 'Is it unusual?'],
  data: ['saved', 'Import & data sources'],
};
export function v2Render() {
  const tools = !!V2.host,
    home = !V2.tab && !tools;
  $('#app').classList.toggle('v2-tools', tools);
  $('#app').classList.toggle('v2-home', home); // map only: the panel is closed
  $('#app').classList.toggle('v2-analyze', V2.tab === 'analyze');
  $('#v2tools').hidden = home;
  if (!home) {
    const par = v2Parent();
    $('#v2hostback').textContent = par ? '← ' + V2TITLE(par, true) : '✕ Close';
    $('#v2hostback').setAttribute('aria-label', par ? 'Back to ' + V2TITLE(par, true) : 'Close the panel');
    $('#v2hosttitle').textContent = tools ? HOSTS[V2.host][1] : V2TITLE(V2.tab);
  }
  $('#v2-draw').hidden = S.mode !== 'draw'; // only needed on the map while freehand drawing
  $('#v2cta').hidden = !home || S.mode === 'draw' || !!activeLine();
  $('#v2layers').hidden = !V2.layersOpen;
  if (V2.layersOpen) {
    $('#v2layers-top').innerHTML = v2LayersHtml();
    renderLayers();
  }
  v2Alert();
  const h = $('#v2hint');
  h.hidden = S.mode !== 'draw';
  if (!h.hidden)
    h.innerHTML = `<strong>${V2.drawPoints.length ? 'Point A set' : 'Freehand'}</strong> · ${V2.drawPoints.length ? 'tap point B' : 'tap point A, then B'}`;
  if (tools || home) return;
  const panes = { explore: v2Explore, draw: v2Draw, analyze: v2Analyze, saved: v2Saved, menu: v2Menu },
    pnl = $('#v2panel'),
    sc = pnl.scrollTop,
    same = pnl.dataset.tab === V2.tab;
  pnl.innerHTML = panes[V2.tab]();
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
    analyze: short ? 'Details' : 'Along this line',
    saved: 'My lines',
    menu: 'Menu',
  })[t] || '';
function v2Parent() {
  if (V2.host) return V2.tab;
  if (V2.tab === 'analyze') return S.work ? 'draw' : null;
  if (V2.tab === 'saved') return 'menu';
  return null;
}
export function v2Back() {
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
  V2.host = null;
  V2.tab = null;
  V2.layersOpen = false;
  if (S.mode === 'draw') {
    setMode(null);
    V2.drawPoints = [];
  }
  v2Render();
  req();
}
export function v2ChangeTab(t) {
  if (!t) {
    v2Home();
    return;
  }
  V2.host = null;
  V2.tab = HOSTS[t] ? HOSTS[t][0] : t;
  V2.layersOpen = false;
  v2Render();
  $('#v2panel').scrollTop = 0;
  if ($('#sheet').classList.contains('peek')) setSheet('half');
}
function v2OpenHost(h) {
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
}
export function v2CloseHost() {
  V2.host = null;
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
// Saving files: inside claude.ai the page asks the viewer to confirm a real download; opened as a file in a
// browser it downloads directly; only if neither works does it fall back to a box you can copy from.
let DLNS;
const dlNs = () =>
  DLNS ||
  (DLNS =
    window.claude && typeof window.claude.use === 'function'
      ? window.claude.use('downloads').catch(() => null)
      : Promise.resolve(null));
async function v2Download(name, data, type = 'application/json') {
  const asText = () =>
    typeof data === 'string'
      ? openText(name + ' (copy and save as a file)', data)
      : toast('Saving is not available in this view');
  const dl = await dlNs();
  if (dl) {
    try {
      await dl.save({ filename: name, data });
      toast('Saved ' + name);
      return;
    } catch (e) {
      const k = e && e.code;
      if (k === 'declined') {
        toast('Not saved');
        return;
      }
      if (k === 'rate_limited') {
        toast('A save is already waiting for your answer');
        return;
      }
      if (k === 'too_large') {
        toast('That file is too large to save here');
        return;
      } /* anything else: try the plain way */
    }
  }
  let framed = true;
  try {
    framed = window.self !== window.top;
  } catch (e) {}
  if (framed && !dl) {
    asText();
    return;
  }
  try {
    const blob = data instanceof Blob ? data : new Blob([data], { type }),
      url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    toast('Downloaded ' + name);
  } catch (e) {
    asText();
  }
}
function v2SaveMapPicture() {
  try {
    draw();
    cv.toBlob(b => {
      if (b) v2Download('ley-atlas-map.png', b, 'image/png');
      else toast('Could not make a picture of the map');
    }, 'image/png');
  } catch (e) {
    toast('The satellite layer blocks map pictures. Switch satellite off and try again.');
  }
}
function v2RestoreBackup() {
  openHtml(
    'Restore a backup',
    '<p class="small">Choose a backup file, or paste its contents. Lines with the same id are replaced; nothing else is deleted.</p><label class="btn primary filebtn">Choose file<input type="file" id="rb-file" accept=".json,application/json,text/plain" hidden></label><textarea id="rb-text" rows="5" placeholder="Paste the backup here"></textarea><button class="btn" id="rb-go">Restore</button><p class="small" id="rb-msg"></p>',
  );
  const run = txt => {
    try {
      const j = JSON.parse(txt);
      const code = j.state || txt.trim();
      loadState(code);
      V2.disc = null;
      V2.tab = 'saved';
      $('#modal').hidden = true;
      v2Render();
      toast('Backup restored');
    } catch (e) {
      $('#rb-msg').textContent = 'That file could not be read as a Ley Atlas backup.';
    }
  };
  $('#rb-file').onchange = e => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => run(String(r.result));
    r.readAsText(f);
  };
  $('#rb-go').onclick = () => run($('#rb-text').value);
}
export function v2HandleAction(action, id) {
  switch (action) {
    case 'done':
      v2Done();
      break;
    case 'pick-a':
      v2OpenBrowser('a', !V2.pick.b);
      break;
    case 'pick-b':
      v2OpenBrowser('b');
      break;
    case 'swap': {
      v2SyncPick();
      const { a, b } = V2.pick;
      V2.pick = { a: b, b: a };
      if (a && b) v2ConnectSites(b, a, S.work?.len == null && !!S.work?.sites);
      else if (S.work && !S.work.sites) {
        const e = v2Ends(S.work);
        v2ApplyEnds([e[1], e[0]], S.work.name, S.work.len == null);
      }
      v2Render();
      break;
    }
    case 'site-a':
      if (S.sel?.type === 'site') v2SetPoint('a', S.sel.id);
      break;
    case 'site-b':
      if (S.sel?.type === 'site') v2SetPoint('b', S.sel.id);
      break;
    case 'site-full':
      v2OpenHost('detail');
      break;
    case 'menu-lines':
      v2ChangeTab('saved');
      break;
    case 'menu-layers':
      V2.tab = null;
      V2.host = null;
      V2.layersOpen = true;
      v2Render();
      break;
    case 'site-line': {
      const id = S.sel?.id;
      if (id && V2.pick.a && V2.pick.a !== id) {
        v2SetPoint('b', id);
        lmMarkPicked();
      }
      break;
    }
    case 'pick-best':
      v2OpenBrowser('b');
      break;
    case 'site-restart': {
      const id = S.sel?.id;
      if (!id) break;
      V2.picking = true;
      V2.pick = { a: id, b: null };
      S.sel = null;
      V2.hl = null;
      V2.prevCam = null;
      V2.tab = 'draw';
      v2Render();
      req();
      toast('Now choose where the line goes');
      setTimeout(() => v2OpenBrowser('b'), 60);
      break;
    }
    case 'sites-all':
      V2.allSites = !V2.allSites;
      v2Render();
      break;
    case 'pick-from':
      v2OpenBrowser('from');
      break;
    case 'bearing-go':
      v2DrawBearing();
      break;
    case 'more':
      V2.limit += 60;
      v2Render();
      break;
    case 'draw-start':
      v2StartDraw();
      break;
    case 'cancel-draw':
      setMode(null);
      V2.drawPoints = [];
      V2.hover = null;
      v2Render();
      req();
      break;
    case 'redraw':
      v2StartDraw(true);
      break;
    case 'new-line':
      V2.editId = null;
      V2.picking = true;
      V2.pick = { a: null, b: null };
      V2.disc = null;
      v2ChangeTab('draw');
      v2OpenBrowser('a', true);
      break;
    case 'tab-draw':
      v2ChangeTab('draw');
      break;
    case 'layers':
      V2.layersOpen = !V2.layersOpen;
      v2Render();
      break;
    case 'layers-close':
      V2.layersOpen = false;
      v2Render();
      break;
    case 'layers-clear':
      for (const k of Object.keys(S.under)) S.under[k] = false;
      v2Persist();
      v2Render();
      renderKey();
      req();
      break;
    case 'focus':
      setFocus(!S.focus);
      v2Render();
      break;
    case 'satellite':
      if (S.satFailed) {
        toast('Satellite tiles are blocked here. Open the HTML file in Chrome to use them.');
        break;
      }
      S.layers.sat = !S.layers.sat;
      if (S.layers.sat) setView('map');
      v2Render();
      req();
      break;
    case 'analyze':
      v2ChangeTab('analyze');
      break;
    case 'choose-line':
      openLinePicker();
      break;
    case 'share':
      shareCurrent();
      break;
    case 'follow':
      if (!activeLine()) break;
      startFollow();
      break;
    case 'tool-lab':
      v2OpenHost('lab');
      break;
    case 'tool-data':
      v2OpenHost('data');
      break;
    case 'save-work':
      v2SaveWork();
      break;
    case 'discard':
      confirmBox('Remove the working line from the map?', 'Remove', () => {
        S.work = null;
        V2.editId = null;
        V2.pick = { a: null, b: null };
        S.active = S.userLines[S.userLines.length - 1]?.id || null;
        changed();
        V2.disc = null;
        $('#v2alert').hidden = true;
        V2.tab = 'draw';
        v2Render();
      });
      break;
    case 'open-saved':
      setActive(id);
      V2.disc = null;
      v2LineChanged();
      V2.tab = 'analyze';
      v2Render();
      flyToLine(activeLine());
      break;
    case 'edit-saved': {
      const u = S.userLines.find(l => l.id === id);
      if (!u) return;
      S.work = { ...stripF(u) };
      S.work.v2ends = v2Ends(u);
      V2.editId = id;
      S.active = 'work';
      S.focus = true;
      changed();
      v2LineChanged();
      V2.tab = 'draw';
      v2Render();
      setSheet('half');
      flyToLine(activeLine());
      break;
    }
    case 'delete-saved': {
      const i = S.userLines.findIndex(l => l.id === id);
      if (i < 0) return;
      const u = S.userLines[i],
        wasActive = S.active === id,
        tab = V2.tab;
      S.userLines.splice(i, 1);
      if (wasActive) S.active = null;
      changed();
      V2.disc = null;
      if (V2.tab === 'analyze' && wasActive) V2.tab = 'saved';
      v2Render();
      toastUndo(`Deleted “${u.name || 'line'}”`, () => {
        S.userLines.splice(Math.min(i, S.userLines.length), 0, u);
        if (wasActive) S.active = id;
        changed();
        V2.disc = null;
        V2.tab = tab;
        v2Render();
        req();
      });
      break;
    }
    case 'delete-import': {
      const i = S.imports.findIndex(x => x.id === id);
      if (i < 0) return;
      const im = S.imports[i];
      S.imports.splice(i, 1);
      persistImports();
      rebuildPoints();
      changed();
      toastUndo(`Removed “${im.name}”`, () => {
        S.imports.splice(Math.min(i, S.imports.length), 0, im);
        persistImports();
        rebuildPoints();
        changed();
      });
      break;
    }
    case 'export-backup':
      v2Download(
        'ley-atlas-backup.json',
        JSON.stringify(
          { format: 'ley-atlas-v2', exported: new Date().toISOString(), state: stateCode() },
          null,
          2,
        ),
      );
      break;
    case 'import-backup':
      v2RestoreBackup();
      break;
    case 'export-geo':
      v2Download('ley-atlas-lines-geojson.json', JSON.stringify(geojson(), null, 2), 'application/geo+json');
      break;
    case 'export-csv':
      if (!activeLine()) {
        toast('Open or draw a line first: the table lists every site with its distance from the line');
        break;
      }
      v2Download('ley-atlas-sites-along-line.csv', csv(), 'text/csv');
      break;
    case 'export-png':
      v2SaveMapPicture();
      break;
  }
}

export function initPanels() {
  $('#v2hostback').onclick = v2Back;
  addEventListener('popstate', () => {
    if (V2.hist) {
      V2.hist = false;
      if (S.sel || V2.hl) v2Done(true);
    }
  });
}
