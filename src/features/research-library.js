import * as d3 from 'd3';
import { esc } from '../core/util.js';
import { fmtKm } from '../core/format.js';
import { GEO } from '../core/geo.js';
import {
  GEOMETRY_LABELS,
  filterResearch,
  coordinateSpread,
  referenceLine,
  researchGeometry,
  researchMetrics,
} from '../core/research.js';
import { compareLine, researchFingerprint } from '../core/line-comparison.js';
import { RESEARCH_TIMELINE } from '../data/research.js';
import { researchLibrary, researchRecord, linkedAtlasSite, siteResearchRecords } from '../domain/research.js';
import { ALLP } from '../domain/points.js';
import { S } from '../state/state.js';
import { V2 } from '../state/preferences.js';
import {
  initResearchNotebook,
  notebookSnapshot,
  researchNote,
  saveResearchNote,
  replaceNotebook,
  validateNotebook,
} from '../state/research-notebook.js';
import { ctx, kForKm, proj } from '../map/canvas.js';
import { flyTo } from '../map/camera.js';
import { req } from '../map/draw.js';
import { addDrawLayer } from '../map/hooks.js';
import { v2Back, v2ChangeTab, v2Render } from '../ui/panels.js';
import { v2Button, v2ButtonId, v2Peek } from '../ui/panel-parts.js';
import { registerAction, registerScreen } from '../ui/registry.js';
import { toast } from '../ui/intro.js';
import { setSheet, changed } from '../ui/sheet.js';
import { v2Download } from '../ui/downloads.js';
import { whenDeferredLoaded } from '../data/datasets.js';

const TABS = ['Overview', 'Sites', 'Geometry', 'Analysis', 'Sources'];
export const researchUI = {
  id: null,
  subtab: 'overview',
  query: '',
  category: 'all',
  region: 'all',
  geometry: 'all',
  view: 'featured',
  scroll: 0,
  site: null,
  preview: null,
  reference: false,
  width: 5,
  mode: 'rotate',
  pool: 'unesco',
  results: {},
  running: false,
};
let initialized = false;

import { on } from '../core/events.js';

