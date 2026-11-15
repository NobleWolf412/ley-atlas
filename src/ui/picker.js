// Searchable site and line picker
import { $, $$, esc, nf } from '../core/util.js';
import { CLASSES } from '../data/catalog.js';
import { CASE_STUDIES } from '../domain/case-studies.js';
import { LINEBY, LINES } from '../domain/lines.js';
import { flyToLine } from '../map/camera.js';
import { setActive } from '../panels/lines-pane.js';
import { S } from '../state/state.js';
import { lineSw } from './map-chrome.js';

// ================= searchable picker =================
let PK = null;
function openPicker(o) {
  PK = { q: '', chip: o.chips ? o.chips[0][0] : null, ...o };
  $('#picktitle').textContent = o.title;
  $('#pickq').value = '';
  $('#pickq').placeholder = o.placeholder || 'Type to search';
  $('#pickchips').innerHTML = o.chips
    ? o.chips
        .map(
          ([k, l]) =>
            `<button class="chip" data-k="${esc(k)}" aria-pressed="${k === PK.chip}">${esc(l)}</button>`,
        )
        .join('')
    : '';
  $('#pickchips').hidden = !o.chips;
  $$('#pickchips .chip').forEach(
    b =>
      (b.onclick = () => {
        PK.chip = b.dataset.k;
        $$('#pickchips .chip').forEach(x => x.setAttribute('aria-pressed', x === b));
        renderPicker();
      }),
  );
  $('#picker').hidden = false;
  renderPicker();
  setTimeout(() => {
    if (innerWidth >= 700) $('#pickq').focus();
  }, 50);
}
function closePicker() {
  $('#picker').hidden = true;
  PK = null;
}
function renderPicker() {
  if (!PK) return;
  const words = PK.q.toLowerCase().split(/\s+/).filter(Boolean);
  let items = PK.items.filter(
    it => (!PK.chip || PK.chip === 'all' || it.c === PK.chip) && words.every(w => it.k.includes(w)),
  );
  const groups = new Map();
  for (const g of PK.order || []) groups.set(g, []);
  for (const it of items) {
    if (!groups.has(it.g)) groups.set(it.g, []);
    groups.get(it.g).push(it);
  }
  const cap = words.length ? 60 : PK.cap || 40;
  let html = '';
  for (const [g, arr] of groups) {
    if (!arr.length) continue;
    if (!PK.keepOrder)
      arr.sort((a, b) =>
        a.label.localeCompare(b.label, 'en', { sensitivity: 'base', ignorePunctuation: true, numeric: true }),
      );
    html += `<div class="letter">${esc(g)} <span style="color:var(--muted);font-weight:500">· ${nf(arr.length)}</span></div>`;
    html += arr
      .slice(0, cap)
      .map(
        it =>
          `<button class="si ${it.id === PK.current ? 'cur' : ''}" data-id="${esc(it.id)}">${it.icon || '<span></span>'}<span class="nm"><b>${esc(it.label)}</b>${it.sub ? `<span>${esc(it.sub)}</span>` : ''}</span><span class="d">${it.right || ''}</span></button>`,
      )
      .join('');
    if (arr.length > cap)
      html += `<p class="small" style="padding:6px 4px">${nf(arr.length - cap)} more in ${esc(g)}. Type to narrow the list.</p>`;
  }
  $('#pickbody').innerHTML = html || `<p class="empty">Nothing matches “${esc(PK.q)}”.</p>`;
  $$('#pickbody [data-id]').forEach(
    b =>
      (b.onclick = () => {
        const f = PK.onPick,
          id = b.dataset.id;
        closePicker();
        f(id);
      }),
  );
}
const LINE_ORDER = () => [
  ...CASE_STUDIES.map(c => 'Case study: ' + c.title),
  'Your lines',
  'Published claims',
  'Documented alignments',
];
export function openLinePicker() {
  const items = LINES.map(l => ({
    id: l.id,
    label: l.short || l.name,
    sub: `${CLASSES[l.cls]} · ${l.segs.length > 1 ? 'path' : l.segs[0].brg.toFixed(1) + '°'}${S.layers[l.layer] ? '' : ' · layer off'}`,
    g: l.cat,
    k: (l.name + ' ' + l.cat).toLowerCase(),
    icon: lineSw(l, 20, 12),
  }));
  openPicker({
    title: 'Line on the map',
    items,
    order: LINE_ORDER(),
    current: S.active,
    onPick: id => {
      setActive(id);
      flyToLine(LINEBY[id]);
    },
    placeholder: 'Search lines',
    keepOrder: false,
    cap: 80,
  });
}

export function initPicker() {
  $('#pickq').oninput = e => {
    if (!PK) return;
    PK.q = e.target.value;
    clearTimeout(renderPicker._t);
    renderPicker._t = setTimeout(renderPicker, 90);
  };
  $('#pickq').onkeydown = e => {
    if (e.key === 'Enter') {
      const b = $('#pickbody [data-id]');
      if (b) b.click();
    }
  };
  $('#pickclose').onclick = closePicker;
  $('#picker').onclick = e => {
    if (e.target.id === 'picker') closePicker();
  };
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (!$('#picker').hidden) {
        closePicker();
        e.preventDefault();
      } else if (!$('#modal').hidden) {
        $('#modal').hidden = true;
        e.preventDefault();
      }
    }
  });
}
