// CSV / GeoJSON import
import { $, D2R, R2D, esc, nf } from '../core/util.js';
import { rebuildPoints } from '../domain/points.js';
import { CATEGORIES_IMPORT, TYPENAME, TYPESHORT } from '../domain/site-types.js';
import { flyTo } from '../map/camera.js';
import { kForKm } from '../map/canvas.js';
import { openHtml } from '../panels/data-pane.js';
import { parseImport, rowsFromMap, guessCat } from '../core/site-import.js';
import { S, persistImports } from '../state/state.js';
import { toast } from '../ui/intro.js';
import { changed } from '../ui/sheet.js';

// ================= CSV / GeoJSON import =================
let IMP = null;
export { splitCSV, parseImport } from '../core/site-import.js';

import { startGuidedImport } from './guided-import.js';

export function openImport(pastedText = '') {
  IMP = null;
  const original = typeof pastedText === 'string' ? pastedText : '';
  openHtml(
    'Import sites',
    `<p class="import-step"><strong>PASTE</strong> → REVIEW → IMPORT</p><p class="small">Paste place names, coordinates or a list copied from a document. We’ll find possible locations for you to check.</p><label class="import-field" for="im-text">Your places</label><textarea id="im-text" rows="5" placeholder="Stonehenge&#10;Mont Saint-Michel&#10;Delphi, Greece">${esc(original)}</textarea><button class="btn primary block" id="im-parse">Find sites</button><p id="im-message" class="small" role="status"></p><details><summary class="import-file-summary">Or upload a file</summary><p class="small">CSV, spreadsheet text (TSV) or GeoJSON. You can review and change the columns before importing.</p><label class="btn filebtn">Choose file<input type="file" id="im-file" accept=".csv,.tsv,.txt,.json,.geojson,text/csv,application/json" hidden></label><span class="small" id="im-fname"></span></details><div id="im-prev"></div>`,
  );
  $('#im-file').onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    $('#im-fname').textContent = file.name;
    const reader = new FileReader();
    reader.onload = () => previewImport(String(reader.result), file.name.replace(/\.[^.]+$/, ''));
    reader.onerror = () => toast('That file could not be read');
    reader.readAsText(file);
  };
  $('#im-parse').onclick = () => {
    const text = $('#im-text').value;
    let parsed;
    try {
      parsed = parseImport(text);
    } catch {
      parsed = { err: 'That file structure could not be read.' };
    }
    if (
      text.trim().startsWith('{') ||
      text.trim().startsWith('[') ||
      (parsed.kind === 'CSV' && (parsed.map.coords >= 0 || (parsed.map.lat >= 0 && parsed.map.lon >= 0)))
    ) {
      if (parsed.err) {
        $('#im-message').textContent = parsed.err;
        return;
      }
      previewImport(text, 'Pasted list');
      return;
    }
    const error = startGuidedImport(
      text,
      (rows, name) => {
        IMP = { name, res: { rows: rows.map(r => ({ ...r, cat: r.cat || guessCat(r.n) })), skipped: [] } };
        commitImport();
      },
      openImport,
    );
    if (error) $('#im-message').textContent = error;
  };
}
function previewImport(text, name) {
  const el = $('#im-prev');
  let p;
  try {
    p = parseImport(text);
  } catch {
    p = { err: 'That file could not be read. Try CSV, TSV or GeoJSON with named locations.' };
  }
  if (p.err) {
    el.innerHTML = `<p class="note warn">${esc(p.err)}</p>`;
    return;
  }
  IMP = { p, name, catMap: {}, all: 'auto' };
  const opt = (sel, auto) =>
    (auto ? `<option value="auto" ${sel === 'auto' ? 'selected' : ''}>Guess from each name</option>` : '') +
    CATEGORIES_IMPORT.map(
      c => `<option value="${c}" ${sel === c ? 'selected' : ''}>${esc(TYPENAME[c])}</option>`,
    ).join('');
  const render = () => {
    const res = rowsFromMap(p);
    IMP.res = res;
    const vals = new Map();
    for (const r of res.rows) if (r.raw) vals.set(r.raw, (vals.get(r.raw) || 0) + 1);
    for (const v of vals.keys()) if (!(v in IMP.catMap)) IMP.catMap[v] = guessCat(v);
    for (const r of res.rows)
      r.cat = r.raw ? IMP.catMap[r.raw] : IMP.all === 'auto' ? guessCat(r.n) : IMP.all;
    const cats = {};
    res.rows.forEach(r => (cats[r.cat] = (cats[r.cat] || 0) + 1));
    const sel = (key, label) =>
      `<label class="f"><span>${label}</span><select data-map="${key}"><option value="-1">—</option>${p.headers.map((h, i) => `<option value="${i}" ${p.map[key] === i ? 'selected' : ''}>${esc(h)}</option>`).join('')}</select></label>`;
    const vlist = [...vals.entries()].sort((a, b) => b[1] - a[1]);
    el.innerHTML = `
    ${p.kind === 'CSV' ? `<h3 class="sub">Columns</h3><div class="mapgrid">${sel('name', 'Name')}${sel('lat', 'Latitude')}${sel('lon', 'Longitude')}${sel('coords', 'or one coordinates column')}${sel('cat', 'Type column')}${sel('note', 'Notes')}</div>` : ''}
    <h3 class="sub">Sort into site types</h3>
    ${
      vlist.length
        ? `<p class="small" style="margin:0 0 6px">Each value in the type column goes to one site type. Change any that are wrong.</p><div class="catmap">${vlist
            .slice(0, 40)
            .map(
              ([v, n], i) =>
                `<span>${esc(v)} <span class="small">(${n})</span></span><select data-cv="${i}">${opt(IMP.catMap[v])}</select>`,
            )
            .join(
              '',
            )}</div>${vlist.length > 40 ? `<p class="small">${vlist.length - 40} more values were guessed automatically.</p>` : ''}`
        : `<label class="f">No type column, so every row is<select id="im-all">${opt(IMP.all, true)}</select></label>`
    }
    <div class="verdict ${res.rows.length ? 'hi' : ''}" style="margin-top:12px"><b>${nf(res.rows.length)} rows ready</b><span class="mono">${res.skipped.length ? res.skipped.length + ' skipped' : 'none skipped'}</span></div>
    ${res.skipped.length ? `<p class="small">Skipped (no valid coordinates): row${res.skipped.length > 1 ? 's' : ''} ${res.skipped.slice(0, 12).join(', ')}${res.skipped.length > 12 ? '…' : ''}</p>` : ''}
    ${
      res.rows.length
        ? `<p class="small">${Object.entries(cats)
            .map(([k, v]) => `${v} ${esc(TYPENAME[k] || k)}`)
            .join(' · ')}</p>
    <div class="tblwrap"><table class="tbl"><tr><th>Name</th><th style="text-align:right">Lat</th><th style="text-align:right">Lon</th><th>Type</th></tr>${res.rows
      .slice(0, 6)
      .map(
        r =>
          `<tr><td>${esc(r.n)}</td><td class="n">${r.lat.toFixed(5)}</td><td class="n">${r.lon.toFixed(5)}</td><td>${esc(TYPESHORT[r.cat])}</td></tr>`,
      )
      .join('')}</table></div>
    <label class="f" style="margin-top:8px">Name for this import<input type="text" id="im-name" value="${esc(name)}"></label>
    <button class="btn primary block" id="im-go" style="margin-top:10px">Add ${nf(res.rows.length)} sites</button>`
        : ''
    }`;
    el.querySelectorAll('[data-map]').forEach(
      s =>
        (s.onchange = () => {
          p.map[s.dataset.map] = +s.value;
          render();
        }),
    );
    el.querySelectorAll('[data-cv]').forEach(
      s =>
        (s.onchange = () => {
          IMP.catMap[vlist[+s.dataset.cv][0]] = s.value;
          render();
        }),
    );
    if ($('#im-all'))
      $('#im-all').onchange = e => {
        IMP.all = e.target.value;
        render();
      };
    if ($('#im-go')) $('#im-go').onclick = commitImport;
  };
  render();
}
function commitImport() {
  if (!IMP || !IMP.res || !IMP.res.rows.length) return;
  if (IMP.res.rows.length > 20000) {
    toast('Too many rows: the limit is 20,000 per import');
    return;
  }
  const id = 'im' + Date.now(),
    name = ($('#im-name').value || IMP.name).trim() || 'Imported';
  const rows = IMP.res.rows.map((r, i) => ({
    id: `${id}-${i}`,
    n: r.n,
    lat: r.lat,
    lon: r.lon,
    cat: r.cat,
    note: r.note,
    url: /^https?:\/\//i.test(r.url || '') ? r.url : '',
    unc: r.unc,
    reg: r.reg,
    ...(r.coordinateSource
      ? { coordinateSource: r.coordinateSource, originalText: r.originalText, matchedSiteId: r.matchedSiteId }
      : {}),
  }));
  S.imports.push({ id, name, rows, on: true, when: new Date().toLocaleDateString() });
  const saved = persistImports();
  for (const c of new Set(rows.map(r => r.cat))) S.layers.cat[c] = true;
  rebuildPoints();
  changed();
  $('#modal').hidden = true;
  toast(
    saved
      ? `Added ${nf(rows.length)} sites from “${name}”`
      : `Added ${nf(rows.length)} sites. Too large to save in this browser, so they last until you close the page.`,
    4500,
  );
  const la = rows.reduce((a, r) => a + r.lat, 0) / rows.length,
    lo =
      Math.atan2(
        rows.reduce((a, r) => a + Math.sin(r.lon * D2R), 0),
        rows.reduce((a, r) => a + Math.cos(r.lon * D2R), 0),
      ) * R2D;
  if (rows.length === 1) flyTo(rows[0].lon, rows[0].lat, kForKm(5), 1400);
  else flyTo(lo, la, Math.min(S.cam.k, kForKm(3000)), 1400);
}
