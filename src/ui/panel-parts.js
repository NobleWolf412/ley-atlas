// Small HTML builders shared by the panel screens
import { esc } from '../core/util.js';
import { findPoint } from '../domain/points.js';
import { siteIcon } from '../render/icons.js';
import { TYPENAME } from '../domain/site-types.js';
import { CORRIDORS } from '../state/preferences.js';
import { S } from '../state/state.js';

// ---------- panels ----------
export function v2ButtonId(action, id, label, cls = '') {
  return `<button class="v2-action ${cls}" data-v2="${action}" data-id="${esc(id)}">${label}</button>`;
}
// rows you can swipe left to reveal Delete (or swipe all the way to delete); the action still offers Undo
export function v2SwipeRow(action, id, name, inner) {
  return `<div class="v2-swipe"><button class="v2-swipe-del" data-v2="${action}" data-id="${esc(id)}" tabindex="-1" aria-label="Delete ${esc(name)}">Delete</button><div class="v2-swipe-row" data-swipe="${action}" data-id="${esc(id)}">${inner}</div></div>`;
}
export function v2Button(action, label, cls = '') {
  return `<button class="v2-action ${cls}" data-v2="${action}">${label}</button>`;
}
export function v2Peek(text) {
  return `<div class="v2-peek"><span>${text}</span><span aria-hidden="true">⌃ Expand</span></div>`;
}
export function v2PointBtn(which, id) {
  const p = id && findPoint(id);
  return `<button class="v2-pt ${p ? '' : 'empty'}" data-v2="pick-${which}"><span class="tag">${which === 'from' ? '↗' : which.toUpperCase()}</span>${p ? siteIcon(p) : ''}<span class="nm"><strong>${p ? esc(p.n) : which === 'a' ? 'Choose the first site' : which === 'from' ? 'Choose the site to start from' : 'Choose the second site'}</strong><small>${p ? (p.set === 'roman' ? esc(p.reg) : esc(TYPENAME[p.cat] || '') + (p.reg ? ' · ' + esc(p.reg) : '')) : 'Castles, forts, temples, stones…'}</small></span><svg width="14" height="14" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg></button>`;
}
export function v2CorridorChips() {
  return `<div class="v2-actions" role="group" aria-label="Search corridor">${CORRIDORS.map(n => `<button class="v2-action ${Math.abs(S.corridorKm - n) < 1e-9 ? 'primary' : ''}" data-width="${n}">±${n} km</button>`).join('')}</div>`;
}
export function v2Find(attrs, title, sub, right) {
  return `<button class="v2-find" ${attrs}><span class="nm"><strong>${title}</strong><small>${sub}</small></span><span class="km">${right}</span></button>`;
}
