// CSV / GeoJSON import
import { $, D2R, R2D, esc, nf } from '../core/util.js';
import { rebuildPoints } from '../domain/points.js';
import { CATEGORIES_IMPORT, TYPENAME, TYPESHORT } from '../domain/site-types.js';
import { flyTo } from '../map/camera.js';
import { kForKm } from '../map/canvas.js';
import { openHtml } from '../panels/data-pane.js';
import { parseCoords } from '../panels/forts-pane.js';
import { S, persistImports } from '../state/state.js';
import { toast } from '../ui/intro.js';
import { changed } from '../ui/sheet.js';

// ================= CSV / GeoJSON import =================
let IMP = null;
export function splitCSV(text) {
  const first = text.split(/\r?\n/).find(l => l.trim()) || '';
  const cnt = ch => {
    let n = 0,
      q = false;
    for (const c of first) {
      if (c === '"') q = !q;
      else if (!q && c === ch) n++;
    }
    return n;
  };
  const delim = [',', ';', '\t', '|'].sort((a, b) => cnt(b) - cnt(a))[0];
  const rows = [];
  let row = [],
    f = '',
    q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          f += '"';
          i++;
        } else q = false;
      } else f += c;
      continue;
    }
    if (c === '"') q = true;
    else if (c === delim) {
      row.push(f);
      f = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(f);
      f = '';
      if (row.some(x => x.trim() !== '')) rows.push(row);
      row = [];
    } else f += c;
  }
  row.push(f);
  if (row.some(x => x.trim() !== '')) rows.push(row);
  return { rows, delim };
}
const COLS = {
  name: /^(name|title|site|label|n|place|monument|fort|nombre|nom|itemlabel|item_label)$/i,
  lat: /^(lat|latitude|y|lat_dd|lat_y|breite)$/i,
  lon: /^(lon|lng|long|longitude|x|lon_dd|long_x|laenge|länge)$/i,
  coords: /^(coords?|coordinates|location|position|latlon|lat_lon|wkt|geometry|point)$/i,
  cat: /^(category|type|kind|class|cat|tipo|site_type|network_category)$/i,
  note: /^(notes?|description|desc|comment|details|descripcion)$/i,
  unc: /^(uncertainty_m|uncertainty|unc|accuracy|accuracy_m)$/i,
  url: /^(url|source|source_url|link|wikipedia|href|item|wikidata)$/i,
  reg: /^(region|country|reg|area|pais|state)$/i,
};
function guessCat(s) {
  s = (s || '').toLowerCase();
  if (/star.?fort|bastion|sconce|redoubt|schanze|ravelin|vauban|trace italienne/.test(s)) return 'fort';
  if (
    /castle|citadel|fortress|festung|kastell|palace|château|chateau|castell|castillo|burg\b|keep\b|\bfort\b/.test(
      s,
    )
  )
    return 'castle';
  if (/dolmen|megalith|monolith|trilithon|rock.?cut|rock.?hewn|passage tomb|cromlech|quoit|polygonal/.test(s))
    return 'megalith';
  if (/obelisk|menhir|standing stone|stone|circle|stele|henge|moai/.test(s)) return 'obelisk';
  if (/church|cathedral|abbey|monaster|basilica|chapel|minster|priory|convent/.test(s)) return 'church';
  if (/temple|shrine|sanctuar|sacred|mosque|pagoda|stupa|oracle|holy|ziggurat|ley|node/.test(s))
    return 'temple';
  if (/mount|mountain|hill|peak|volcano|rock|cave|spring|tor\b|tepui|natural/.test(s)) return 'mountain';
  if (/ruin|tomb|pyramid|mound|barrow|archaeo|necropolis|site|city|tumulus/.test(s)) return 'ruin';
  return 'landmark';
}
export function parseImport(text) {
  text = text.replace(/^\uFEFF/, '');
  const t = text.trim();
  if (t.startsWith('{') || t.startsWith('[')) {
    let g;
    try {
      g = JSON.parse(t);
    } catch (e) {
      return { err: 'That looks like JSON but could not be read.' };
    }
    const feats =
      g.type === 'FeatureCollection' ? g.features : Array.isArray(g) ? g : g.type === 'Feature' ? [g] : [];
    const rows = [],
      skipped = [];
    feats.forEach((f, i) => {
      const gm = f && f.geometry;
      let c = null;
      if (gm && gm.type === 'Point') c = gm.coordinates;
      else if (gm && gm.type === 'MultiPoint' && gm.coordinates.length) c = gm.coordinates[0];
      else if (gm && (gm.type === 'Polygon' || gm.type === 'MultiPolygon')) {
        const ring = gm.type === 'Polygon' ? gm.coordinates[0] : gm.coordinates[0][0];
        c = [
          ring.reduce((a, p) => a + p[0], 0) / ring.length,
          ring.reduce((a, p) => a + p[1], 0) / ring.length,
        ];
      }
      const pr = (f && f.properties) || {};
      if (!c || !isFinite(c[0]) || !isFinite(c[1]) || Math.abs(c[1]) > 90 || Math.abs(c[0]) > 180) {
        skipped.push(i + 1);
        return;
      }
      const nm = pr.name || pr.title || pr.n || pr.label || `Feature ${i + 1}`;
      rows.push({
        n: String(nm),
        lat: +c[1],
        lon: +c[0],
        raw: String(pr.category || pr.type || pr.kind || '').trim(),
        note: pr.description || pr.notes || '',
        url: pr.url || pr.source || pr.wikipedia || '',
        reg: pr.country || pr.region || '',
      });
    });
    return { kind: 'GeoJSON', fixed: { rows, skipped }, total: feats.length };
  }
  const { rows: raw, delim } = splitCSV(text);
  if (!raw.length) return { err: 'No rows found.' };
  const head = raw[0].map(h => h.trim().replace(/^"|"$/g, ''));
  const hasHeader =
    head.some(h => Object.values(COLS).some(re => re.test(h))) || head.some(h => isNaN(parseFloat(h)));
  const headers = hasHeader ? head : head.map((_, i) => `Column ${i + 1}`);
  const body = hasHeader ? raw.slice(1) : raw;
  const find = key => headers.findIndex(h => COLS[key].test(h));
  const map = {
    name: find('name'),
    lat: find('lat'),
    lon: find('lon'),
    coords: find('coords'),
    cat: find('cat'),
    note: find('note'),
    unc: find('unc'),
    url: find('url'),
    reg: find('reg'),
  };
  if (map.lat < 0 && map.coords < 0) {
    const numeric = headers.map((_, i) =>
      body.slice(0, 20).every(r => r[i] !== undefined && r[i].trim() !== '' && isFinite(+r[i])),
    );
    const ni = numeric.map((v, i) => (v ? i : -1)).filter(i => i >= 0);
    if (ni.length >= 2) {
      map.lat = ni[0];
      map.lon = ni[1];
    }
  }
  if (map.name < 0)
    map.name = headers.findIndex((_, i) => i !== map.lat && i !== map.lon && i !== map.coords);
  return { kind: 'CSV', headers, body, map, delim };
}
function rowsFromMap(p) {
  if (p.fixed) return p.fixed;
  const rows = [],
    skipped = [],
    m = p.map;
  const num = v => {
    const s = String(v ?? '')
      .trim()
      .replace(/^(-?\d+),(\d+)$/, '$1.$2');
    return /^[-+]?\d+(\.\d+)?$/.test(s) ? +s : NaN;
  };
  p.body.forEach((r, i) => {
    let lat = NaN,
      lon = NaN;
    if (m.lat >= 0 && m.lon >= 0) {
      lat = num(r[m.lat]);
      lon = num(r[m.lon]);
    }
    if ((!isFinite(lat) || !isFinite(lon)) && m.coords >= 0) {
      const s = String(r[m.coords] || '');
      const wkt = /POINT\s*\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)/i.exec(s);
      if (wkt) {
        lon = +wkt[1];
        lat = +wkt[2];
      } else {
        const c = parseCoords(s)[0];
        if (c) [lat, lon] = c;
      }
    }
    if ((!isFinite(lat) || !isFinite(lon)) && m.lat >= 0 && m.lon >= 0) {
      const c = parseCoords(`${r[m.lat]} ${r[m.lon]}`)[0];
      if (c) [lat, lon] = c;
    }
    if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      skipped.push(i + 2);
      return;
    }
    const n = (m.name >= 0 ? r[m.name] : '') || `Row ${i + 1}`;
    rows.push({
      n: String(n).trim(),
      lat,
      lon,
      raw: m.cat >= 0 ? String(r[m.cat] || '').trim() : '',
      note: m.note >= 0 ? r[m.note] : '',
      url: m.url >= 0 && /^https?:/i.test(r[m.url] || '') ? r[m.url] : '',
      unc: m.unc >= 0 ? +r[m.unc] || 0 : 0,
      reg: m.reg >= 0 ? r[m.reg] : '',
    });
  });
  return { rows, skipped };
}
export function openImport() {
  IMP = null;
  openHtml(
    'Import sites',
    `
  <p class="small">CSV (comma, semicolon or tab) or GeoJSON. Needs a name and latitude/longitude, or one coordinates column. Each row is sorted into a site type (Star forts, Temples, …), so it follows the same switches as everything else.</p>
  <div class="row" style="flex-wrap:wrap"><label class="btn primary filebtn">Choose file<input type="file" id="im-file" accept=".csv,.tsv,.txt,.json,.geojson,text/csv,application/json" hidden></label><span class="small" id="im-fname">or paste below</span></div>
  <textarea id="im-text" rows="5" placeholder="name,lat,lon,type&#10;Fort Bourtange,53.0069,7.1917,star fort&#10;Callanish Stones,58.19754,-6.74514,stone circle"></textarea>
  <button class="btn" id="im-parse">Read pasted text</button>
  <div id="im-prev"></div>`,
  );
  $('#im-file').onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    $('#im-fname').textContent = file.name;
    const rd = new FileReader();
    rd.onload = () => previewImport(String(rd.result), file.name.replace(/\.[^.]+$/, ''));
    rd.onerror = () => toast('That file could not be read');
    rd.readAsText(file);
  };
  $('#im-parse').onclick = () => previewImport($('#im-text').value, 'Pasted list');
}
function previewImport(text, name) {
  const p = parseImport(text),
    el = $('#im-prev');
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
    url: r.url,
    unc: r.unc,
    reg: r.reg,
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
