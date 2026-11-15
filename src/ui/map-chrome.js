// Map chrome: line chip and key
import { $, esc } from '../core/util.js';
import { INTS } from '../domain/analysis.js';
import { LINES, activeLine, lineShown } from '../domain/lines.js';
import { ALLP, srcOn } from '../domain/points.js';
import { TYPES, TYPESHORT } from '../domain/site-types.js';
import { UG } from '../domain/underground.js';
import { sw } from '../render/icons.js';
import { iconSvg } from '../render/icons.js';
import { C, STY } from '../render/palette.js';
import { KEYK, S } from '../state/state.js';
import { toast } from './intro.js';
import { openLinePicker } from './picker.js';
import { changed } from './sheet.js';

// ================= map chrome: line chip + key =================
export function lineSw(l, w = 30, h = 12) {
  const st = STY[l.style];
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
  if (!S.keyOpen) {
    k.hidden = true;
    kb.hidden = false;
    placeAbove();
    return;
  }
  kb.hidden = true;
  k.hidden = false;
  const L = activeLine(),
    shownLines = LINES.filter(lineShown),
    styles = [...new Map(shownLines.map(l => [l.style, l])).values()].slice(0, 4);
  const lineItems = (S.focus && L ? [L] : styles).map(
    l =>
      `<span class="kl">${lineSw(l, 22, 10)}${esc(S.focus || styles.length === 1 ? l.short || l.name : { primary: 'Case study', bestfit: 'Best fit', esoteric: 'Published claim', esofit: 'Claim best fit', documented: 'Documented', work: 'Working line', user: 'Your line' }[l.style])}</span>`,
  );
  const types = TYPES.filter(
    t => S.layers.cat[t[0]] && t[0] !== 'marker' && ALLP.some(p => p.cat === t[0] && srcOn(p)),
  ).map(
    t =>
      `<span><svg viewBox="-9 -9 18 18" aria-hidden="true">${iconSvg({ cat: t[0] })}</svg>${esc(TYPESHORT[t[0]])}</span>`,
  );
  const ugi = [
    ...UG.filter(g => S.under[g[0]]).map(
      g =>
        `<span><svg viewBox="-9 -9 18 18" aria-hidden="true"><polygon points="0,-6 6,0 0,6 -6,0" fill="${C.dep[g[0]]}"/></svg>${esc(g[1])}</span>`,
    ),
    ...(S.under.faults
      ? [
          `<span class="kl">${sw('faults').replace('class="sw"', 'class="sw" width="22" height="10"')}Active fault</span>`,
        ]
      : []),
    ...(S.under.plates
      ? [
          `<span class="kl">${sw('plates').replace('class="sw"', 'class="sw" width="22" height="10"')}Plate boundary</span>`,
        ]
      : []),
    ...(S.under.mag && S.view === 'map'
      ? ['<span><i class="magkey"></i>Magnetic: weaker → stronger</span>']
      : []),
  ];
  k.innerHTML =
    lineItems.join('') +
    types.join('') +
    ugi.join('') +
    (S.layers.stonework
      ? `<span><svg viewBox="-9 -9 18 18" aria-hidden="true"><polygon points="0,-7 7,0 0,7 -7,0" fill="none" stroke="${C.stoneRing}" stroke-width="2"/></svg>Stonework</span>`
      : '') +
    (INTS.length && S.layers.intersections
      ? `<span><svg viewBox="-9 -9 18 18" aria-hidden="true"><circle r="6" fill="none" stroke="${C.red}" stroke-width="2"/></svg>Crossing</span>`
      : '') +
    '<button class="x" id="keyhide" aria-label="Hide key">Hide</button>';
  $('#keyhide').onclick = () => {
    S.keyOpen = false;
    try {
      localStorage.setItem(KEYK, '0');
    } catch (e) {}
    renderKey();
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
  };
}
