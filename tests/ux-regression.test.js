// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadDatasets, loadDeferredDatasets } from '../src/data/datasets.js';
import { initPoints, rebuildPoints, findPoint, ALLP } from '../src/domain/points.js';
import { initLines, buildLines, activeLine, LINEBY, LINES } from '../src/domain/lines.js';
import { analyse } from '../src/domain/analysis.js';
import { S, initState, persist, KEY } from '../src/state/state.js';
import { changed } from '../src/ui/sheet.js';
import { openLinePicker } from '../src/ui/picker.js';
import { V2, initPreferences, v2Persist } from '../src/state/preferences.js';
import { GEO } from '../src/core/geo.js';
import { PAL, setC, buildSTY } from '../src/render/palette.js';
import { v2Discover } from '../src/features/discovery.js';
import { renderLayers, renderAppearance } from '../src/panels/layers-pane.js';
import { renderData, stateCode, loadState } from '../src/panels/data-pane.js';
import { initPanels, v2Back } from '../src/ui/panels.js';
import { runAction } from '../src/ui/registry.js';
import { NAVIGATION } from '../src/ui/navigation.js';
import { v2Saved } from '../src/ui/screens/menu.js';
import { renderLab } from '../src/features/random-test.js';
import { initEvents } from '../src/ui/events.js';

vi.mock('../src/map/draw.js', () => ({ req: vi.fn(), setBC: vi.fn(), draw: vi.fn() }));
vi.mock('../src/ui/map-chrome.js', () => ({
  renderKey: vi.fn(),
  renderChrome: vi.fn(),
  setFocus: vi.fn(),
  lineSw: vi.fn(() => ''),
}));
vi.mock('../src/ui/sheet.js', () => ({
  changed: vi.fn(),
  keepScroll: (_target, fn) => fn(),
  renderTab: vi.fn(),
  selectTab: vi.fn(),
  setSheet: vi.fn(),
}));
vi.mock('../src/map/interaction.js', () => ({ setView: vi.fn() }));

const document = globalThis.document;
let initial;
beforeAll(async () => {
  vi.stubGlobal('fetch', async url => ({
    ok: true,
    json: async () =>
      JSON.parse(
        readFileSync(new URL('../public/data/' + String(url).split('/').pop(), import.meta.url), 'utf8'),
      ),
  }));
  await loadDatasets();
  await loadDeferredDatasets();
  initPreferences();
  initPoints();
  initLines();
  setC(PAL.light);
  buildSTY();
  initial = structuredClone(S);
});
beforeEach(() => {
  globalThis.localStorage.clear();
  Object.assign(S, structuredClone(initial));
  Object.assign(V2, { host: null, tab: null, disc: null, layersOpen: false });
  const html = readFileSync('index.html', 'utf8');
  document.body.innerHTML = html.match(/<body>([\s\S]*?)<\/body>/)[1];
  rebuildPoints();
  buildLines();
});

describe('research regression', () => {
  it('preserves the Stonehenge → Bourtange findings with real datasets', () => {
    const a = findPoint('stonehenge'),
      b = findPoint('bourtange');
    S.work = {
      name: 'Stonehenge → Bourtange',
      o: [a.lat, a.lon],
      brg: GEO.bearing(a.lat, a.lon, b.lat, b.lon),
      len: GEO.dist(a.lat, a.lon, b.lat, b.lon),
      anchors: [a.id, b.id],
      sites: [a.id, b.id],
    };
    S.active = 'work';
    buildLines();
    analyse();
    const d = v2Discover();
    expect(Math.round(activeLine().segs[0].len)).toBe(648);
    expect(d.dep.total).toBe(1);
    expect(d.sites).toHaveLength(13);
    expect(ALLP.length).toBeGreaterThan(12000);
  });
  it('keeps every imported row in a backup, including collections over 3,000 rows', () => {
    const rows = Array.from({ length: 3001 }, (_, i) => ({ n: `Site ${i}`, lat: 51, lon: 1, cat: 'ruin' }));
    S.imports = [{ id: 'research', name: 'Research', rows, on: false }];
    S.userLines = [{ id: 'line-1', name: 'Saved line', o: [51, 1], brg: 45, len: 100, anchors: [] }];
    S.markers = [{ id: 'm1', n: 'Field note', lat: 50, lon: 2 }];
    const code = stateCode();
    S.imports = [];
    S.userLines = [];
    S.markers = [];
    loadState(code);
    expect(S.imports[0].rows).toEqual(rows);
    expect(S.userLines[0].name).toBe('Saved line');
    expect(S.markers[0].n).toBe('Field note');
  });
});

