import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import { $, esc } from '../core/util.js';
import {
  findImportMatches,
  importSearchIndex,
  prepareImportReview,
  readPastedSites,
  reviewedImportRows,
  pastedCoordinates,
} from '../core/guided-import.js';
import { ALLP } from '../domain/points.js';
import { TOPO_LAND110 } from '../data/datasets.js';
import { S } from '../state/state.js';
import { proj, W, H } from '../map/canvas.js';
import { flyTo } from '../map/camera.js';
import { registerMapTapHandler } from '../ui/map-taps.js';
import { openHtml } from '../panels/data-pane.js';
import { toast } from '../ui/intro.js';

let current = null,
  pin = null,
  registered = false;

function previewMap(rows) {
  if (!rows.length) return '<p class="small">Located sites will appear on the preview map.</p>';
  const land = topojson.feature(TOPO_LAND110, TOPO_LAND110.objects.land);
  const geometry = { type: 'MultiPoint', coordinates: rows.map(r => [r.lon, r.lat]) };
  const polar = rows.some(r => Math.abs(r.lat) >= 85);
  const projection = (polar ? d3.geoNaturalEarth1() : d3.geoMercator()).clipExtent([
    [0, 0],
    [420, 180],
  ]);
  const distinct = new Set(geometry.coordinates.map(c => c.join(','))).size;
  if (polar)
    projection.fitExtent(
      [
        [10, 10],
        [410, 170],
      ],
      land,
    );
  else if (distinct === 1) projection.center(geometry.coordinates[0]).scale(18000).translate([210, 90]);
  else
    projection.fitExtent(
      [
        [45, 30],
        [375, 150],
      ],
      geometry,
    );
  const path = d3.geoPath(projection);
  return `<svg class="import-preview-map" viewBox="0 0 420 180" role="img" aria-label="Preview of ${rows.length} selected site locations"><path d="${path(land) || ''}"/>${rows
    .map((r, i) => {
      const p = projection([r.lon, r.lat]);
      return `<circle cx="${p[0]}" cy="${p[1]}" r="5"><title>${esc(r.n)} · ${r.lat.toFixed(5)}, ${r.lon.toFixed(5)}</title></circle><text x="${p[0] + 8}" y="${p[1] - 7}">${i + 1}</text>`;
    })
    .join('')}</svg>`;
}
function rowHtml(entry, index) {
  const location = entry.location || entry.choice;
  return `<article class="import-review-row" data-review-row="${index}"><div class="import-review-title"><label><input type="checkbox" data-import-select="${index}" ${entry.selected ? 'checked' : ''} ${location ? '' : 'disabled'}><strong>${index + 1}. ${esc(entry.label)}</strong></label><span class="small">${location ? esc(entry.coordinateSource) : entry.invalid ? 'Check coordinates' : 'Location needed'}</span></div>${entry.location ? `<p class="small">${entry.location.lat.toFixed(5)}, ${entry.location.lon.toFixed(5)} · ${esc(entry.coordinateSource)}</p>` : `<label class="import-field">Choose a place<select data-import-choice="${index}" aria-label="Choose a place for ${esc(entry.label)}"><option value="">${entry.candidates.length ? 'Choose an atlas match' : 'No atlas match found'}</option>${entry.candidates.map((p, i) => `<option value="${i}" ${entry.choice?.id === p.id ? 'selected' : ''}>${esc(p.n)}${p.reg ? ' — ' + esc(p.reg) : ''} (${p.lat.toFixed(3)}, ${p.lon.toFixed(3)})</option>`).join('')}</select></label>`}${entry.choice ? `<p class="small">${esc(entry.choice.sourceLabel)} · ${entry.choice.lat.toFixed(5)}, ${entry.choice.lon.toFixed(5)}. Existing atlas site; this import groups it without adding a duplicate point.</p>` : ''}<details class="import-resolve"><summary>${location ? 'Change location' : 'Locate this place'}</summary><label class="import-field">Search the atlas<input type="search" data-import-query="${index}" value="${esc(entry.label)}" autocomplete="off"></label><button class="btn" data-import-search="${index}">Search atlas</button><label class="import-field">Coordinates or a Google Maps link<input type="text" data-import-coords="${index}" placeholder="51.1789, -1.8262" aria-describedby="import-coordinate-help"></label><div class="v2-actions"><button class="btn" data-import-apply="${index}">Use coordinates</button><button class="btn" data-import-pin="${index}">Pin on map</button></div><p class="small" data-import-error="${index}" role="status"></p></details></article>`;
}
function updateSummary() {
  const rows = reviewedImportRows(current.entries),
    located = current.entries.filter(e => e.location || e.choice).length;
  $('#guided-import-summary').textContent =
    `${rows.length} selected · ${current.entries.length - located} need a location`;
  $('#guided-import-map').innerHTML = previewMap(rows);
  $('#im-go').textContent = `Import ${rows.length} selected site${rows.length === 1 ? '' : 's'}`;
  $('#im-go').disabled = !rows.length;
}
function renderReview(focusIndex = null) {
  const rows = reviewedImportRows(current.entries);
  openHtml(
    'Review sites',
    `<div class="guided-import"><p class="import-step">PASTE → <strong>REVIEW</strong> → IMPORT</p><p class="small">Check each location. Uncertain matches stay unselected. Matching uses sites already in the atlas and works offline.</p><div id="guided-import-map">${previewMap(rows)}</div><p id="guided-import-summary" role="status"></p><div class="import-review-list">${current.entries.map(rowHtml).join('')}</div><p id="import-coordinate-help" class="small">Coordinates use latitude, longitude. South and west are negative. Short Maps links need a pin or full coordinates.</p><label class="import-field">Collection name<input type="text" id="im-name" value="${esc(current.name)}" maxlength="100"></label><p class="small">Only selected, located sites will be imported. Repeated selections of the same place are included once. Your pasted list stays on this device.</p><div class="import-review-footer"><button class="btn" id="guided-import-back">Edit pasted list</button><button class="btn primary" id="im-go"></button></div></div>`,
  );
  updateSummary();
  $('#im-name').oninput = e => {
    current.name = e.target.value;
  };
  $('#guided-import-back').onclick = () => current.back(current.text);
  $('#im-go').onclick = () => current.commit(reviewedImportRows(current.entries), current.name);
  $('#modalbody')
    .querySelectorAll('[data-import-select]')
    .forEach(input => {
      input.onchange = () => {
        current.entries[+input.dataset.importSelect].selected = input.checked;
        updateSummary();
      };
    });
  $('#modalbody')
    .querySelectorAll('[data-import-choice]')
    .forEach(select => {
      select.onchange = () => {
        const index = +select.dataset.importChoice,
          entry = current.entries[index];
        entry.choice = select.value === '' ? null : entry.candidates[+select.value];
        entry.selected = !!entry.choice;
        entry.coordinateSource = entry.choice ? 'Atlas match' : null;
        renderReview(index);
      };
    });
  $('#modalbody')
    .querySelectorAll('[data-import-search]')
    .forEach(button => {
      button.onclick = () => {
        const index = +button.dataset.importSearch,
          entry = current.entries[index],
          query = $(`[data-import-query="${index}"]`).value;
        entry.candidates = findImportMatches(query, current.index);
        entry.choice = null;
        entry.location = null;
        entry.selected = false;
        entry.coordinateSource = null;
        renderReview(index);
      };
    });
  $('#modalbody')
    .querySelectorAll('[data-import-apply]')
    .forEach(button => {
      button.onclick = () => {
        const index = +button.dataset.importApply,
          value = $(`[data-import-coords="${index}"]`).value,
          coordinate = pastedCoordinates(value);
        if (!coordinate || coordinate.invalid) {
          $(`[data-import-error="${index}"]`).textContent =
            'Could not read that location. Use latitude, longitude or pin it on the map.';
          return;
        }
        setLocation(index, coordinate, 'User coordinates');
        renderReview(index);
      };
    });
  $('#modalbody')
    .querySelectorAll('[data-import-pin]')
    .forEach(button => {
      button.onclick = () => startPin(+button.dataset.importPin);
    });
  if (focusIndex != null) {
    const row = $(`[data-review-row="${focusIndex}"]`);
    row.scrollIntoView({ block: 'nearest' });
    row.querySelector('select, summary')?.focus({ preventScroll: true });
  }
}
function setLocation(index, coordinate, source) {
  const entry = current.entries[index];
  entry.location = { lat: coordinate.lat, lon: coordinate.lon };
  entry.choice = null;
  entry.selected = true;
  entry.invalid = false;
  entry.coordinateSource = source;
}
function finishPin(coordinate) {
  if (!pin) return;
  const { index, camera } = pin;
  pin = null;
  $('#guided-pin-toolbar')?.remove();
  document.removeEventListener('keydown', pinKey);
  flyTo(camera.lon, camera.lat, camera.k, 0);
  if (coordinate) setLocation(index, coordinate, 'User map pin');
  renderReview(index);
}
function pinKey(event) {
  if (event.key === 'Escape') {
    event.preventDefault();
    finishPin();
  }
}
function startPin(index) {
  if (S.mode) {
    toast('Finish the current drawing or map tool before placing a pin.');
    return;
  }
  pin = { index, camera: { ...S.cam } };
  $('#modal').hidden = true;
  const toolbar = document.createElement('div');
  toolbar.id = 'guided-pin-toolbar';
  toolbar.className = 'guided-pin-toolbar';
  toolbar.setAttribute('role', 'region');
  toolbar.setAttribute('aria-label', 'Locate imported site');
  toolbar.innerHTML = `<strong>Locate ${esc(current.entries[index].label)}</strong><span>Zoom or drag the map, then tap the place.</span><div><button class="btn primary" id="guided-pin-centre">Use map centre</button><button class="btn" id="guided-pin-cancel">Cancel</button></div>`;
  document.body.append(toolbar);
  $('#guided-pin-cancel').onclick = () => finishPin();
  $('#guided-pin-centre').onclick = () => {
    const [lon, lat] = proj().invert([W / 2, H / 2]);
    if (Number.isFinite(lat) && Math.abs(lat) <= 90) finishPin({ lat, lon });
  };
  document.addEventListener('keydown', pinKey);
  $('#guided-pin-cancel').focus();
}
export function startGuidedImport(text, commit, back) {
  const parsed = readPastedSites(text);
  if (parsed.error) return parsed.error;
  const index = importSearchIndex(ALLP);
  current = {
    text,
    entries: prepareImportReview(parsed.entries, index),
    index,
    name: 'Pasted places',
    commit,
    back,
  };
  if (!registered) {
    registered = true;
    registerMapTapHandler((x, y) => {
      if (!pin) return false;
      const point = proj().invert([x, y]);
      if (
        point &&
        Number.isFinite(point[0]) &&
        Number.isFinite(point[1]) &&
        Math.abs(point[1]) <= 90 &&
        Math.abs(point[0]) <= 180
      )
        finishPin({ lat: point[1], lon: point[0] });
      return true;
    });
  }
  renderReview();
  return null;
}
