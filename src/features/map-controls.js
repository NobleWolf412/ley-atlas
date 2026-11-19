// Live layer switches that leave the map available for comparison and panning.
import { $, esc } from '../core/util.js';
import { on } from '../core/events.js';
import { LINES, activeLine } from '../domain/lines.js';
import { SOURCES, TYPES } from '../domain/site-types.js';
import { UG } from '../domain/underground.js';
import { sw } from '../render/icons.js';
import { S, persistImports } from '../state/state.js';
import { V2, v2Persist } from '../state/preferences.js';
import { setView } from '../map/interaction.js';
import { req } from '../map/draw.js';
import { registerAction } from '../ui/registry.js';
import { v2Home } from '../ui/panels.js';
import { changed } from '../ui/sheet.js';

let openGroup = 'underground';
const MAP_LAYERS = [
  ['labels', 'Site labels', 'label'],
  ['places', 'Cities & towns', 'places'],
  ['rivers', 'Rivers', 'river'],
  ['borders', 'Country borders', 'border'],
  ['sat', 'Satellite imagery', 'sat'],
  ['outlines', 'Fort outlines', 'outline'],
  ['stonework', 'Precision stonework', 'stonework'],
  ['corridor', 'Line corridor', 'corridor'],
  ['intersections', 'Line crossings', 'intersections'],
];

function toggle(kind, id, title, on, icon = '', disabled = false) {
  return `<button class="map-layer-row" data-map-toggle="${kind}:${esc(id)}" role="switch" aria-checked="${!!on}" ${disabled ? 'disabled' : ''}><span class="map-layer-icon" aria-hidden="true">${icon}</span><span>${esc(title)}</span><i class="tog" aria-hidden="true"></i></button>`;
}
function group(id, title, count, body) {
  return `<details data-map-group="${id}" ${openGroup === id ? 'open' : ''}><summary>${title}<small>${count}</small></summary><div class="map-layer-group-body">${body}</div></details>`;
}
function styleButtons(key, label, choices) {
  return `<div class="map-layer-style"><span>${label}</span><div class="seg" role="group" aria-label="${label}">${choices.map(([id, title]) => `<button data-map-style="${key}:${id}" aria-pressed="${V2[key] === id}">${title}</button>`).join('')}</div></div>`;
}

export function renderMapControls() {
  const root = $('#map-layer-body');
  if (!root || $('#map-layer-popover').hidden) return;
  const scroll = root.scrollTop;
  const expanded = root.querySelector('[data-map-group][open]');
  if (expanded) openGroup = expanded.dataset.mapGroup;
  const focus = root.contains(document.activeElement) ? document.activeElement : null;
  const focusKey = focus?.dataset.mapToggle || focus?.dataset.mapStyle;
  const lines = LINES.filter(l => l.layer !== 'user');
  const layersOn = lines.filter(l => S.layers[l.layer]).length;
  const underOn = Object.values(S.under).filter(Boolean).length;
  root.innerHTML =
    group(
      'sites',
      'Sites',
      `${TYPES.filter(([id]) => S.layers.cat[id]).length} types on`,
      `<div class="map-layer-bulk"><button class="btn" data-map-bulk="sites-on">All on</button><button class="btn" data-map-bulk="sites-off">All off</button></div>` +
        TYPES.map(([id, title]) => toggle('cat', id, title, S.layers.cat[id], sw(id))).join('') +
        `<details class="map-layer-sources"><summary>Datasets & imports</summary><p class="small">A site needs both its type and its dataset switched on.</p>${Object.entries(
          SOURCES,
        )
          .map(([id, s]) => toggle('src', id, s.label, S.src[id]))
          .join(
            '',
          )}${S.imports.map(im => toggle('import', im.id, im.name, im.on, sw('import'))).join('')}</details>`,
    ) +
    group(
      'underground',
      'Underground',
      `${underOn} on`,
      `<p class="small">Recorded deposits, mines and Earth structure. Coverage varies; a blank area can mean no records.</p><div class="map-layer-bulk"><button class="btn" data-map-bulk="under-off">All off</button></div>` +
        UG.map(([id, title]) => toggle('under', id, title, S.under[id], sw('ug-' + id))).join('') +
        toggle('under', 'faults', 'Active faults', S.under.faults, sw('faults')) +
        toggle('under', 'plates', 'Plate boundaries', S.under.plates, sw('plates')) +
        toggle('under', 'mag', 'Magnetic field', S.under.mag, '<i class="magkey"></i>') +
        styleButtons('ugDep', 'Deposits', [
          ['points', 'Points'],
          ['heat', 'Density'],
        ]) +
        styleButtons('ugFault', 'Faults', [
          ['lines', 'Lines'],
          ['heat', 'Density'],
        ]) +
        `<label class="map-layer-opacity">Opacity <output>${V2.overlayOpacity}%</output><input data-map-opacity type="range" min="15" max="100" step="5" value="${V2.overlayOpacity}"></label>`,
    ) +
    group(
      'lines',
      'Lines',
      `${layersOn} examples on`,
      toggle('layer', 'user', 'Working & saved lines', S.layers.user, sw('user')) +
        toggle('focus', 'all', 'Show all enabled lines', !S.focus) +
        `<p class="small">${S.focus ? 'Showing the active line’s group. Enabling another line switches to all enabled lines.' : 'Showing all enabled lines.'} Your working line is kept.</p>` +
        lines.map(l => toggle('layer', l.layer, l.short || l.name, S.layers[l.layer], sw(l.layer))).join('') +
        toggle('layer', 'duff', 'Rory Duff — claimed crossing', S.layers.duff, sw('duff')),
    ) +
    group(
      'map',
      'Map display',
      '',
      MAP_LAYERS.map(([id, title, icon]) =>
        toggle('layer', id, title, S.layers[id], sw(icon), id === 'sat' && S.satFailed),
      ).join('') +
        toggle('pref', 'glow', 'Highlight findings along lines', V2.glow) +
        styleButtons('zoomMode', 'Site density', [
          ['key', 'Key sites'],
          ['all', 'All sites'],
          ['groups', 'Groups'],
          ['heat', 'Density'],
        ]) +
        `<p class="small">Up close, all enabled sites show. The legend describes the enabled layers.</p>`,
    );
  root.querySelectorAll('[data-map-group]').forEach(d => {
    d.ontoggle = () => {
      if (!d.isConnected || !d.open) return;
      openGroup = d.dataset.mapGroup;
      root.querySelectorAll('[data-map-group]').forEach(other => {
        if (other !== d) other.open = false;
      });
    };
  });
  root.scrollTop = scroll;
  if (focusKey)
    [...root.querySelectorAll('[data-map-toggle], [data-map-style]')]
      .find(b => (b.dataset.mapToggle || b.dataset.mapStyle) === focusKey)
      ?.focus({ preventScroll: true });
}

