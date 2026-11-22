// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadDatasets, loadDeferredDatasets } from '../src/data/datasets.js';
import { initPoints, rebuildPoints } from '../src/domain/points.js';
import { initLines, buildLines } from '../src/domain/lines.js';
import { S } from '../src/state/state.js';
import { V2, initPreferences } from '../src/state/preferences.js';
import {
  initResearchLibrary,
  researchUI,
  researchDetailScreen,
  analysisModel,
  openResearch,
  startResearchPreview,
  stopResearchPreview,
} from '../src/features/research-library.js';
import { researchLibrary } from '../src/domain/research.js';
import {
  initResearchNotebook,
  notebookSnapshot,
  saveResearchNote,
  researchNote,
  replaceNotebook,
} from '../src/state/research-notebook.js';
import { stateCode, loadState } from '../src/panels/data-pane.js';
import { initPanels, v2ChangeTab, v2Back } from '../src/ui/panels.js';
import { initEvents } from '../src/ui/events.js';
import { runAction } from '../src/ui/registry.js';
import { PAL, setC, buildSTY } from '../src/render/palette.js';
import { flyTo } from '../src/map/camera.js';

vi.mock('../src/map/draw.js', () => ({ req: vi.fn(), setBC: vi.fn(), draw: vi.fn() }));
vi.mock('../src/map/camera.js', () => ({ flyTo: vi.fn(), flyToLine: vi.fn() }));
vi.mock('../src/ui/map-chrome.js', () => ({
  renderKey: vi.fn(),
  renderChrome: vi.fn(),
  setFocus: vi.fn(),
  lineSw: vi.fn(() => ''),
}));
vi.mock('../src/ui/sheet.js', () => ({
  changed: vi.fn(),
  keepScroll: (_, fn) => fn(),
  renderTab: vi.fn(),
  selectTab: vi.fn(),
  setSheet: vi.fn(),
}));
vi.mock('../src/map/interaction.js', () => ({ setView: vi.fn() }));
const { document, history, window, KeyboardEvent, PopStateEvent } = globalThis;
// Test globals remain explicit because this repository's test lint environment is Node.
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
  document.body.innerHTML = readFileSync('index.html', 'utf8').match(/<body>([\s\S]*?)<\/body>/)[1];
  initPanels();
  initEvents();
  initResearchLibrary();
});
beforeEach(() => {
  localStorage.clear();
  initResearchNotebook();
  Object.assign(S, structuredClone(initial));
  Object.assign(V2, { host: null, tab: 'explore', disc: null, layersOpen: false });
  Object.assign(researchUI, {
    id: null,
    subtab: 'overview',
    query: '',
    category: 'all',
    region: 'all',
    geometry: 'all',
    view: 'featured',
    preview: null,
    results: {},
    running: false,
    width: 5,
    model: 'endpoints',
    pool: 'unesco',
    mode: 'rotate',
  });
  history.replaceState(null, '');
  rebuildPoints();
  buildLines();
  vi.clearAllMocks();
});
describe('research UI and isolation', () => {
  it('renders every collection and tab, while unsupported models cannot run tests', () => {
    for (const r of researchLibrary().collections) {
      researchUI.id = r.id;
      for (const tab of ['overview', 'sites', 'geometry', 'analysis', 'sources']) {
        researchUI.subtab = tab;
        expect(() => researchDetailScreen()).not.toThrow();
        const fragment = document.createElement('div');
        fragment.innerHTML = researchDetailScreen();
        expect(fragment.querySelectorAll('[role="tab"]')).toHaveLength(5);
        expect(fragment.querySelector('[role="tabpanel"]')).not.toBeNull();
        if (tab === 'analysis' && r.type !== 'path') {
          expect(analysisModel(r)).toBeNull();
          expect(fragment.querySelector('[data-v2="research-run"]')).toBeNull();
        }
      }
    }
  });
  it('preserves work, selection, active line, toggles, preferences and existing analysis on preview/exit', () => {
    S.work = { name: 'Unsaved research', o: [51, 1], brg: 45, len: 10, anchors: [] };
    S.active = 'work';
    S.sel = { type: 'site', id: 'stonehenge' };
    S.layers.user = false;
    V2.disc = { existing: 'result' };
    V2.pick = { a: 'stonehenge', b: null };
    const before = structuredClone(S),
      preferences = structuredClone({ disc: V2.disc, pick: V2.pick });
    openResearch('michael');
    startResearchPreview();
    expect(S).toEqual(before);
    expect({ disc: V2.disc, pick: V2.pick }).toEqual(preferences);
    expect(researchUI.preview.camera).toEqual(before.cam);
    stopResearchPreview();
    expect(researchUI.preview).toBeNull();
    expect(S).toEqual(before);
    expect(flyTo).toHaveBeenLastCalledWith(before.cam.lon, before.cam.lat, before.cam.k, 0);
  });
  it('runs the shared comparison without replacing the working line or global result', async () => {
    S.work = { name: 'Keep me', o: [0, 0], brg: 90, len: 100, anchors: [] };
    S.active = 'work';
    V2.disc = { existing: 'result' };
    const before = structuredClone(S);
    openResearch('michael');
    researchUI.subtab = 'analysis';
    runAction('research-run');
    await vi.waitFor(() => expect(researchUI.results.michael).toBeDefined());
    expect(researchUI.results.michael.N).toBe(2000);
    expect(S).toEqual(before);
    expect(V2.disc).toEqual({ existing: 'result' });
    runAction('research-save-run');
    expect(researchNote('michael').investigation.result.hist).toHaveLength(2000);
  });
  it('keeps site return context and supports keyboard tab navigation', async () => {
    openResearch('michael');
    runAction('research-tab', 'sites');
    runAction('research-site', 'michael:0');
    expect(V2.tab).toBe('research-site');
    runAction('research-return');
    await vi.waitFor(() => expect(V2.tab).toBe('research-detail'));
    expect(researchUI.subtab).toBe('sites');
    document
      .querySelector('#research-tab-sites')
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(researchUI.subtab).toBe('geometry');
    expect(document.activeElement.id).toBe('research-tab-geometry');
  });
  it('keeps research search input focus and gives honest empty feedback', () => {
    v2ChangeTab('research');
    const input = document.querySelector('[data-research-filter="query"]');
    input.focus();
    input.value = 'impossiblequery';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(document.activeElement).toBe(input);
    expect(document.querySelector('#research-results').textContent).toContain('No collections match');
  });
  it('restores collection history with the standard panel back coordinator', () => {
    v2ChangeTab('research');
    openResearch('michael');
    researchUI.subtab = 'sites';
    runAction('research-site', 'michael:1');
    const captured = history.state.atlasPanel;
    expect(captured.tab).toBe('research-site');
    window.dispatchEvent(
      new PopStateEvent('popstate', {
        state: { atlasPanel: { tab: 'research-detail', state: { id: 'michael', subtab: 'sites' } } },
      }),
    );
    expect(V2.tab).toBe('research-detail');
    expect(researchUI.subtab).toBe('sites');
    const spy = vi.spyOn(history, 'back').mockImplementation(() => {});
    history.replaceState({ atlasPanel: { tab: 'research-detail' } }, '');
    v2Back();
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });
});
it('promotes a calculated model without overwriting work or duplicating an unchanged model', () => {
  S.work = { name: 'Unsaved', o: [50, 1], brg: 45, len: 10, anchors: [] };
  const work = structuredClone(S.work);
  openResearch('michael');
  runAction('research-promote');
  expect(S.work).toEqual(work);
  expect(S.userLines).toHaveLength(1);
  expect(S.userLines[0].researchId).toBe('michael');
  expect(S.userLines[0].sourcePositions).toHaveLength(8);
  runAction('research-promote');
  expect(S.userLines).toHaveLength(1);
});

