// Saved data, export and Wikidata import
import { GEO } from '../core/geo.js';
import { $, $$, esc, nf } from '../core/util.js';
import { CLASSES, SITES } from '../data/catalog.js';
import {
  CASTLES,
  DEPOSITS,
  FAULTS,
  FORTS_EXT,
  MEGALITHS,
  NEAR,
  PLEIADES,
  ROMAN,
  UNESCO,
  WONDERS,
} from '../data/datasets.js';
import { MATCH } from '../domain/analysis.js';
import { LINES, activeLine, lineShown } from '../domain/lines.js';
import { ALLP, rebuildPoints } from '../domain/points.js';
import { SOURCES, TYPENAME } from '../domain/site-types.js';
import { openImport } from '../features/import.js';
import { setView } from '../map/interaction.js';
import { S, modForts, persistImports, stripF } from '../state/state.js';
import { toast } from '../ui/intro.js';
import { changed } from '../ui/sheet.js';

import { renderLayers } from './layers-pane.js';
import { v2Button } from '../ui/panel-parts.js';

let RESOURCE_TAB = 'datasets';
// Resources: dataset controls, imports, exports and reference material.
export function renderData() {
  const counts = { wiki: 0, unesco: 0, src: 0, given: 0, ref: 0 };
  for (const s of SITES) counts[s.given ? 'given' : s.v || 'ref']++;
  const wsrc = {};
  for (const w of WONDERS) wsrc[w.src] = (wsrc[w.src] || 0) + 1;
  const todo = [
    [
      'part',
      'Published lines',
      'Tor Sapienza drawn from its own source. Duff: only the claimed crossing (Meta Romuli) can be placed. Prenestina: no separate source found.',
    ],
    [
      'done',
      'Independent control sets',
      `Star forts (${nf(FORTS_EXT.length)}), Pleiades temples (${nf(PLEIADES.length)}) and UNESCO (${nf(UNESCO.length)}) in Test.`,
    ],
    [
      'done',
      'Larger site lists',
      `${WONDERS.length} wonders with cited coordinates, ${nf(FORTS_EXT.length)} star forts, ${nf(CASTLES.rows.length)} castles, ${MEGALITHS.length} stonework sites, ${nf(PLEIADES.length)} ancient sacred sites.`,
    ],
    [
      ALLP.filter(p => p.cat === 'church').length > 200 ? 'done' : 'open',
      `Cathedrals: only ${nf(ALLP.filter(p => p.cat === 'church').length)} church sites so far`,
      'Too few for a strong underground test. Use the Wikidata buttons above (cathedrals, basilicas, abbeys) and import the CSV.',
    ],
    [
      'part',
      'Underground data is thin outside North America',
      'Germany has about 140 deposit records, the USA tens of thousands. National geological surveys (BGS, BRGM, BGR) publish fuller lists that could be added.',
    ],
    [
      'done',
      'Magnetic data beyond Britain',
      'World crustal magnetic field from NOAA’s Enhanced Magnetic Model (EMM2017), land and sea, about 25 km detail. Britain keeps its 2 km survey.',
    ],
  ];
  const tabs = [
    ['datasets', 'Datasets'],
    ['import', 'Import'],
    ['export', 'Export'],
    ['reference', 'Reference'],
  ];
  $('#p-data').innerHTML =
    `<nav class="atlas-segments" aria-label="Resources">${tabs.map(([key, title]) => `<button data-resource-view="${key}" aria-current="${RESOURCE_TAB === key ? 'page' : 'false'}">${title}</button>`).join('')}</nav>
  ${RESOURCE_TAB === 'datasets' ? '<div id="resource-sources"></div>' : ''}
  ${RESOURCE_TAB === 'import' ? `<div class="atlas-heading"><span class="atlas-eyebrow">YOUR COLLECTION</span><h2>Import sites</h2><p>CSV, TSV or GeoJSON.</p></div><button class="btn primary block" id="e-import">Import sites</button><p class="small">Imported sites appear in Datasets and follow the site types in Layers.</p><div class="v2-card"><h2>Wikidata</h2><p class="small">Open a query, select Run, then Download → CSV. Import the downloaded file here.</p><div class="wrap">${WD_QUERIES.map(([k, t]) => `<a class="btn" target="_blank" rel="noopener" href="${wdUrl(k)}">${esc(t)} ↗</a>`).join('')}</div></div>` : ''}
  ${RESOURCE_TAB === 'export' ? `<div class="v2-card"><h2>Backup</h2><p class="small">Lines, markers, imported sites and map settings. Saved to a file on your device.</p><div class="v2-actions">${v2Button('export-backup', 'Save backup', 'primary')}${v2Button('import-backup', 'Restore backup')}</div></div><div class="v2-card"><h2>Export</h2><div class="atlas-export-list">${v2Button('export-geo', 'Lines · GeoJSON')}${v2Button('export-csv', 'Sites along line · CSV')}${v2Button('export-png', 'Map · PNG')}</div>${!activeLine() ? '<p class="small">Open a line to export its sites.</p>' : ''}</div>` : ''}
  ${
    RESOURCE_TAB === 'reference'
      ? `  <h2>Attribution</h2>
  <div class="tblwrap"><table class="tbl">
    <tr><th>List</th><th style="text-align:right">Sites</th><th>Coordinates from</th></tr>
    <tr><td>Project sites</td><td class="n">${SITES.length}</td><td class="small">${counts.given} your anchors · ${counts.wiki} checked against Wikipedia · ${counts.unesco} agree with UNESCO · ${counts.ref} reference values</td></tr>
    <tr><td>Wonders</td><td class="n">${WONDERS.length}</td><td class="small">${Object.entries(wsrc)
      .map(([k, v]) => `${v} ${esc(k)}`)
      .join(' · ')}. Each card links its source.</td></tr>
    <tr><td>Star forts</td><td class="n">${nf(FORTS_EXT.length)}</td><td class="small"><a href="https://github.com/Tristan-Hotham/star-forts" target="_blank" rel="noopener">Hotham (2026)</a>: 769 outlines from OpenStreetMap, 498 Wikidata points, 40 from Wikipedia. ODbL.</td></tr>
    <tr><td>Ancient temples</td><td class="n">${nf(PLEIADES.length)}</td><td class="small"><a href="https://pleiades.stoa.org/" target="_blank" rel="noopener">Pleiades</a>, precise locations only (≤ 500 m). CC BY.</td></tr>
    <tr><td>Roman-era monuments</td><td class="n">${nf(ROMAN.rows.length)}</td><td class="small"><a href="https://pleiades.stoa.org/" target="_blank" rel="noopener">Pleiades</a>: places attested 50 BC – AD 450 with a location accurate to 500 m or better; ${nf(2970 - ROMAN.rows.length)} more were already on the map and were not added twice. CC BY.</td></tr>
    <tr><td>Castles</td><td class="n">${nf(CASTLES.rows.length)}</td><td class="small"><a href="https://github.com/Flightmussy/castlemap-dataset" target="_blank" rel="noopener">Castles of the World</a> (Castlemap, CC0): every pin checked against Wikipedia and Wikidata. ${nf(9040 - CASTLES.rows.length)} rows that duplicate a star fort or wonder are left out.</td></tr>
    <tr><td>Stonework</td><td class="n">${MEGALITHS.length}</td><td class="small"><a href="https://github.com/torbjorn-fralse/megaliths" target="_blank" rel="noopener">Fralse (2026)</a>, CC BY 4.0. Masonry scores are the author’s; coordinates are approximate (±0.3–2 km).</td></tr>
    <tr><td>Deposits</td><td class="n">${nf(DEPOSITS.n)}</td><td class="small">USGS MRDS and world deposit catalogues, de-duplicated by <a href="https://github.com/Alexander-ai/global-deposit-globe" target="_blank" rel="noopener">global-deposit-globe</a>, plus USGS Major Mineral Deposits of the World (OFR 2005-1294). Smelters, refineries and mills removed. About 85% of records are in the USA and Canada.</td></tr>
    <tr><td>Faults & plates</td><td class="n">${nf(FAULTS.f.length)}</td><td class="small"><a href="https://github.com/GEMScienceTools/gem-global-active-faults" target="_blank" rel="noopener">GEM Global Active Faults</a> (CC BY-SA 4.0); plate boundaries from Bird (2003) PB2002.</td></tr>
    <tr><td>Nearest towns</td><td class="n">${nf(Object.keys(NEAR).length)}</td><td class="small"><a href="https://www.geonames.org/" target="_blank" rel="noopener">GeoNames</a> places of 1,000+ people (CC BY 4.0), used to label forts and castles with the nearest town.</td></tr>
    <tr><td>Magnetic (world)</td><td class="n">—</td><td class="small">NOAA/NCEI Enhanced Magnetic Model 2017, crustal field (degrees 16–790, wavelengths down to ~51 km) computed 4 km above sea level and shown as the total-field anomaly. Public domain. Coefficients via github.com/anielsen001/emm2017.</td></tr>
    <tr><td>Magnetic (GB)</td><td class="n">—</td><td class="small">British Geological Survey aeromagnetic survey of Great Britain, gridded here at 2 km (Open Government Licence; via Fatiando a Terra).</td></tr>
    <tr><td>UNESCO</td><td class="n">${nf(UNESCO.length)}</td><td class="small">2014 list via the UWHS dataset; one point per property.</td></tr>
  </table></div>
  <h2>Method</h2>
  <p class="lede">Lines are great circles on a sphere of the WGS84 mean radius (6,371.0088 km); ellipsoidal geodesics differ by under 0.5%. Off-line distances are cross-track distances. Each fort with a traced outline is drawn at the outline's centroid.</p>
  <p class="lede">Proximity is not evidence of energy transmission, global planning or a shared civilisation. Ore bodies do not give off energy by themselves. Magnetite-rich rock does bend the local magnetic field (sometimes enough to swing a compass), which is what the British magnetic survey measures, and metal ores conduct electricity better than the rock around them, which geologists use to find them by sending a current into the ground. Analyze shows how often ordinary lines do just as well.</p><details class="v2-sec"><summary>Research notes</summary>  <div class="todo">${todo.map(([st, t, d]) => `<div class="td ${st}"><i aria-hidden="true">${st === 'done' ? '✓' : st === 'part' ? '◐' : '○'}</i><div><b>${esc(t)}</b><span>${esc(d)}</span></div></div>`).join('')}</div>
</details>`
      : ''
  }`;
  if (RESOURCE_TAB === 'datasets') renderLayers('sources', '#resource-sources');
  if ($('#e-import')) $('#e-import').onclick = openImport;
  $$('#p-data [data-resource-view]').forEach(
    b =>
      (b.onclick = () => {
        RESOURCE_TAB = b.dataset.resourceView;
        renderData();
        $('#p-data').scrollTop = 0;
        $('#p-data [aria-current="page"]').focus({ preventScroll: true });
      }),
  );
}
const WD_QUERIES = [
  ['Q2977', 'Cathedrals', 'cathedral', 5],
  ['Q163687', 'Basilicas', 'basilica', 5],
  ['Q44613', 'Monasteries', 'monastery', 8],
  ['Q160742', 'Abbeys', 'abbey', 6],
  ['Q842402', 'Hindu temples', 'hindu temple', 6],
  ['Q5393308', 'Buddhist temples', 'buddhist temple', 6],
  ['Q101659', 'Dolmens', 'dolmen', 2],
];
import { notebookSnapshot, replaceNotebook } from '../state/research-notebook.js';