export function closeMapControls(restoreFocus = false) {
  $('#map-layer-popover').hidden = true;
  $('#lyr').setAttribute('aria-expanded', 'false');
  $('#app').classList.remove('map-layers-open');
  if (restoreFocus) $('#lyr').focus({ preventScroll: true });
}

function openMapControls() {
  if (!$('#map-layer-popover').hidden) return closeMapControls(true);
  if (V2.tab || V2.host) v2Home();
  $('#map-layer-popover').hidden = false;
  $('#lyr').setAttribute('aria-expanded', 'true');
  $('#app').classList.add('map-layers-open');
  renderMapControls();
  $('#map-layer-title').focus({ preventScroll: true });
}

function applyToggle(button) {
  const [kind, ...parts] = button.dataset.mapToggle.split(':');
  const id = parts.join(':');
  if (button.disabled) return;
  if (kind === 'cat') S.layers.cat[id] = !S.layers.cat[id];
  else if (kind === 'src') S.src[id] = !S.src[id];
  else if (kind === 'under') S.under[id] = !S.under[id];
  else if (kind === 'pref') V2[id] = !V2[id];
  else if (kind === 'focus') S.focus = !S.focus;
  else if (kind === 'import') {
    const im = S.imports.find(im => im.id === id);
    if (!im) return;
    im.on = !im.on;
    persistImports();
  } else if (kind === 'layer') {
    S.layers[id] = !S.layers[id];
    if (id === 'sat' && S.layers.sat) setView('map');
    if (S.layers[id] && (id === 'duff' || LINES.some(l => l.layer === id && l.group !== activeLine()?.group)))
      S.focus = false;
  }
  changed();
  renderMapControls();
}

export function initMapControls() {
  registerAction('map-layers', openMapControls);
  on('ui:navigate', () => closeMapControls());
  on('ui:screen', () => {
    if (V2.tab || V2.host) closeMapControls();
    else renderMapControls();
  });
  $('#map-layer-close').onclick = () => closeMapControls(true);
  $('#map-layer-popover').addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    closeMapControls(true);
  });
  $('#map-layer-body').addEventListener('click', e => {
    const toggle = e.target.closest('[data-map-toggle]');
    if (toggle) return applyToggle(toggle);
    const bulk = e.target.closest('[data-map-bulk]')?.dataset.mapBulk;
    if (bulk) {
      if (bulk === 'under-off') for (const id of Object.keys(S.under)) S.under[id] = false;
      else for (const id of Object.keys(S.layers.cat)) S.layers.cat[id] = bulk === 'sites-on';
      changed();
      renderMapControls();
    }
    const style = e.target.closest('[data-map-style]')?.dataset.mapStyle;
    if (style) {
      const [key, value] = style.split(':');
      V2[key] = value;
      changed();
      renderMapControls();
    }
  });
  $('#map-layer-body').addEventListener('input', e => {
    if (!e.target.matches('[data-map-opacity]')) return;
    V2.overlayOpacity = +e.target.value;
    e.target.parentElement.querySelector('output').textContent = V2.overlayOpacity + '%';
    // Keep the range input mounted during a drag; redraw and save on each movement.
    v2Persist();
    req();
  });
}