describe('notebook durability and backup compatibility', () => {
  it('restores saved investigation controls after refresh without offering an inactive save button', async () => {
    openResearch('michael');
    Object.assign(researchUI, { width: 7.5, model: 'fit', pool: 'fort', mode: 'random' });
    runAction('research-run');
    await vi.waitFor(() => expect(researchUI.results.michael).toBeDefined());
    runAction('research-save-run');
    const saved = structuredClone(researchNote('michael').investigation);
    Object.assign(researchUI, { results: {}, width: 5, model: 'endpoints', pool: 'unesco', mode: 'rotate' });
    initResearchNotebook();
    openResearch('michael');
    runAction('research-tab', 'analysis');
    expect(researchUI).toMatchObject({ width: 7.5, model: 'fit', pool: 'fort', mode: 'random' });
    expect(document.querySelector('[data-research-setting="width"]').value).toBe('7.5');
    expect(document.querySelector('[data-v2="research-save-run"]')).toBeNull();
    expect(document.querySelector('[role="tabpanel"]').textContent).toContain('Saved on this device');
    expect(researchNote('michael').investigation).toEqual(saved);
  });
  it('round trips notebook, working/saved lines and imports in backup v4', () => {
    saveResearchNote('michael', 'Private <script>note</script>', true);
    S.userLines = [{ id: 'u1', name: 'Saved', o: [51, 0], brg: 10, len: 100, anchors: [] }];
    S.work = { name: 'Working', o: [50, 1], brg: 20, len: 200, anchors: [] };
    S.imports = [
      { id: 'private', name: 'Field research', on: false, rows: [{ n: 'Candidate', lat: 51, lon: 0 }] },
    ];
    const code = stateCode(),
      parsed = JSON.parse(decodeURIComponent(escape(atob(code))));
    expect(parsed.v).toBe(4);
    replaceNotebook({ format: 'ley-atlas-notebook', version: 1, entries: [] });
    S.userLines = [];
    S.imports = [];
    S.work = null;
    loadState(code);
    expect(researchNote('michael').text).toContain('<script>');
    expect(S.userLines[0].name).toBe('Saved');
    expect(S.work.name).toBe('Working');
    expect(S.imports[0].rows).toHaveLength(1);
    researchUI.id = 'michael';
    expect(researchDetailScreen()).not.toContain('<script>');
  });
  it.each([1, 2, 3])('restores legacy backup v%s without deleting the notebook', version => {
    saveResearchNote('michael', 'Keep my notes');
    const data = JSON.parse(decodeURIComponent(escape(atob(stateCode()))));
    data.v = version;
    delete data.researchNotebook;
    loadState(btoa(unescape(encodeURIComponent(JSON.stringify(data)))));
    expect(researchNote('michael').text).toBe('Keep my notes');
  });
  it('rejects malformed v4 notebooks before changing app state', () => {
    const before = structuredClone(S),
      data = JSON.parse(decodeURIComponent(escape(atob(stateCode()))));
    data.researchNotebook.entries = [{ recordId: 'invalid', text: 'bad' }];
    data.userLines = [{ id: 'bad' }];
    expect(() => loadState(btoa(unescape(encodeURIComponent(JSON.stringify(data)))))).toThrow();
    expect(S).toEqual(before);
  });
  it('does not lose the in-memory notebook when storage writes fail', () => {
    saveResearchNote('michael', 'Original');
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Quota');
    });
    expect(() => saveResearchNote('michael', 'New')).toThrow();
    expect(researchNote('michael').text).toBe('Original');
    spy.mockRestore();
    initResearchNotebook();
    expect(notebookSnapshot().entries[0].text).toBe('Original');
  });
});
