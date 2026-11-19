// Map chrome: line chip and key
import { $, esc } from '../core/util.js';
import { INTS } from '../domain/analysis.js';
import { LINES, activeLine, lineShown } from '../domain/lines.js';
import { ALLP, srcOn } from '../domain/points.js';
import { TYPESHORT } from '../domain/site-types.js';
import { UG } from '../domain/underground.js';
import { sw } from '../render/icons.js';
import { iconSvg } from '../render/icons.js';
import { C, STY } from '../render/palette.js';
import { KEYK, S } from '../state/state.js';
import { V2 } from '../state/preferences.js';
import { toast } from './intro.js';
import { openLinePicker } from './picker.js';
import { changed } from './sheet.js';

// ================= map chrome: line chip + key =================
export function lineSw(l, w = 30, h = 12) {
  const base = STY[l.style];
  const st = ['work', 'user'].includes(l.style) ? { ...base, c: V2.lineColor || C.cyan } : base;
  return `<svg class="sw" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><line x1="2" y1="${h / 2}" x2="${w - 2}" y2="${h / 2}" stroke="${st.c}" stroke-width="${Math.max(2, st.w)}" stroke-dasharray="${st.dash.join(' ')}" stroke-linecap="round"/></svg>`;
}
export function renderChrome() {
  const L = activeLine(),
    chip = $('#linechip');
  if (L && !S.intro && $('#callout').hidden && !S.mode) {
    chip.hidden = false;
    chip.innerHTML = `<button class="pick" id="lc-pick" aria-label="Line on the map: ${esc(L.short || L.name)}. Choose another">${lineSw(L, 24, 12)}<span class="nm">${esc(L.short || L.name)}</span><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg></button><button class="mode" id="lc-mode" aria-pressed="${S.focus}" title="${S.focus ? 'Showing only this line. Tap to show all enabled lines.' : 'Showing all enabled lines. Tap to show only this one.'}">${S.focus ? 'Only this' : 'All lines'}</button>`;
    $('#lc-pick').onclick = openLinePicker;
    $('#lc-mode').onclick = () => setFocus(!S.focus);
  } else chip.hidden = true;
  renderKey();
}
export function renderKey() {
  const k = $('#key'),
    kb = $('#keybtn');
  kb.setAttribute('aria-expanded', String(S.keyOpen));
  if (!S.keyOpen) {
    k.hidden = true;
    kb.hidden = false;
    placeAbove();
    return;
  }
  kb.hidden = true;
  k.hidden = false;
  const entry = (icon, label) => `<span class="legend-item">${icon}<span>${esc(label)}</span></span>`;
  const shownLines = LINES.filter(lineShown);
  const styles = [...new Map(shownLines.map(l => [l.style, l])).values()];
  const lineItems = styles.map(l =>
    entry(
      lineSw(l, 22, 10),
      styles.length === 1
        ? l.short || l.name
        : {
            primary: 'Case study',
            bestfit: 'Best fit',
            esoteric: 'Published claim',
            esofit: 'Claim best fit',
            documented: 'Documented',
            work: 'Working line',
            user: 'Saved line',
          }[l.style] ||
            l.short ||
            l.name,
    ),
  );
  // Dataset-specific symbols override category symbols on the map.
  const symbols = new Map();
  for (const p of ALLP) {
    if (!S.layers.cat[p.cat] || !srcOn(p)) continue;
    const special = ['roman', 'pleiades', 'unesco', 'marker'].includes(p.set);
    const id = special ? p.set : p.cat;
    if (!symbols.has(id))
      symbols.set(id, {
        p,
        label: special
          ? {
              roman: 'Roman sites',
              pleiades: 'Pleiades sites',
              unesco: 'UNESCO sites',
              marker: 'Your markers',
            }[id]
          : TYPESHORT[p.cat] || p.cat,
      });
  }
  const types = [...symbols.values()].map(({ p, label }) =>
    entry(`<svg viewBox="-9 -9 18 18" aria-hidden="true">${iconSvg(p)}</svg>`, label),
  );
  const minerals = UG.filter(([id]) => S.under[id]);
  const ugi = minerals.map(([id, label]) =>
    entry(
      V2.ugDep === 'heat'
        ? `<i class="legend-density" style="--legend-colour:${C.dep[id]}"></i>`
        : `<svg viewBox="-9 -9 18 18" aria-hidden="true"><polygon points="0,-6 6,0 0,6 -6,0" fill="${C.dep[id]}"/></svg>`,
      label,
    ),
  );
  if (S.under.faults)
    ugi.push(
      entry(
        V2.ugFault === 'heat'
          ? `<i class="legend-density" style="--legend-colour:${C.fault}"></i>`
          : sw('faults'),
        'Active faults',
      ),
    );
  if (S.under.plates) ugi.push(entry(sw('plates'), 'Plate boundaries'));
  if (S.under.mag) ugi.push(entry('<i class="magkey"></i>', 'Magnetic field: blue weaker · red stronger'));
  if (S.layers.stonework) types.push(entry(sw('stonework'), 'Precision stonework'));
  if (S.layers.duff && !S.focus) lineItems.push(entry(sw('duff'), 'Claimed crossing (Rory Duff)'));
  if (INTS.length && S.layers.intersections) lineItems.push(entry(sw('intersections'), 'Line crossings'));
  if (shownLines.length && V2.glow)
    lineItems.push(
      entry('<i class="legend-glow" style="background:var(--glow-min)"></i>', 'Finding: minerals'),
      entry('<i class="legend-glow" style="background:var(--glow-fault)"></i>', 'Finding: faults'),
      entry('<i class="legend-glow" style="background:var(--glow-both)"></i>', 'Finding: both'),
      entry('<i class="legend-glow" style="background:var(--glow-site)"></i>', 'Finding: historic sites'),
    );
  const section = (title, items) =>
    items.length
      ? `<div class="legend-section"><h3>${title}</h3><div class="legend-items">${items.join('')}</div></div>`
      : '';
  const symbolsOpen = k.querySelector('[data-legend-symbols]')?.open ?? !ugi.length;
  k.innerHTML =
    `<div class="legend-head"><strong>Legend <small>Enabled layers</small></strong><button id="keyhide" aria-label="Collapse legend">−</button></div><div class="legend-body">` +
    section('Underground', ugi) +
    (minerals.length || (S.under.faults && V2.ugFault === 'heat')
      ? `<p class="legend-note">${V2.ugDep === 'heat' || (S.under.faults && V2.ugFault === 'heat') ? 'Density: darker patches mean more mapped records, not mineral concentration.' : 'Deposits are squares or diamonds as you zoom. One deposit may contain several minerals.'}</p>`
      : '') +
    (types.length || lineItems.length
      ? `<details data-legend-symbols ${symbolsOpen ? 'open' : ''}><summary>Sites & lines</summary>${section('Sites', types)}${section('Lines & findings', lineItems)}</details>`
      : '') +
    (!ugi.length && !types.length && !lineItems.length
      ? '<p class="legend-note">No site, line or underground layers enabled.</p>'
      : '') +
    '</div>';
  $('#keyhide').onclick = () => {
    S.keyOpen = false;
    try {
      localStorage.setItem(KEYK, '0');
    } catch (e) {}
    renderKey();
    kb.focus({ preventScroll: true });
  };
  placeAbove();
}
export function placeAbove() {
  const k = $('#key'),
    kb = $('#keybtn'),
    h = !k.hidden ? k.offsetHeight : !kb.hidden ? kb.offsetHeight : 0;
  $('#mapwrap').style.setProperty('--above', 44 + h + 12 + 'px');
}
export function setFocus(on) {
  S.focus = on;
  changed();
  toast(on ? 'Showing only the line you picked' : 'Showing every enabled line');
}

export function initMapChrome() {
  $('#keybtn').onclick = () => {
    S.keyOpen = true;
    try {
      localStorage.setItem(KEYK, '1');
    } catch (e) {}
    renderKey();
    $('#keyhide')?.focus({ preventScroll: true });
  };
}
