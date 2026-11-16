// Menu, My lines and the quick map-layer settings
import { v2Button, v2Peek, v2SwipeRow } from '../panel-parts.js';
import { S } from '../../state/state.js';
import { esc } from '../../core/util.js';
import { V2 } from '../../state/preferences.js';
import { C } from '../../render/palette.js';
import { fmtKm } from '../../core/format.js';
import { ZOOM_MODES } from '../../map/zoom-modes.js';

export function v2Menu() {
  const row = (act, ic, t, sub) =>
    `<button class="v2-menurow" data-v2="${act}"><span class="ic" aria-hidden="true">${ic}</span><span class="nm"><strong>${t}</strong><small>${sub}</small></span><span aria-hidden="true">›</span></button>`;
  return (
    v2Peek('Menu') +
    row(
      'menu-lines',
      '▤',
      'My lines',
      `${S.userLines.length} saved${S.work ? ' · 1 not saved yet' : ''} · backup and export`,
    ) +
    row('menu-layers', '◧', 'Map layers', 'What shows on the map: site types, minerals, faults, lines') +
    row('tools', '◈', 'Research tools', 'Star fort lab, Is it unusual? and more') +
    row(
      'tool-data',
      '⇪',
      'Add sites & data sources',
      'Import your own list; where every dataset comes from',
    ) +
    `<p class="v2-muted" style="margin:14px 2px 0">Ley Atlas ${__APP_VERSION__}</p>`
  );
}
export function v2Saved() {
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
    v2Peek(
      `${lines.length} saved line${lines.length !== 1 ? 's' : ''}${S.work ? ' · 1 not saved yet' : ''}`,
    ) +
    (S.work
      ? `<div class="v2-card accent"><div class="v2-row"><h3>Not saved yet</h3><span class="v2-label">1</span></div>` +
        `<button class="v2-lrow" data-v2="open-work"><span class="v2-swatch" style="background:${V2.lineColor || C.cyan}"></span><span class="v2-description"><strong>${esc(S.work.name || 'Untitled line')}</strong><small>The line you drew last. It is only kept until you draw another.</small></span><span aria-hidden="true">›</span></button>` +
        `<div class="v2-actions">${v2Button('save-work', 'Save line', 'primary')}${v2Button('discard', 'Remove', 'danger')}</div></div>`
      : '') +
    `<p class="v2-sub" style="margin:0 0 10px">Kept in this browser. Make a backup to keep them safe or move them to another device.</p>` +
    `<div class="v2-card"><div class="v2-row"><h3>Saved lines</h3><span class="v2-label">${lines.length}</span></div>${list ? list + '<p class="v2-muted" style="margin:8px 0 0">Tap a line to open it. Swipe it left to delete.</p>' : '<div class="v2-empty">No saved lines yet. Draw a line, then tap Save line.</div>'}<div class="v2-actions">${v2Button('new-line', '＋ New line', 'primary')}${S.work ? v2Button('tab-draw', 'Finish the working line') : ''}</div></div>` +
    `<div class="v2-card"><h3>Backup and export</h3><p class="v2-sub">A backup holds your lines, markers, imports and settings.</p><div class="v2-actions">${v2Button('export-backup', 'Save a backup', 'primary')}${v2Button('import-backup', 'Restore a backup')}</div><div class="v2-kicker" style="margin-top:10px">Export</div><div class="v2-actions">${v2Button('export-geo', 'Lines (GeoJSON)')}${v2Button('export-csv', 'Sites along the line (CSV)')}${v2Button('export-png', 'Map picture')}</div></div>` +
    `<div class="v2-card soft"><h3>Line style</h3><label class="v2-feature"><span class="v2-description"><strong>Discovery glow</strong><small>Gold = minerals, coral = faults, purple = both, teal = historic sites only</small></span><input type="checkbox" data-pref="glow" ${V2.glow ? 'checked' : ''}></label><div class="v2-field">Your line colour<div class="v2-swatches">${[null, '#0b6fc9', '#c62a1d', '#1d8a4b', '#7b3fd0', '#111111', '#ffffff'].map(c => `<button data-linecol="${c || ''}" aria-pressed="${(V2.lineColor || null) === c}" style="background:${c || C.cyan}" aria-label="${c ? 'Colour ' + c : 'Default teal'}"></button>`).join('')}</div></div></div>`
  );
}
export function v2LayersHtml() {
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
