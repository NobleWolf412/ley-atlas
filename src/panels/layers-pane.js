// Layers panel
import { sw } from '../render/icons.js';
import { $, $$, esc, nf } from '../core/util.js';
import { UNAVAILABLE } from '../data/catalog.js';
import { MEGALITHS } from '../data/datasets.js';
import { INTS } from '../domain/analysis.js';
import { CS0, LINEBY, LINES, activeLine } from '../domain/lines.js';
import { ALLP, BASE, srcOn } from '../domain/points.js';
import { SOURCES, TYPES } from '../domain/site-types.js';
import { openImport } from '../features/import.js';
import { UG, UGBIT, depData } from '../layers/underground.js';
import { req } from '../map/draw.js';
import { fmtKm } from '../core/format.js';
import { setView } from '../map/interaction.js';
import { tag } from './lines-pane.js';
import { S, persistImports } from '../state/state.js';
import { toast } from '../ui/intro.js';
import { renderKey, setFocus } from '../ui/map-chrome.js';
import { v2SwipeRow } from '../ui/panels.js';
import { changed, keepScroll } from '../ui/sheet.js';
import { applyTheme } from '../ui/theme.js';

let OPEN = { lines: true, types: true, under: true, sources: false, analysis: false, base: false };
let UGCOUNT = null;
/** Forget the per-mineral record counts (the deposits dataset changed). */
export function resetLayerCounts() {
  UGCOUNT = null;
}
export function renderLayers() {
  const row = (key, title, sub, cls, on, swk, disabled, attr = 'data-layer') =>
    `<div class="lg ${on ? '' : 'off'}">${sw(swk || key)}<div class="t"><b>${esc(title)}</b>${sub ? `<span>${sub}</span>` : ''}${cls ? tag(cls) : ''}</div><button class="tog" role="switch" aria-checked="${on}" aria-label="${esc(title)}" ${attr}="${key}" ${disabled ? 'disabled' : ''}></button></div>`;
  const L = activeLine(),
    swf = LINEBY.swordfit,
    tsf = LINEBY.torsapfit;
  const typeCount = c => ALLP.filter(p => p.cat === c && srcOn(p)).length;
  const srcCount = s => BASE.filter(p => p.set === s).length;
  const grp = (id, title, cnt, body) =>
    `<details class="grp" data-g="${id}" ${OPEN[id] ? 'open' : ''}><summary>${esc(title)} ${cnt ? `<span class="cnt">${cnt}</span>` : ''}</summary><div class="body">${body}</div></details>`;
  $('#p-layers').innerHTML = `
  ${S.focus ? `<div class="notebar"><span style="flex:1">Showing <b>one line</b>: ${L ? esc(L.short || L.name) : 'none chosen yet'}. Line switches below take effect when you show all lines.</span><button class="btn" id="lg-all">Show all</button></div>` : `<div class="notebar"><span style="flex:1">Showing <b>all enabled lines</b>.</span><button class="btn" id="lg-one">Only the active line</button></div>`}
  ${grp(
    'types',
    'Site types',
    '',
    `<p class="small" style="margin:0 0 4px">One switch per type, whatever list the site came from (yours, the wonders, the fort catalogue, imports).</p>` +
      TYPES.map(([k, t]) => {
        const n = typeCount(k);
        return `<div class="lg ${S.layers.cat[k] ? '' : 'off'}">${sw(k)}<div class="t"><b>${esc(t)}</b><span>${nf(n)} site${n === 1 ? '' : 's'}</span></div><button class="tog" role="switch" aria-checked="${S.layers.cat[k]}" aria-label="${esc(t)}" data-cat="${k}"></button></div>`;
      }).join('') +
      row(
        'stonework',
        'Mark precision stonework',
        `Diamond ring on the ${MEGALITHS.length} sites scored for masonry (Göbekli Tepe, Baalbek, Puma Punku…)`,
        '',
        S.layers.stonework,
        'stonework',
      ),
  )}
  ${grp(
    'under',
    'Underground',
    '',
    (() => {
      if (!UGCOUNT) {
        const D = depData();
        UGCOUNT = {};
        for (const [g] of UG) {
          let n = 0;
          for (let k = 0; k < D.n; k++) if (!D.approx[k] && D.m[k] & UGBIT[g]) n++;
          UGCOUNT[g] = n;
        }
      }
      const ug = (k, t, sub, swk) =>
        `<div class="lg ${S.under[k] ? '' : 'off'}">${sw(swk)}<div class="t"><b>${esc(t)}</b><span>${sub}</span></div><button class="tog" role="switch" aria-checked="${S.under[k]}" aria-label="${esc(t)}" data-ug="${k}"></button></div>`;
      return `<p class="small" style="margin:0 0 4px">Recorded mineral deposits and mines, plus faults and magnetic data. Tap a site to see what lies nearest to it. Records are densest in the USA and Canada and thin in much of Europe, so a blank area may just mean no records.</p>
    <h3 class="sub">Mineral deposits</h3>${UG.map(([k, t, sub]) => ug(k, t, `${nf(UGCOUNT[k])} records · ${esc(sub)}`, 'ug-' + k)).join('')}
    <h3 class="sub">Earth structure</h3>
    ${ug('faults', 'Active faults', 'GEM Global Active Faults: faults that can still slip and cause earthquakes', 'faults')}
    ${ug('plates', 'Tectonic plate boundaries', 'Bird (2003) PB2002 model', 'plates')}
    ${ug('mag', 'Magnetic field (world, land and sea)', 'Red = stronger than average (magnetic rock), blue = weaker. World model at about 25 km detail; Britain shows its 2 km survey. Flat map only.', 'mag')}`;
    })(),
  )}
  ${grp(
    'lines',
    'Lines',
    '',
    `
    <h3 class="sub">Case study: ${esc(CS0.title)}</h3>
    ${row('primary', CS0.title + ' line', 'Obelisk → Castel Sant’Angelo, around the globe', 'projection', S.layers.primary)}
    ${row('bestfit', 'Best fit through all three anchors', 'Least-squares great circle incl. St. Peter’s', 'projection', S.layers.bestfit)}
    <h3 class="sub">Published claims</h3>
    ${row('sword', 'Sword of Saint Michael', 'Six Michael sanctuaries, drawn as claimed', 'esoteric', S.layers.sword)}
    ${row('swordfit', 'Sword — best-fit circle', `Sites miss it by ${fmtKm(swf.rms)} on average`, 'projection', S.layers.swordfit)}
    ${row('torsap', 'Tor Sapienza line (UfoCiclismo)', 'MAAM → Tor Sapienza tower → Tor Cervara', 'esoteric', S.layers.torsap)}
    ${row('torsapfit', 'Tor Sapienza — best-fit line', `Markers miss it by ${fmtKm(tsf.rms)} on average`, 'projection', S.layers.torsapfit)}
    ${row('duff', 'Rory Duff — Rome lines', 'Only his claimed former crossing (Meta Romuli) can be placed', 'esoteric', S.layers.duff)}
    ${UNAVAILABLE.map(u => `<div class="lg off">${sw('sword')}<div class="t"><b>${esc(u.n)}</b><span>${esc(u.why)}</span></div><button class="tog" role="switch" aria-checked="false" disabled aria-label="${esc(u.n)} unavailable"></button></div>`).join('')}
    <h3 class="sub">Documented</h3>
    ${row('meridian', 'Vatican Meridian', 'True north–south through the obelisk', 'alignment', S.layers.meridian)}
    ${row('viasacra', 'Via Sacra', 'Forum route, simplified trace', 'alignment', S.layers.viasacra)}
    <h3 class="sub">Yours</h3>
    ${row('user', 'Working line & saved lines', (S.work ? '1 working · ' : '') + S.userLines.length + ' saved', 'user', S.layers.user)}`,
  )}
  ${grp(
    'sources',
    'Data sources',
    '',
    `<p class="small" style="margin:0 0 4px">Which lists feed the site types above. Switch one off to compare with and without it.</p>
    ${row('core', SOURCES.core.label, `${srcCount('core')} sites · ${SOURCES.core.sub}`, '', S.src.core, 'core', false, 'data-src')}
    ${row('wonder', SOURCES.wonder.label, `${srcCount('wonder')} sites · ${SOURCES.wonder.sub}`, '', S.src.wonder, 'wonder', false, 'data-src')}
    ${row('fort', SOURCES.fort.label, `${nf(srcCount('fort'))} forts · ${SOURCES.fort.sub}`, '', S.src.fort, 'fortsrc', false, 'data-src')}
    ${row('pleiades', SOURCES.pleiades.label, `${nf(srcCount('pleiades'))} sites · ${SOURCES.pleiades.sub}`, '', S.src.pleiades, 'pleiades', false, 'data-src')}
    ${row('castle', SOURCES.castle.label, `${nf(srcCount('castle'))} sites · ${SOURCES.castle.sub}`, '', S.src.castle, 'castlesrc', false, 'data-src')}
    ${row('megalith', SOURCES.megalith.label, `${nf(srcCount('megalith'))} added sites (+${MEGALITHS.length - srcCount('megalith')} already on the map) · ${SOURCES.megalith.sub}`, '', S.src.megalith, 'megalith', false, 'data-src')}
    ${row('roman', SOURCES.roman.label, `${nf(srcCount('roman'))} sites · ${SOURCES.roman.sub}`, '', S.src.roman, 'roman', false, 'data-src')}
    ${row('unesco', SOURCES.unesco.label, `${nf(srcCount('unesco'))} properties · ${SOURCES.unesco.sub}`, '', S.src.unesco, 'unesco', false, 'data-src')}
    ${S.imports
      .map(
        im =>
          `<div class="lg ${im.on ? '' : 'off'}">${sw('import')}<div class="t"><b>${esc(im.name)}</b><span>${nf(im.rows.length)} imported rows, sorted into the site types · ${esc(im.when || '')}</span></div><button class="tog" role="switch" aria-checked="${im.on}" aria-label="${esc(im.name)}" data-imp="${im.id}"></button></div>`,
      )
      .map((h, k) => v2SwipeRow('delete-import', S.imports[k].id, S.imports[k].name, h))
      .join(
        '',
      )}${S.imports.length ? '<p class="small" style="margin:4px 0">Swipe an import left to remove it.</p>' : ''}
    <button class="btn" id="lg-import" style="margin:8px 0 6px">+ Import CSV / GeoJSON</button>`,
  )}
  ${grp(
    'analysis',
    'Analysis overlays',
    '',
    `
    ${row('corridor', 'Proximity corridor', `±${fmtKm(S.corridorKm)} around the line on the map`, '', S.layers.corridor)}
    ${row('intersections', 'Line crossings', S.focus ? 'Needs more than one line on the map' : `${INTS.filter(x => !(S.hideTrivial && x.trivial)).length} shown`, '', S.layers.intersections)}
    ${row('outlines', 'Fort outlines', 'Traced footprints (OpenStreetMap), drawn when zoomed in', '', S.layers.outlines, 'outline')}
    ${row('labels', 'Labels', '', '', S.layers.labels, 'label')}`,
  )}
  ${grp(
    'base',
    'Basemap',
    '',
    `
    ${row('places', 'Cities & towns', '', '', S.layers.places, 'places')}
    ${row('rivers', 'Rivers', '', '', S.layers.rivers, 'river')}
    ${row('borders', 'Country borders', '', '', S.layers.borders, 'border')}
    ${row('sat', 'Satellite imagery (2D)', S.satFailed ? 'Blocked inside the Claude app. Open the HTML file in a desktop browser to use it.' : 'Esri World Imagery where the viewer allows it', '', S.layers.sat && !S.satFailed, 'sat', S.satFailed)}`,
  )}`;
  $$('#p-layers details.grp').forEach(
    d =>
      (d.ontoggle = () => {
        OPEN[d.dataset.g] = d.open;
      }),
  );
  if ($('#lg-all')) $('#lg-all').onclick = () => setFocus(false);
  if ($('#lg-one')) $('#lg-one').onclick = () => setFocus(true);
  $$('#p-layers [data-layer]').forEach(
    b =>
      (b.onclick = () => {
        const k = b.dataset.layer;
        S.layers[k] = !S.layers[k];
        if (k === 'sat' && S.layers.sat) setView('map');
        const a = activeLine();
        if (!S.layers[k] && a && a.layer === k)
          S.active = LINES.find(l => S.layers[l.layer] && l.layer === 'user')?.id || null;
        changed();
      }),
  );
  $$('#p-layers [data-ug]').forEach(
    b =>
      (b.onclick = () => {
        const k = b.dataset.ug;
        S.under[k] = !S.under[k];
        if (k === 'mag' && S.under.mag) {
          if (S.view !== 'map') setView('map');
          toast('Magnetic field: red = stronger than average, blue = weaker. Shown on the flat map.', 3500);
        }
        keepScroll('#p-layers', renderLayers);
        renderKey();
        req();
      }),
  );
  $$('#p-layers [data-src]').forEach(
    b =>
      (b.onclick = () => {
        const k = b.dataset.src;
        S.src[k] = !S.src[k];
        changed();
      }),
  );
  $$('#p-layers [data-cat]').forEach(
    b =>
      (b.onclick = () => {
        const k = b.dataset.cat;
        S.layers.cat[k] = !S.layers.cat[k];
        changed();
      }),
  );
  $$('#p-layers [data-imp]').forEach(
    b =>
      (b.onclick = () => {
        const im = S.imports.find(i => i.id === b.dataset.imp);
        im.on = !im.on;
        persistImports();
        changed();
      }),
  );
  $$('#p-layers [data-theme-set]').forEach(b => (b.onclick = () => applyTheme(b.dataset.themeSet, true)));
  $('#lg-import').onclick = openImport;
}
