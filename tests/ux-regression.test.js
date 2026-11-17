// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadDatasets, loadDeferredDatasets } from '../src/data/datasets.js';
import { initPoints, rebuildPoints, findPoint, ALLP } from '../src/domain/points.js';
import { initLines, buildLines, activeLine } from '../src/domain/lines.js';
import { analyse } from '../src/domain/analysis.js';
import { S } from '../src/state/state.js';
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