export function exploreResearchSwitch(active = 'sites') {
  return `<div class="seg research-switch" role="group" aria-label="Explore view"><button data-v2="research-sites-home" aria-pressed="${active === 'sites'}">Sites</button><button data-v2="research-list" aria-pressed="${active === 'research'}">Research</button></div>`;
}
function selectOptions(values, selected) {
  return (
    `<option value="all">All</option>` +
    values
      .map(v => `<option value="${esc(v)}" ${v === selected ? 'selected' : ''}>${esc(v)}</option>`)
      .join('')
  );
}
function drawing(record) {
  // Original, decorative cartographic illustration; no remote imagery or licence dependency.
  const coords = record.members.map(m => [m.lon, m.lat]);
  if (!coords.length)
    return '<svg viewBox="0 0 100 72" aria-hidden="true"><path d="M10 50Q40 10 90 32M10 60Q60 20 90 50M20 10V65M50 10V65M80 10V65"/></svg>';
  const xs = coords.map(c => c[0]),
    ys = coords.map(c => c[1]),
    dx = Math.max(1, Math.max(...xs) - Math.min(...xs)),
    dy = Math.max(1, Math.max(...ys) - Math.min(...ys));
  const points = coords.map(([x, y]) => [
    12 + ((x - Math.min(...xs)) / dx) * 76,
    58 - ((y - Math.min(...ys)) / dy) * 44,
  ]);
  return `<svg viewBox="0 0 100 72" aria-hidden="true"><path class="research-grid" d="M0 18H100M0 36H100M0 54H100M25 0V72M50 0V72M75 0V72"/>${record.type === 'path' ? `<polyline points="${points.map(p => p.join(',')).join(' ')}"/>` : record.type === 'meridian' ? '<path d="M50 8V64"/>' : record.type === 'parallel' ? '<path d="M8 36H92"/>' : ''}${points.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.5"/>`).join('')}</svg>`;
}
function listResults() {
  let list = filterResearch(
    researchLibrary().collections,
    researchUI.query,
    researchUI.category,
    researchUI.region,
  ).filter(r => researchUI.geometry === 'all' || r.type === researchUI.geometry);
  if (researchUI.view === 'saved') list = list.filter(r => researchNote(r.id)?.saved);
  if (
    researchUI.view === 'featured' &&
    !researchUI.query &&
    researchUI.category === 'all' &&
    researchUI.region === 'all' &&
    researchUI.geometry === 'all'
  )
    list = ['michael', 'atlantic', 'paris', 'becker'].map(researchRecord);
  return `<p class="v2-muted" role="status">${list.length} collection${list.length === 1 ? '' : 's'}</p><div class="research-cards">${list.map(r => `<button class="research-card" data-v2="research-open" data-id="${esc(r.id)}"><span class="research-art">${drawing(r)}</span><span><span class="research-kicker">${esc(r.region)} · Research claim</span><strong>${esc(r.title)}</strong><span class="research-meta">${r.members.length} listed sites · ${esc(GEOMETRY_LABELS[r.type])}</span><span class="research-summary">${esc(r.summary.slice(0, 117))}${r.summary.length > 117 ? '…' : ''}</span></span><span aria-hidden="true">↗</span></button>`).join('') || '<p class="empty">No collections match. Reset filters or choose All.</p>'}</div>`;
}
export function researchListScreen() {
  const records = researchLibrary().collections;
  return (
    exploreResearchSwitch('research') +
    `<div class="atlas-heading research-intro"><span class="atlas-eyebrow">THE RESEARCH LIBRARY</span><h2>Research Collections</h2><p>Discover a proposal. Test the geography.</p></div><p class="research-notice">Unverified drafts · source claims and calculations are labeled separately.</p><div class="seg research-views" role="group" aria-label="Collection view">${['featured', 'all', 'saved'].map(v => `<button data-v2="research-view" data-id="${v}" aria-pressed="${v === researchUI.view}">${v[0].toUpperCase() + v.slice(1)}</button>`).join('')}</div><label class="research-field">Search collections<input type="search" data-research-filter="query" value="${esc(researchUI.query)}" placeholder="Name, place or idea"></label><details class="v2-sec research-filterbox"><summary>Filters <span class="v2-muted">Region · Topic · Geometry</span></summary><div class="research-filters"><label class="research-field">Region<select data-research-filter="region">${selectOptions([...new Set(records.map(r => r.region))], researchUI.region)}</select></label><label class="research-field">Topic<select data-research-filter="category">${selectOptions([...new Set(records.map(r => r.category))], researchUI.category)}</select></label></div><label class="research-field">Geometry<select data-research-filter="geometry">${selectOptions([...new Set(records.map(r => r.type))], researchUI.geometry)}</select></label><p class="v2-muted">All drafts need source review.</p>${v2Button('research-reset', 'Reset filters')}</details><div id="research-results">${listResults()}</div><div class="v2-actions">${v2Button('research-notebook', 'Research Notebook')}${v2Button('research-timeline', 'Timeline')}</div>`
  );
}
function memberButton(r, m, index) {
  const atlas = linkedAtlasSite(m);
  return `<button class="research-member" data-v2="research-site" data-id="${esc(r.id)}:${index}"><span class="research-number">${index + 1}</span><span><strong>${esc(m.name)}</strong><small>${atlas ? 'Linked atlas candidate' : 'Provisional site'} · ${esc(m.locationPrecision)}</small><small>${m.lat.toFixed(4)}, ${m.lon.toFixed(4)} · Source coordinate, unverified</small></span><span aria-hidden="true">↗</span></button>`;
}
function sourcesHtml(r) {
  return `<h3>Source details</h3><p>Source compilation, section: <strong>${esc(r.section)}</strong>. ${r.members.length} listed coordinate rows. App summaries are editorial paraphrases.</p>${r.claims.map(c => `<div class="v2-card"><span class="atlas-eyebrow">${c.type === 'speculation' ? 'HYPOTHESIS · UNVERIFIED' : 'EDITORIAL OBSERVATION'}</span><p>${esc(c.text)}</p><small>Attribution: ${c.sourceIds.map(id => esc(researchLibrary().sources.find(s => s.id === id).title)).join('; ')} · ${esc(c.section)}</small></div>`).join('')}${r.sourceIds
    .map(id => {
      const s = researchLibrary().sources.find(s => s.id === id);
      return `<div class="v2-card"><h3>${esc(s.title)}</h3><p>${esc(s.kind)} · ${esc(s.verification)}</p><p>${esc(s.note)}</p><p class="v2-muted">Author / publication date: not supplied. Revision: curated v1. Original document access remains private. Only location entries and editorial summaries are included here.</p></div>`;
    })
    .join(
      '',
    )}<details class="v2-sec"><summary>Methodology & rights</summary><p>Source coordinates are not independently surveyed locations. WGS84 is assumed; datum, positional accuracy and uncertainty were not supplied. Decimal places are not an accuracy estimate. Shared site names retain source-specific positions. Illustrations are original schematic graphics generated by Ley Atlas. No source document, private link, personal chart interpretation or restricted cultural route is distributed.</p></details>`;
}
function modelSelect() {
  return `<label class="research-field">Calculated model<select data-research-setting="model"><option value="endpoints" ${researchUI.model !== 'fit' ? 'selected' : ''}>First & last source points</option><option value="fit" ${researchUI.model === 'fit' ? 'selected' : ''}>Least-squares great circle · all source points</option></select></label>`;
}

function geometryHtml(r) {
  const metrics = researchMetrics(r, researchUI.model || 'endpoints');
  return `<h3>${esc(GEOMETRY_LABELS[r.type])}</h3><p>${esc(r.caveat)}</p><p class="research-notice">${r.type === 'path' ? 'Schematic joins between listed points; not a surveyed route.' : r.type === 'cluster' ? 'Source points only. No connecting edges are inferred.' : r.type === 'conceptual' ? 'Data unavailable: no unique geographic model.' : 'Reference axis and source points are shown separately.'}</p>${r.type === 'path' ? `${modelSelect()}<div class="v2-actions">${v2Button('research-reference', researchUI.reference ? 'Show source sequence' : 'Show calculated circle')}</div><p class="v2-muted">Calculated circles use the selected source points. The endpoint and least-squares models differ from the source sequence.</p>` : ''}<dl class="kv"><dt>Listed points</dt><dd>${r.members.length}</dd>${metrics.lengthKm != null ? `<dt>Schematic length</dt><dd>${fmtKm(metrics.lengthKm)}</dd>` : ''}${metrics.maxOffsetKm != null ? `<dt>Largest offset</dt><dd>${fmtKm(metrics.maxOffsetKm)}</dd>` : ''}</dl>${metrics.maxOffsetKm != null ? `<p class="v2-muted">Offsets from ${r.type === 'parallel' ? `${r.latitude}° latitude` : r.type === 'meridian' ? `${r.longitude}° longitude` : researchUI.model === 'fit' ? 'the least-squares great circle through all source rows' : 'the computed endpoint great circle'}. These measure geometry, not intent or energy.</p><div class="tblwrap"><table class="tbl"><thead><tr><th>Source site</th><th>Offset</th></tr></thead><tbody>${r.members.map((m, i) => `<tr><td>${esc(m.name)}</td><td>${fmtKm(metrics.offsets[i])}</td></tr>`).join('')}</tbody></table></div>` : ''}`;
}
export function analysisModel(record) {
  return record?.type === 'path' ? referenceLine(record, researchUI.model || 'endpoints') : null;
}
function analysisHtml(r) {
  const model = analysisModel(r),
    result = researchUI.results[r.id] || researchNote(r.id)?.investigation?.result;
  if (!model)
    return `<h3>Analysis not yet available</h3><p>${['parallel', 'meridian'].includes(r.type) ? 'Axis distances are available in Geometry. A suitable geographically matched null model is needed before a chance comparison.' : 'The source does not supply a testable straight-line model. Network, sky-correspondence and curving-route tests need a separately defined method.'}</p><p class="v2-muted">Not tested. This is distinct from a result of zero nearby sites.</p>`;
  return `<h3>Compare with chance</h3>${modelSelect()}<p>Model: ${researchUI.model === 'fit' ? 'least-squares great circle through all listed source points' : 'great circle through the first and last source points'}. This is a computed model, separate from the schematic source sequence.</p><label class="research-field">Corridor half-width (km)<input type="number" min="0.1" max="100" step="0.1" data-research-setting="width" value="${researchUI.width}"></label><label class="research-field">Independent dataset<select data-research-setting="pool">${[
    ['unesco', 'UNESCO'],
    ['fort', 'Star forts'],
    ['roman', 'Roman-era monuments'],
  ]
    .map(([v, n]) => `<option value="${v}" ${v === researchUI.pool ? 'selected' : ''}>${n}</option>`)
    .join(
      '',
    )}</select></label><label class="research-field">Control model<select data-research-setting="mode"><option value="rotate" ${researchUI.mode === 'rotate' ? 'selected' : ''}>Rotated about the start</option><option value="random" ${researchUI.mode === 'random' ? 'selected' : ''}>Anywhere on Earth</option></select></label><p class="v2-muted">2,000 controls · seed 20261108 · source anchors excluded within 300 m. Uses the same comparison engine as Analyze.</p><button class="v2-action primary" data-v2="research-run" ${researchUI.running ? 'disabled' : ''}>${researchUI.running ? 'Loading data / calculating…' : 'Run comparison'}</button>${result ? `<div class="v2-card" role="status"><span class="atlas-eyebrow">CALCULATION · EXPLORATORY</span><h3>${result.obs} sites within ±${fmtKm(result.w)}</h3><dl class="kv"><dt>Typical control</dt><dd>${result.mean.toFixed(1)}</dd><dt>Controls ≥ observed</dt><dd>${result.hist.filter(n => n >= result.obs).length} / ${result.N}</dd><dt>Exploratory p-value</dt><dd>${result.p.toFixed(4)}</dd><dt>Calculated model</dt><dd>${result.variant === 'fit' ? 'Least-squares · all rows' : 'First & last source rows'}</dd><dt>Dataset / size</dt><dd>${esc(result.ctl)} / ${result.pool}</dd><dt>Control</dt><dd>${result.mode === 'rotate' ? 'Rotated about start' : 'Anywhere on Earth'}</dd><dt>Seed</dt><dd>${result.seed}</dd></dl><p>${esc(result.coverage)}</p><p class="v2-muted">Result parameters are listed here; changing the controls above does not change this result until rerun. No correction for choosing this proposal from many candidates; this is not confirmatory significance.</p>${researchUI.results[r.id] ? v2Button('research-save-run', 'Save investigation') : '<p class="v2-muted">Saved on this device</p>'}</div>` : '<p class="v2-muted">Not tested.</p>'}<div class="v2-actions">${v2Button('research-promote', 'Save model & open Analyze')}</div><p class="v2-muted">Creates a personal line with provenance. Your working line is retained.</p><details class="v2-sec"><summary>Methodology & limitations</summary><p>Counts independent dataset sites near one full great circle, then repeats with randomized bearings. Rotation keeps the source start fixed. Anywhere on Earth includes oceans and can flatter land-based proposals. Source anchor positions within 300 m are excluded. The dataset distribution, source selection, endpoint choice, incomplete coverage and repeated trials can bias results. This does not test a physical energy mechanism or verify the entire source route. The existing project’s selection-adjusted line-match method remains separate.</p></details>`;
}
export function researchDetailScreen() {
  const r = researchRecord(researchUI.id);
  if (!r) return researchListScreen();
  const note = researchNote(r.id);
  const content = {
    overview: () =>
      `<div class="research-hero">${drawing(r)}</div><h3>A proposal to investigate</h3><p>${esc(r.summary)} ${esc(r.claim)}</p><p>${esc(r.caveat)}</p><p class="v2-muted">${r.members.length} source-listed locations · ${esc(r.region)}. Coordinates, source accounts and app calculations have separate status. Open Sources for attribution and review limits.</p><div class="v2-actions">${v2ButtonId('research-tab', 'sites', 'Show sites')}${v2Button('research-bookmark', note?.saved ? 'Remove bookmark' : 'Bookmark')}</div><label class="research-field">Research note<textarea data-research-note="${esc(r.id)}" rows="4" maxlength="20000" placeholder="Your observations, kept on this device">${esc(note?.text || '')}</textarea></label><small id="research-note-status" role="status">Notes save on this device. Export a backup to keep a separate copy.</small>`,
    sites: () =>
      r.members.map((m, i) => memberButton(r, m, i)).join('') ||
      '<p class="empty">No coordinate table is available for this proposal.</p>',
    geometry: () => geometryHtml(r),
    analysis: () => analysisHtml(r),
    sources: () => sourcesHtml(r),
  };
  return (
    v2Peek(esc(r.title)) +
    `<div class="research-detail"><div class="research-heading"><span class="atlas-eyebrow">${esc(r.region)} · RESEARCH CLAIM</span><h2>${esc(r.title)}</h2><p class="v2-muted">Unverified research draft · version ${r.version}</p><div class="v2-actions">${r.members.length ? v2Button('research-preview', researchUI.preview?.id === r.id ? 'Refit preview' : 'Preview on map', 'primary') : ''}${researchUI.preview ? v2Button('research-stop', 'Close preview') : ''}</div></div><div class="research-tabs" role="tablist" aria-label="Collection details">${TABS.map(t => `<button id="research-tab-${t.toLowerCase()}" role="tab" aria-selected="${researchUI.subtab === t.toLowerCase()}" aria-controls="research-content" tabindex="${researchUI.subtab === t.toLowerCase() ? 0 : -1}" data-v2="research-tab" data-id="${t.toLowerCase()}">${t}</button>`).join('')}</div><section id="research-content" role="tabpanel" aria-labelledby="research-tab-${researchUI.subtab}" tabindex="0">${content[researchUI.subtab]()}</section></div>`
  );
}
function siteScreen() {
  const r = researchRecord(researchUI.id),
    m = r?.members[researchUI.site];
  if (!m) return researchDetailScreen();
  const s = researchLibrary().sites.find(s => s.id === m.siteId),
    atlas = linkedAtlasSite(m);
  return `<span class="atlas-eyebrow">PROVISIONAL RESEARCH SITE</span><h2>${esc(m.name)}</h2><p>${m.lat}, ${m.lon} · ${esc(m.status)}</p><p>${esc(m.locationPrecision)}. Accuracy unknown. Source datum unspecified; WGS84 assumed for display.</p>${atlas ? `<div class="v2-card"><h3>Atlas candidate</h3><p>${esc(atlas.n)} · ${esc(atlas.reg || 'Region not recorded')}${atlas.built ? ` · ${esc(atlas.built)}` : ''}</p><p>Atlas position: ${atlas.lat.toFixed(5)}, ${atlas.lon.toFixed(5)}. Source position is retained separately.</p><p class="v2-muted">${esc(atlas.srcLabel || atlas.vNote || 'See the existing atlas record for provenance.')}</p></div>` : '<p>No canonical atlas match has been confirmed. This entry is not added to default site datasets.</p>'}<h3>Coordinate provenance</h3><p>${coordinateSpread(s) > 0 ? `Source variants differ by up to ${fmtKm(coordinateSpread(s))} from the first listing.` : 'No differing coordinate in these included records.'}</p>${s.positions.map(p => `<div class="v2-card"><strong>${esc(researchRecord(p.recordId).title)}</strong><p>${p.lat}, ${p.lon}</p><small>${esc(p.sourceEntryId)} · ${esc(p.section)}</small><p class="v2-muted">Source label: ${esc(p.originalName)}${p.originalRegion ? ` · ${esc(p.originalRegion)}` : ''}${p.originalLatitude ? `<br>Original coordinates: ${esc(p.originalLatitude)}, ${esc(p.originalLongitude)}` : ''}</p></div>`).join('')}<h3>Related research</h3>${s.recordIds.map(id => v2ButtonId('research-open', id, researchRecord(id).title)).join('')}<div class="v2-actions">${v2Button('research-return', 'Back to collection')}</div>`;
}
function timelineScreen() {
  return `<div class="atlas-heading"><span class="atlas-eyebrow">HISTORY & CONTEXT</span><h2>Research Timeline</h2><p>Accounts in the supplied compilations, not independently verified chronology.</p></div>${RESEARCH_TIMELINE.map(t => `<article class="v2-card"><span class="atlas-eyebrow">${t.year} · ${esc(t.status)}</span><h3>${esc(t.label)}</h3><p>${esc(t.text)}</p><small>${t.sourceIds.map(id => esc(researchLibrary().sources.find(s => s.id === id).title)).join(' · ')}</small><div class="v2-actions">${v2ButtonId('research-open', t.recordId, 'View context')}</div></article>`).join('')}<p class="v2-muted">Site construction dates are shown only where the existing atlas provides them; no date ranges are inferred from ley claims.</p>`;
}
function notebookScreen() {
  const entries = notebookSnapshot().entries;
  return `<div class="atlas-heading"><span class="atlas-eyebrow">ON THIS DEVICE</span><h2>Research Notebook</h2><p>Bookmarks, notes and reproducible investigation snapshots. No notes are uploaded.</p></div><div class="v2-actions">${v2Button('research-export', 'Export notebook')}<label class="v2-action filebtn">Import & merge<input type="file" data-research-import accept=".json,application/json" hidden></label></div><p class="v2-muted">Full app backups also include this notebook. Import merges new collections; conflicting local entries are preserved.</p>${
    entries
      .map(e => {
        const r = researchRecord(e.recordId),
          changed = e.investigation && e.investigation.collectionFingerprint !== researchFingerprint(r);
        return `<article class="v2-card"><h3>${esc(r.title)}</h3><p>${esc(e.text || (e.saved ? 'Bookmarked' : 'Saved investigation'))}</p>${e.investigation ? `<p>${changed ? 'Collection changed since this investigation; rerun before comparing.' : 'Collection version matches the saved snapshot.'}</p><small>Fingerprint ${esc(e.investigation.fingerprint)} · ${esc(e.updatedAt)}</small>` : ''}<div class="v2-actions">${v2ButtonId('research-open', r.id, 'Open collection')}</div></article>`;
      })
      .join('') || '<p class="empty">Bookmark a collection or add a note to begin.</p>'
  }`;
}

export function openResearch(id) {
  if (!researchRecord(id)) return;
  if (V2.tab === 'research') researchUI.scroll = document.querySelector('#v2panel')?.scrollTop || 0;
  stopResearchPreview(true);
  researchUI.id = id;
  const result = researchUI.results[id] || researchNote(id)?.investigation?.result;
  if (result)
    Object.assign(researchUI, {
      width: result.w,
      model: result.variant || 'endpoints',
      pool: result.ctl,
      mode: result.mode,
    });
  researchUI.subtab = 'overview';
  researchUI.reference = false;
  v2ChangeTab('research-detail');
  setSheet('half');
}
export function startResearchPreview() {
  const r = researchRecord(researchUI.id);
  if (!r?.members.length) return;
  if (!researchUI.preview) researchUI.preview = { id: r.id, camera: { ...S.cam } };
  const members = r.members,
    centre = d3.geoCentroid({ type: 'MultiPoint', coordinates: members.map(m => [m.lon, m.lat]) });
  const span = Math.max(5, ...members.map(m => GEO.dist(centre[1], centre[0], m.lat, m.lon))) * 3;
  flyTo(centre[0], centre[1], kForKm(span), 500);
  setSheet('half');
  v2Render();
  req();
}
export function stopResearchPreview(restore = true) {
  const previous = researchUI.preview;
  researchUI.preview = null;
  if (restore && previous) flyTo(previous.camera.lon, previous.camera.lat, previous.camera.k, 0);
  req();
}
function drawPreview(P, path) {
  if (!researchUI.preview || !['research-detail', 'research-site'].includes(V2.tab)) return;
  const r = researchRecord(researchUI.preview.id);
  ctx.save();
  ctx.strokeStyle = '#c38a28';
  ctx.fillStyle = '#c38a28';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([5, 4]);
  for (const feature of researchGeometry(r, researchUI.reference, researchUI.model || 'endpoints').features) {
    ctx.beginPath();
    path(feature);
    if (feature.geometry.type === 'Point') ctx.fill();
    else ctx.stroke();
  }
  ctx.restore();
}
async function runResearchComparison() {
  const record = researchRecord(researchUI.id),
    line = analysisModel(record);
  if (!line || researchUI.running) return;
  const config = {
    width: researchUI.width,
    mode: researchUI.mode,
    pool: researchUI.pool,
    variant: researchUI.model || 'endpoints',
  };
  if (!Number.isFinite(config.width) || config.width < 0.1 || config.width > 100) {
    toast('Choose a corridor from 0.1 to 100 km');
    return;
  }
  researchUI.running = true;
  v2Render();
  try {
    await new Promise(resolve => whenDeferredLoaded(resolve));
    await new Promise(resolve => setTimeout(resolve, 30));
    const pool = ALLP.filter(p =>
      config.pool === 'fort' ? p.cat === 'fort' && ['fort', 'core'].includes(p.set) : p.set === config.pool,
    ).filter(p => !record.members.some(m => GEO.dist(m.lat, m.lon, p.lat, p.lon) < 0.3));
    if (!pool.length) throw new Error('Dataset unavailable');
    const result = compareLine(line, pool, config.width, config.mode);
    researchUI.results[record.id] = {
      ...result,
      variant: config.variant,
      ctl: config.pool,
      coverage: 'Bundled dataset coverage is incomplete; catalogue dates and location accuracy vary.',
      datasetFingerprint: researchFingerprint(pool.map(p => [p.id, p.lat, p.lon])),
      collectionFingerprint: researchFingerprint(record),
      createdAt: new Date().toISOString(),
    };
  } catch {
    toast('Comparison unavailable. Check that the datasets have finished loading.');
  } finally {
    researchUI.running = false;
    if (V2.tab === 'research-detail') v2Render();
  }
}
import { v2LineChanged } from './discovery.js';
function promoteResearchModel() {
  const record = researchRecord(researchUI.id),
    line = analysisModel(record);
  if (!line) return;
  const key = researchFingerprint({ record, variant: researchUI.model || 'endpoints' });
  let saved = S.userLines.find(
    l =>
      l.researchKey === key &&
      l.brg === line.brg &&
      l.o[0] === line.o[0] &&
      l.o[1] === line.o[1] &&
      l.len === null,
  );
  if (!saved) {
    saved = {
      id: 'u-research-' + Date.now() + '-' + S.userLines.length,
      name: record.title + ' · calculated ' + (researchUI.model === 'fit' ? 'fit' : 'endpoint circle'),
      o: [...line.o],
      brg: line.brg,
      len: null,
      anchors: [...new Set(record.members.map(m => linkedAtlasSite(m)?.id).filter(Boolean))],
      researchId: record.id,
      researchKey: key,
      sourcePositions: record.members.map(m => ({ lat: m.lat, lon: m.lon, sourceEntryId: m.sourceEntryId })),
      note: 'Computed research model from unverified source coordinates; not evidence of energy or construction intent.',
    };
    S.userLines.push(saved);
  }
  S.active = saved.id;
  S.layers.user = true;
  changed();
  v2LineChanged();
  v2ChangeTab('analyze');
}

function saveInvestigation() {
  const r = researchRecord(researchUI.id),
    result = researchUI.results[r.id];
  if (!result) return;
  const investigation = {
    collectionVersion: r.version,
    collectionFingerprint: researchFingerprint(r),
    sourceRevisions: r.sourceIds.map(id => ({ id, version: 1 })),
    variant: result.variant || 'endpoints',
    siteIds: r.members.map(m => m.siteId),
    camera: { ...S.cam },
    layers: structuredClone(S.layers),
    corridorKm: result.w,
    result: structuredClone(result),
  };
  investigation.fingerprint = researchFingerprint(investigation);
  try {
    saveResearchNote(r.id, researchNote(r.id)?.text || '', true, investigation);
    toast('Investigation saved on this device');
  } catch {
    toast('Could not save. Export your notebook to keep a copy.');
  }
}
export function researchSiteLinks(site) {
  const records = siteResearchRecords(site);
  return records.length
    ? `<div class="v2-card"><h3>Related research</h3><p class="v2-muted">Source-listed candidate; membership does not verify an alignment.</p>${records.map(r => v2ButtonId('research-open', r.id, r.title)).join('')}</div>`
    : '';
}
import { registerMapTapHandler } from '../ui/map-taps.js';
function previewTap(x, y) {
  if (!researchUI.preview || !['research-detail', 'research-site'].includes(V2.tab)) return false;
  const record = researchRecord(researchUI.preview.id),
    projection = proj();
  const near = record.members
    .map((m, index) => {
      if (S.view === 'globe' && d3.geoDistance([S.cam.lon, S.cam.lat], [m.lon, m.lat]) > Math.PI / 2)
        return { index, d: Infinity };
      const p = projection([m.lon, m.lat]);
      return { index, d: p ? Math.hypot(p[0] - x, p[1] - y) : Infinity };
    })
    .sort((a, b) => a.d - b.d)[0];
  if (!near || near.d > 18) return false;
  researchUI.site = near.index;
  v2ChangeTab('research-site');
  return true;
}

export function initResearchLibrary() {
  initResearchNotebook();
  researchLibrary();
  registerScreen('research', researchListScreen, {
    title: 'Research',
    parent: 'explore',
    history: true,
  });
  registerScreen('research-detail', researchDetailScreen, {
    title: 'Collection',
    parent: 'research',
    history: true,
    capture: () => ({ id: researchUI.id, subtab: researchUI.subtab }),
    restore: state => {
      if (researchRecord(state?.id)) {
        researchUI.id = state.id;
        researchUI.subtab = TABS.some(t => t.toLowerCase() === state.subtab) ? state.subtab : 'overview';
      }
    },
  });
  registerScreen('research-site', siteScreen, {
    title: 'Research Site',
    parent: 'research-detail',
    history: true,
  });
  registerScreen('research-notebook', notebookScreen, {
    title: 'Research Notebook',
    parent: 'research',
    history: true,
  });
  registerScreen('research-timeline', timelineScreen, {
    title: 'Timeline',
    parent: 'research',
    history: true,
  });
  registerAction('research-sites-home', () => v2ChangeTab('explore'));
  registerAction('research-list', () => v2ChangeTab('research'));
  registerAction('research-open', openResearch);
  registerAction('research-view', view => {
    if (['all', 'featured', 'saved'].includes(view)) {
      researchUI.view = view;
      v2Render();
    }
  });
  registerAction('research-tab', tab => {
    if (!TABS.some(t => t.toLowerCase() === tab)) return;
    researchUI.subtab = tab;
    v2Render();
    document.querySelector(`#research-tab-${tab}`)?.focus();
  });
  registerAction('research-site', id => {
    const [record, index] = id.split(':');
    if (!researchRecord(record)?.members[+index]) return;
    researchUI.id = record;
    researchUI.site = +index;
    v2ChangeTab('research-site');
  });
  registerAction('research-return', v2Back);
  registerAction('research-preview', startResearchPreview);
  registerAction('research-stop', () => {
    stopResearchPreview();
    v2Render();
  });
  registerAction('research-reference', () => {
    researchUI.reference = !researchUI.reference;
    v2Render();
    req();
  });
  registerAction('research-reset', () => {
    Object.assign(researchUI, { query: '', category: 'all', region: 'all', geometry: 'all', view: 'all' });
    v2Render();
  });
  registerAction('research-notebook', () => v2ChangeTab('research-notebook'));
  registerAction('research-timeline', () => v2ChangeTab('research-timeline'));
  registerAction('research-bookmark', () => {
    const note = researchNote(researchUI.id);
    try {
      saveResearchNote(researchUI.id, note?.text || '', !note?.saved);
      v2Render();
    } catch {
      toast('Notebook storage is full or unavailable');
    }
  });
  registerAction('research-export', () =>
    v2Download('ley-atlas-notebook.json', JSON.stringify(notebookSnapshot(), null, 2), 'application/json'),
  );
  registerAction('research-run', runResearchComparison);
  registerAction('research-save-run', saveInvestigation);
  registerAction('research-promote', promoteResearchModel);
  if (initialized) return;
  initialized = true;
  registerMapTapHandler(previewTap);
  on('ui:screen', tab => {
    if (researchUI.preview && !['research-detail', 'research-site'].includes(tab)) stopResearchPreview(false);
  });
  addDrawLayer('top', drawPreview);
  on('ui:navigate', (previous, next) => {
    if (previous === 'research') researchUI.scroll = document.querySelector('#v2panel')?.scrollTop || 0;
    if (next === 'research' && innerWidth < 700) setSheet('full');
    if (next === 'research')
      setTimeout(() => {
        const panel = document.querySelector('#v2panel');
        if (V2.tab === 'research') panel.scrollTop = researchUI.scroll;
      }, 0);
    if (!['research-detail', 'research-site'].includes(next)) stopResearchPreview(true);
  });
  document.querySelector('#v2panel').addEventListener('input', e => {
    const target = e.target;
    if (target.dataset.researchFilter) {
      researchUI[target.dataset.researchFilter] = target.value;
      document.querySelector('#research-results').innerHTML = listResults();
    }
    if (target.dataset.researchSetting) {
      researchUI[target.dataset.researchSetting] =
        target.dataset.researchSetting === 'width' ? Number(target.value) : target.value;
      if (target.dataset.researchSetting === 'model') {
        v2Render();
        req();
      }
    }
    if (target.dataset.researchNote) {
      const status = document.querySelector('#research-note-status');
      try {
        saveResearchNote(
          target.dataset.researchNote,
          target.value,
          researchNote(target.dataset.researchNote)?.saved || false,
        );
        status.textContent = 'Saved on this device';
      } catch {
        status.textContent = 'Could not save. Copy this note before leaving.';
      }
    }
  });
  document.querySelector('#v2panel').addEventListener('keydown', e => {
    if (e.target.getAttribute('role') !== 'tab') return;
    const index = TABS.findIndex(t => t.toLowerCase() === researchUI.subtab);
    const next =
      e.key === 'ArrowRight'
        ? (index + 1) % 5
        : e.key === 'ArrowLeft'
          ? (index + 4) % 5
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? 4
              : null;
    if (next == null) return;
    e.preventDefault();
    researchUI.subtab = TABS[next].toLowerCase();
    v2Render();
    document.querySelector(`#research-tab-${researchUI.subtab}`).focus();
  });
  document.querySelector('#v2panel').addEventListener('change', async e => {
    if (!e.target.matches('[data-research-import]')) return;
    const file = e.target.files[0];
    if (!file) return;
    try {
      if (file.size > 2000000) throw new Error('Too large');
      const incoming = validateNotebook(JSON.parse(await file.text())),
        current = notebookSnapshot();
      let conflicts = 0;
      for (const entry of incoming.entries) {
        const old = current.entries.find(e => e.recordId === entry.recordId);
        if (!old) current.entries.push(entry);
        else if (JSON.stringify(old) !== JSON.stringify(entry)) conflicts++;
      }
      replaceNotebook(current);
      toast(
        conflicts ? `Imported new entries; kept ${conflicts} existing local entries` : 'Notebook imported',
      );
      v2Render();
    } catch {
      toast('That notebook could not be read. Your existing notebook is unchanged.');
    }
  });
}
