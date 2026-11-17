// Layers panel
import { sw } from '../render/icons.js';
import { $, $$, esc, nf } from '../core/util.js';
import { UNAVAILABLE } from '../data/catalog.js';
import { MEGALITHS } from '../data/datasets.js';
import { INTS } from '../domain/analysis.js';
import { LINEBY, LINES, activeLine } from '../domain/lines.js';
import { CASE_STUDIES } from '../domain/case-studies.js';
import { ALLP, BASE, srcOn } from '../domain/points.js';
import { SOURCES, TYPES } from '../domain/site-types.js';
import { openImport } from '../features/import.js';
import { UG, UGBIT, depData } from '../domain/underground.js';
import { req } from '../map/draw.js';
import { fmtKm } from '../core/format.js';
import { setView } from '../map/interaction.js';
import { tag } from './lines-pane.js';
import { S, persistImports } from '../state/state.js';
import { toast, toastUndo } from '../ui/intro.js';
import { renderKey, setFocus } from '../ui/map-chrome.js';
import { v2SwipeRow } from '../ui/panel-parts.js';
import { v2DisplayOptionsHtml } from '../ui/screens/menu.js';
import { changed, keepScroll } from '../ui/sheet.js';
import { applyTheme, THEME } from '../ui/theme.js';
import { v2Persist } from '../state/preferences.js';
import { v2LineStyleHtml } from '../ui/screens/menu.js';

let OPEN = { types: false, under: false, lines: false, display: true, sources: true, examples: false };
let UGCOUNT = null;
/** Forget the per-mineral record counts (the deposits dataset changed). */
export function resetLayerCounts() {
  UGCOUNT = null;
}