function wdUrl(q) {
  const [, , type, sl] = WD_QUERIES.find(x => x[0] === q);
  const sparql = `# ${type}s with coordinates, known in at least ${sl} Wikipedia languages
SELECT ?item ?itemLabel ?coord ?type WHERE {
  ?item wdt:P31/wdt:P279* wd:${q}; wdt:P625 ?coord; wikibase:sitelinks ?links.
  FILTER(?links >= ${sl})
  BIND("${type}" AS ?type)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,fr,de,it,es". }
}
LIMIT 6000`;
  return 'https://query.wikidata.org/#' + encodeURIComponent(sparql);
}
export function geojson() {
  const F = [];
  for (const l of LINES) {
    if (!lineShown(l)) continue;
    F.push({
      type: 'Feature',
      properties: {
        id: l.id,
        name: l.name,
        classification: CLASSES[l.cls],
        bearing_deg: +l.segs[0].brg.toFixed(4),
        extent: isFinite(l.segs[0].len) ? l.segs.reduce((a, s) => a + s.len, 0) : 'full great circle',
      },
      geometry: {
        type: 'MultiLineString',
        coordinates: l.segs.map(s =>
          GEO.sample(s, isFinite(s.len) ? Math.max(s.len / 200, 0.001) : 50).map(p => [
            +p[0].toFixed(6),
            +p[1].toFixed(6),
          ]),
        ),
      },
    });
  }
  for (const m of MATCH)
    F.push({
      type: 'Feature',
      properties: {
        id: m.p.id,
        name: m.p.n,
        type: TYPENAME[m.p.cat],
        list: SOURCES[m.p.set]?.label || m.p.set,
        classification: CLASSES[m.p.cls || 'structure'],
        uncertainty_m: m.p.unc,
        coordinate_source: m.p.srcLabel || (m.p.given ? 'given' : 'reference'),
        distance_to_active_km: +m.d.toFixed(4),
        corridor_status: m.status,
        source: m.p.srcUrl || (m.p.wiki ? 'https://en.wikipedia.org/wiki/' + m.p.wiki : null),
      },
      geometry: { type: 'Point', coordinates: [m.p.lon, m.p.lat] },
    });
  return {
    type: 'FeatureCollection',
    properties: {
      active_line: S.active,
      corridor_km: S.corridorKm,
      model: 'great circles, sphere R=6371.0088 km',
    },
    features: F,
  };
}
export function csv() {
  const q = v => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v);
  const rows = [
    [
      'name',
      'region',
      'lat',
      'lon',
      'type',
      'list',
      'classification',
      'uncertainty_m',
      'coordinate_source',
      'active_line',
      'distance_km',
      'signed_crosstrack_km',
      'line_uncertainty_km',
      'corridor_km',
      'status',
      'source',
    ],
  ];
  for (const m of MATCH)
    rows.push([
      m.p.n,
      m.p.reg || '',
      m.p.lat,
      m.p.lon,
      m.p.cat,
      SOURCES[m.p.set]?.label || m.p.set,
      CLASSES[m.p.cls || 'structure'],
      m.p.unc || 0,
      m.p.srcLabel || (m.p.given ? 'given' : 'reference'),
      S.active,
      m.d.toFixed(5),
      m.xt.toFixed(5),
      m.lu.toFixed(3),
      S.corridorKm,
      m.status,
      m.p.srcUrl || (m.p.wiki ? 'https://en.wikipedia.org/wiki/' + m.p.wiki : ''),
    ]);
  return rows.map(r => r.map(q).join(',')).join('\n');
}
export function stateCode() {
  const body = {
    v: 4,
    researchNotebook: notebookSnapshot(),
    view: S.view,
    cam: S.cam,
    layers: S.layers,
    src: S.src,
    under: S.under,
    focus: S.focus,
    corridorKm: S.corridorKm,
    active: S.active,
    forts: modForts(),
    userLines: S.userLines.map(stripF),
    work: stripF(S.work),
    markers: S.markers,
    imports: S.imports,
  };
  return btoa(unescape(encodeURIComponent(JSON.stringify(body))));
}
export function loadState(code) {
  const d = JSON.parse(decodeURIComponent(escape(atob(code))));
  if (!d || ![1, 2, 3, 4].includes(d.v)) throw new Error('bad');
  if (d.v === 4) replaceNotebook(d.researchNotebook);
  Object.assign(S, {
    cam: d.cam,
    layers: { ...S.layers, ...d.layers, cat: { ...S.layers.cat, ...(d.layers?.cat || {}) } },
    corridorKm: d.corridorKm,
    active: d.active,
    forts: d.forts || {},
    userLines: d.userLines || [],
    markers: d.markers || [],
  });
  if (d.src) S.src = { ...S.src, ...d.src };
  if (d.under) S.under = { ...S.under, ...d.under };
  if (typeof d.focus === 'boolean') S.focus = d.focus;
  if (d.work) S.work = d.work;

  if (d.imports && d.imports.length) {
    for (const im of d.imports) if (!S.imports.find(i => i.id === im.id)) S.imports.push(im);
    persistImports();
  }
  rebuildPoints();
  S.view = d.view === 'globe' ? 'map' : 'globe';
  setView(d.view);
  changed();
}
export function copyText(text, msgEl) {
  const done = () => {
    toast('Copied');
    if (msgEl) msgEl.textContent = 'Copied.';
  };
  const fail = () => toast('Copy blocked: select the text instead');
  try {
    navigator.clipboard.writeText(text).then(done, fail);
  } catch (e) {
    fail();
  }
}
export function openText(title, text) {
  openHtml(
    title,
    `<textarea readonly id="mt">${esc(text)}</textarea><div class="row"><button class="btn primary" id="mt-copy">Copy</button><span class="small" id="mt-msg"></span></div>`,
  );
  $('#mt-copy').onclick = () => {
    $('#mt').select();
    copyText(text, $('#mt-msg'));
  };
}
export function confirmBox(msg, okLabel, fn) {
  openHtml(
    'Confirm',
    `<p>${esc(msg)}</p><div class="row"><button class="btn danger" id="cf-ok">${esc(okLabel)}</button><button class="btn ghost" id="cf-no">Cancel</button></div>`,
  );
  $('#cf-ok').onclick = () => {
    $('#modal').hidden = true;
    fn();
  };
  $('#cf-no').onclick = () => {
    $('#modal').hidden = true;
  };
}
export function openHtml(title, html) {
  $('#modaltitle').textContent = title;
  $('#modalbody').innerHTML = html;
  $('#modal').hidden = false;
}

export function initDataPane() {
  $('#modalclose').onclick = () => {
    $('#modal').hidden = true;
  };
  $('#modal').onclick = e => {
    if (e.target.id === 'modal') $('#modal').hidden = true;
  };
}