describe('removing built-in case studies', () => {
  beforeEach(() => {
    vi.mocked(changed).mockImplementation(() => {
      buildLines();
      persist();
    });
    S.work = { name: 'In progress', o: [51, 1], brg: 45, len: 100, anchors: [] };
    S.userLines = [{ id: 'saved', name: 'Keep me', o: [50, 2], brg: 30, len: 50, anchors: [] }];
    buildLines();
    renderLayers();
  });
  afterEach(() => vi.mocked(changed).mockReset());

  it('removes both models from layers and the picker, preserving personal work and sites', () => {
    const work = structuredClone(S.work);
    const saved = structuredClone(S.userLines);
    const count = ALLP.length;
    S.active = 'primary';
    S.layers.primary = true;
    S.layers.bestfit = true;
    document.querySelector('[data-remove-study="vatican"]').click();
    expect(S.removedCaseStudies).toEqual(['vatican']);
    expect(S.active).toBeNull();
    expect(S.layers.primary).toBe(false);
    expect(S.layers.bestfit).toBe(false);
    expect(LINEBY.primary).toBeUndefined();
    expect(LINEBY.bestfit).toBeUndefined();
    expect(LINEBY.saved).toBeDefined();
    expect(LINEBY.work).toBeDefined();
    expect(S.work).toEqual(work);
    expect(S.userLines).toEqual(saved);
    expect(ALLP.length).toBe(count);
    expect(findPoint('obelisk')).toBeDefined();
    expect(document.querySelector('[data-layer="primary"]')).toBeNull();
    expect(document.querySelector('[data-layer="bestfit"]')).toBeNull();
    expect(document.querySelector('[data-g="examples"] > summary').textContent).toContain('0 of 7 on');
    openLinePicker();
    expect(document.querySelector('#pickbody [data-id="primary"]')).toBeNull();
    expect(document.querySelector('#pickbody [data-id="bestfit"]')).toBeNull();
    expect(document.querySelector('#pickbody [data-id="saved"]')).not.toBeNull();
  });

  it('supports Undo and later restoration without switching restored lines on', async () => {
    document.querySelector('[data-g="lines"]').open = true;
    document.querySelector('[data-g="examples"]').open = true;
    S.active = 'bestfit';
    S.layers.primary = true;
    S.layers.bestfit = true;
    document.querySelector('[data-remove-study="vatican"]').click();
    document.querySelector('#toast .undo').click();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(document.querySelector('[data-g="lines"]').open).toBe(true);
    expect(document.querySelector('[data-g="examples"]').open).toBe(true);
    expect(S.removedCaseStudies).toEqual([]);
    expect(S.active).toBe('bestfit');
    expect(S.layers.primary).toBe(true);
    expect(S.layers.bestfit).toBe(true);
    expect(LINEBY.bestfit).toBeDefined();
    document.querySelector('[data-remove-study="vatican"]').click();
    document.querySelector('[data-restore-study="vatican"]').click();
    expect(S.removedCaseStudies).toEqual([]);
    expect(S.layers.primary).toBe(false);
    expect(S.layers.bestfit).toBe(false);
    expect(S.active).toBeNull();
    expect(LINEBY.primary).toBeDefined();
  });

  it('persists removal across reload and backup restore', () => {
    S.active = 'work';
    document.querySelector('[data-remove-study="vatican"]').click();
    const backup = stateCode();
    S.removedCaseStudies = [];
    initState();
    initPreferences();
    buildLines();
    expect(S.removedCaseStudies).toEqual(['vatican']);
    expect(LINES.some(l => l.group === 'cs:vatican')).toBe(false);
    expect(S.active).toBe('work');
    S.removedCaseStudies = [];
    loadState(backup);
    expect(S.removedCaseStudies).toEqual(['vatican']);
    expect(LINEBY.primary).toBeUndefined();
  });

  it('loads older saves and backups without losing current removals or personal lines', () => {
    globalThis.localStorage.setItem(KEY, JSON.stringify({ userLines: S.userLines, work: S.work }));
    initState();
    expect(S.removedCaseStudies).toEqual([]);
    S.removedCaseStudies = ['vatican'];
    const legacy = JSON.parse(decodeURIComponent(escape(atob(stateCode()))));
    legacy.v = 3;
    delete legacy.removedCaseStudies;
    loadState(btoa(unescape(encodeURIComponent(JSON.stringify(legacy)))));
    expect(S.removedCaseStudies).toEqual(['vatican']);
    expect(S.userLines[0].id).toBe('saved');
  });
});