const APPEARANCE_OPEN = {};
export function renderAppearance() {
  const root = $('#p-appearance');
  $$('#p-appearance details[data-appearance]').forEach(d => {
    APPEARANCE_OPEN[d.dataset.appearance] = d.open;
  });
  const focused = document.activeElement;
  const focusAttr = [...(focused?.attributes || [])].find(a =>
    ['data-zm', 'data-ugs-dep', 'data-ugs-fault', 'data-linecol', 'data-theme-set'].includes(a.name),
  );
  renderLayers('appearance', '#p-appearance');
  const body = root.querySelector('[data-g="display"] > .body');
  const sections = document.createDocumentFragment();
  let section;
  for (const node of [...body.children]) {
    if (node.matches('h3.sub')) {
      const title = node.textContent;
      const detail = document.createElement('details');
      detail.className = 'grp';
      detail.dataset.appearance = title;
      detail.open = !!APPEARANCE_OPEN[title];
      const summary = document.createElement('summary');
      summary.textContent = title;
      section = document.createElement('div');
      section.className = 'body';
      detail.append(summary, section);
      sections.append(detail);
    } else section.append(node);
  }
  root.replaceChildren(sections);
  root.insertAdjacentHTML(
    'afterbegin',
    `<div class="v2-card"><h2>Theme</h2><div class="seg" role="group" aria-label="Theme"><button data-theme-set="light" aria-pressed="${THEME === 'light'}">Light</button><button data-theme-set="dark" aria-pressed="${THEME === 'dark'}">Dark</button></div></div>`,
  );
  root.insertAdjacentHTML('beforeend', v2LineStyleHtml());
  const lineStyle = root.querySelector('[data-appearance="line"]');
  lineStyle.open = !!APPEARANCE_OPEN.line;
  $$('#p-appearance [data-theme-set]').forEach(b => (b.onclick = () => applyTheme(b.dataset.themeSet, true)));
  if (focusAttr)
    root.querySelector(`[${focusAttr.name}="${focusAttr.value}"]`)?.focus({ preventScroll: true });
}
export function renderLayers(view = 'layers', target = '#p-layers') {
  $$(target + ' details[data-g]').forEach(d => (OPEN[d.dataset.g] = d.open));
  const row = (key, title, sub, cls, on, swk, disabled, attr = 'data-layer') =>
    `<div class="lg ${on ? '' : 'off'}">${sw(swk || key)}<div class="t"><b>${esc(title)}</b>${sub ? `<span>${sub}</span>` : ''}${cls ? tag(cls) : ''}</div><button class="tog" role="switch" aria-checked="${on}" aria-label="${esc(title)}" ${attr}="${key}" ${disabled ? 'disabled' : ''}></button></div>`;
  const L = activeLine(),
    swf = LINEBY.swordfit,
    tsf = LINEBY.torsapfit;
  const typeCount = c => ALLP.filter(p => p.cat === c && srcOn(p)).length;
  const srcCount = s => BASE.filter(p => p.set === s).length;
  const grp = (id, title, cnt, body) =>
    `<details class="grp" data-g="${id}" ${OPEN[id] ? 'open' : ''}><summary>${esc(title)} ${cnt ? `<span class="cnt">${cnt}</span>` : ''}</summary><div class="body">${body}</div></details>`;
  const typesOn = TYPES.filter(([k]) => S.layers.cat[k]).length;
  const underOn = Object.keys(S.under).filter(k => S.under[k]).length;
  const exampleKeys = [
    'primary',
    'bestfit',
    'sword',
    'swordfit',
    'torsap',
    'torsapfit',
    'duff',
    'meridian',
    'viasacra',
  ];
  const removedStudies = CASE_STUDIES.filter(c => S.removedCaseStudies.includes(c.id));
  const studies = CASE_STUDIES.filter(c => !S.removedCaseStudies.includes(c.id));
  const availableExamples = exampleKeys.filter(
    k => !removedStudies.some(c => c.lineId === k || c.fitId === k),
  );
  const examplesOn = availableExamples.filter(k => S.layers[k]).length;
  const myLines = (S.work ? 1 : 0) + S.userLines.length;
  const sub = (id, title, cnt, body) =>
    `<details class="grp sub" data-g="${id}" ${OPEN[id] ? 'open' : ''}><summary>${esc(title)} <span class="cnt">${cnt}</span></summary><div class="body">${body}</div></details>`;
  $(target).innerHTML = `
  ${
    view === 'layers'
      ? grp(
          'types',
          'Sites',
          `${typesOn} of ${TYPES.length} types on`,
          `<p class="small" style="margin:0 0 4px">One switch per kind of site.</p>
    <div class="lyr-bulk"><button class="btn" data-allcat="1">All on</button><button class="btn" data-allcat="0">All off</button></div>` +
            TYPES.map(([k, t]) => {
              const n = typeCount(k);
              return `<div class="lg ${S.layers.cat[k] ? '' : 'off'}">${sw(k)}<div class="t"><b>${esc(t)}</b><span>${nf(n)} site${n === 1 ? '' : 's'}</span></div><button class="tog" role="switch" aria-checked="${S.layers.cat[k]}" aria-label="${esc(t)}" data-cat="${k}"></button></div>`;
            }).join(''),
        )
      : ''
  }
  ${
    view === 'layers'
      ? grp(
          'under',
          'Underground',
          underOn ? `${underOn} on` : 'all off',
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
    ${ug('mag', 'Magnetic field (world, land and sea)', 'Red = stronger than average (magnetic rock), blue = weaker. NOAA EMM2017 world model at about 25 km detail; Britain shows its 2 km survey.', 'mag')}
    <div class="lyr-bulk"><button class="btn" data-v2="layers-clear">Switch all underground off</button></div>`;
          })(),
        )
      : ''
  }
  ${
    view === 'layers'
      ? grp(
          'lines',
          'Lines',
          `${myLines} of yours${examplesOn ? ` · ${examplesOn} example${examplesOn === 1 ? '' : 's'} on` : ''}`,
          `
    ${row('user', 'Working line & saved lines', (S.work ? '1 working · ' : '') + S.userLines.length + ' saved', 'user', S.layers.user)}
    ${S.focus ? `<div class="notebar"><span style="flex:1">Showing <b>one line</b>: ${L ? esc(L.short || L.name) : 'none chosen yet'}. Example lines show when you show all lines.</span><button class="btn" id="lg-all">Show all</button></div>` : `<div class="notebar"><span style="flex:1">Showing <b>all enabled lines</b>.</span><button class="btn" id="lg-one">Only the active line</button></div>`}` +
            sub(
              'examples',
              'Example and published lines',
              `${examplesOn} of ${availableExamples.length} on`,
              `
    ${studies
      .map(
        c => `
      <div class="notebar"><h3 class="sub" style="flex:1">Case study: ${esc(c.title)}</h3><button class="btn" data-remove-study="${esc(c.id)}" aria-label="Remove ${esc(c.title)} case study">Remove</button></div>
      ${row(c.lineId, c.title + ' line', 'Obelisk → Castel Sant’Angelo, around the globe', 'projection', S.layers[c.lineId])}
      ${row(c.fitId, 'Best fit through all three anchors', 'Least-squares great circle incl. St. Peter’s', 'projection', S.layers[c.fitId])}
    `,
      )
      .join('')}
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
    ${removedStudies.length ? `<details class="grp sub" data-g="removed-studies" ${OPEN['removed-studies'] ? 'open' : ''}><summary>Removed case studies <span class="cnt">${removedStudies.length}</span></summary><div class="body"><p class="small">Removed from this device. Restoring keeps the lines switched off.</p>${removedStudies.map(c => `<div class="notebar"><span style="flex:1">${esc(c.title)}</span><button class="btn" data-restore-study="${esc(c.id)}" aria-label="Restore ${esc(c.title)} case study">Restore</button></div>`).join('')}</div></details>` : ''}
`,
            ),
        )
      : ''
  }
  ${
    view === 'appearance'
      ? grp(
          'display',
          'Map style',
          '',
          v2DisplayOptionsHtml() +
            `<h3 class="sub">Overlays</h3>
    ${row('corridor', 'Proximity corridor', `±${fmtKm(S.corridorKm)} around the line on the map`, '', S.layers.corridor)}
    ${row('intersections', 'Line crossings', S.focus ? 'Needs more than one line on the map' : `${INTS.filter(x => !(S.hideTrivial && x.trivial)).length} shown`, '', S.layers.intersections)}
    ${row('outlines', 'Fort outlines', 'Traced footprints (OpenStreetMap), drawn when zoomed in', '', S.layers.outlines, 'outline')}
    ${row('labels', 'Labels', '', '', S.layers.labels, 'label')}` +
            row(
              'stonework',
              'Mark precision stonework',
              `Diamond ring on the ${MEGALITHS.length} sites scored for masonry (Göbekli Tepe, Baalbek, Puma Punku…)`,
              '',
              S.layers.stonework,
              'stonework',
            ) +
            `<h3 class="sub">Background map</h3>
    ${row('places', 'Cities & towns', '', '', S.layers.places, 'places')}
    ${row('rivers', 'Rivers', '', '', S.layers.rivers, 'river')}
    ${row('borders', 'Country borders', '', '', S.layers.borders, 'border')}
    ${row('sat', 'Satellite imagery (2D)', S.satFailed ? 'Unavailable in this viewer.' : 'Esri World Imagery where the viewer allows it', '', S.layers.sat && !S.satFailed, 'sat', S.satFailed)}`,
        )
      : ''
  }
  ${
    view === 'sources'
      ? sub(
          'sources',
          'Datasets',
          `${Object.keys(SOURCES).filter(k => S.src[k]).length} lists on`,
          `<p class="small" style="margin:0 0 4px">Enable datasets here. Choose site types in Layers.</p>
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
      )}${S.imports.length ? '<p class="small" style="margin:4px 0">Use × to remove an import, or swipe left.</p>' : ''}
`,
        )
      : ''
  }`;
  const refreshStudies = () => {
    changed();
    keepScroll(target, () => renderLayers(view, target));
  };
  $$(target + ' [data-remove-study]').forEach(b => {
    b.onclick = () => {
      const c = studies.find(c => c.id === b.dataset.removeStudy);
      if (!c) return;
      const layers = { [c.lineId]: S.layers[c.lineId], [c.fitId]: S.layers[c.fitId] };
      const previousActive = [c.lineId, c.fitId].includes(S.active) ? S.active : null;
      S.removedCaseStudies = [...new Set([...S.removedCaseStudies, c.id])];
      S.layers[c.lineId] = false;
      S.layers[c.fitId] = false;
      if (previousActive) S.active = null;
      refreshStudies();
      const restore = $(target + ' [data-restore-study="' + c.id + '"]');
      if (restore) {
        restore.closest('details').open = true;
        restore.focus({ preventScroll: true });
      }
      toastUndo('Removed “' + c.title + '”', () => {
        S.removedCaseStudies = S.removedCaseStudies.filter(id => id !== c.id);
        Object.assign(S.layers, layers);
        if (previousActive && !S.active) S.active = previousActive;
        refreshStudies();
        $(target + ' [data-remove-study="' + c.id + '"]')?.focus({ preventScroll: true });
      });
    };
  });
  $$(target + ' [data-restore-study]').forEach(b => {
    b.onclick = () => {
      const c = removedStudies.find(c => c.id === b.dataset.restoreStudy);
      if (!c) return;
      S.removedCaseStudies = S.removedCaseStudies.filter(id => id !== c.id);
      S.layers[c.lineId] = false;
      S.layers[c.fitId] = false;
      refreshStudies();
      $(target + ' [data-remove-study="' + c.id + '"]')?.focus({ preventScroll: true });
      toast('Restored “' + c.title + '”. Its lines are switched off.');
    };
  });
  $$(target + ' details.grp').forEach(
    d =>
      (d.ontoggle = () => {
        if (!d.isConnected) return;
        OPEN[d.dataset.g] = d.open;
        // one main group open at a time keeps the screen short
        if (d.open && !d.classList.contains('sub'))
          $$(target + ' > details.grp').forEach(o => {
            if (o !== d) o.open = false;
          });
      }),
  );
  $$(target + ' [data-allcat]').forEach(
    b =>
      (b.onclick = () => {
        for (const [k] of TYPES) S.layers.cat[k] = b.dataset.allcat === '1';
        changed();
      }),
  );
  if ($('#lg-all')) $('#lg-all').onclick = () => setFocus(false);
  if ($('#lg-one')) $('#lg-one').onclick = () => setFocus(true);
  $$(target + ' [data-layer]').forEach(
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
  $$(target + ' [data-ug]').forEach(
    b =>
      (b.onclick = () => {
        const k = b.dataset.ug;
        S.under[k] = !S.under[k];
        if (k === 'mag' && S.under.mag) {
          toast('Magnetic field: red = stronger than average, blue = weaker.', 3500);
        }
        keepScroll(target, () => renderLayers(view, target));
        v2Persist();
        renderKey();
        req();
      }),
  );
  $$(target + ' [data-src]').forEach(
    b =>
      (b.onclick = () => {
        const k = b.dataset.src;
        S.src[k] = !S.src[k];
        changed();
      }),
  );
  $$(target + ' [data-cat]').forEach(
    b =>
      (b.onclick = () => {
        const k = b.dataset.cat;
        S.layers.cat[k] = !S.layers.cat[k];
        changed();
      }),
  );
  $$(target + ' [data-imp]').forEach(
    b =>
      (b.onclick = () => {
        const im = S.imports.find(i => i.id === b.dataset.imp);
        im.on = !im.on;
        persistImports();
        changed();
      }),
  );
  $$(target + ' [data-theme-set]').forEach(b => (b.onclick = () => applyTheme(b.dataset.themeSet, true)));
  if ($('#lg-import')) $('#lg-import').onclick = openImport;
}