describe('workspace organization and control wiring', () => {
  it('keeps dataset and style controls out of Layers', () => {
    renderLayers();
    const layers = document.querySelector('#p-layers');
    expect(
      [...layers.querySelectorAll(':scope > details > summary')].map(s => s.firstChild.textContent.trim()),
    ).toEqual(['Sites', 'Underground', 'Lines']);
    expect(layers.querySelector('[data-src], [data-imp], [data-zm], [data-ugs-dep]')).toBeNull();
    expect(layers.querySelectorAll('[data-cat]').length).toBe(11);
  });
  it('refreshes underground switches and counts after clearing all layers', () => {
    S.under.iron = true;
    S.under.faults = true;
    V2.host = 'layers';
    V2.tab = 'menu';
    initEvents();
    renderLayers();
    expect(document.querySelector('#p-layers [data-g="under"] > summary').textContent).toContain('2 on');
    document.querySelector('#p-layers [data-v2="layers-clear"]').click();
    expect(Object.values(S.under).some(Boolean)).toBe(false);
    expect(document.querySelector('#p-layers [data-g="under"] > summary').textContent).toContain('all off');
    expect(
      [...document.querySelectorAll('#p-layers [data-ug]')].every(
        b => b.getAttribute('aria-checked') === 'false',
      ),
    ).toBe(true);
  });
  it('shows and updates dataset switches in Resources', () => {
    renderData();
    const source = document.querySelector('#p-data [data-src="fort"]');
    const wasOn = S.src.fort;
    source.click();
    expect(S.src.fort).toBe(!wasOn);
    document.querySelector('[data-resource-view="export"]').click();
    expect(document.querySelectorAll('#p-data [data-v2^="export-"]').length).toBe(4);
    document.querySelector('[data-resource-view="datasets"]').click();
  });
  it('updates Appearance controls through the panel event handlers', () => {
    initEvents();
    V2.host = 'appearance';
    renderAppearance();
    document.querySelector('[data-zm="groups"]').click();
    expect(V2.zoomMode).toBe('groups');
    expect(document.querySelector('[data-zm="groups"]').getAttribute('aria-checked')).toBe('true');
    const slider = document.querySelector('[data-v2opacity]');
    slider.value = '40';
    slider.dispatchEvent(new globalThis.Event('input', { bubbles: true }));
    expect(V2.overlayOpacity).toBe(40);
    document.querySelector('[data-linecol="#c62a1d"]').click();
    expect(V2.lineColor).toBe('#c62a1d');
    expect(document.querySelector('[data-linecol="#c62a1d"]').getAttribute('aria-pressed')).toBe('true');
  });
  it('routes every menu destination and returns hosted sections to Menu', () => {
    initPanels();
    for (const item of NAVIGATION) {
      runAction(item.action);
      expect(V2.host || V2.tab).toBe(item.id);
      v2Back();
      expect(V2.tab).toBe('menu');
      expect(V2.host).toBeNull();
    }
  });
  it('opens Menu from a hosted section instead of closing the workspace', () => {
    initPanels();
    initEvents();
    runAction('tool-data');
    document.querySelector('#v2-menu').click();
    expect(V2.tab).toBe('menu');
    expect(V2.host).toBeNull();
  });
  it('keeps comparison sections open while their inputs update', () => {
    renderLab();
    document.querySelector('[data-lab-section="site"]').open = true;
    renderLab();
    expect(document.querySelector('[data-lab-section="site"]').open).toBe(true);
    document.querySelector('[data-lab-section="line"]').open = false;
    renderLab();
    expect(document.querySelector('[data-lab-section="line"]').open).toBe(false);
  });
  it('persists dataset visibility and map style across a reload', () => {
    S.src.fort = false;
    S.layers.labels = false;
    v2Persist();
    S.src.fort = true;
    S.layers.labels = true;
    initPreferences();
    expect(S.src.fort).toBe(false);
    expect(S.layers.labels).toBe(false);
  });
  it('keeps file actions and line styling out of My lines', () => {
    document.querySelector('#v2panel').innerHTML = v2Saved();
    expect(document.querySelector('#v2panel [data-v2^="export-"], #v2panel [data-linecol]')).toBeNull();
  });
});
