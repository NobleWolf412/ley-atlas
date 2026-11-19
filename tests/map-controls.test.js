// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAllHandlers, emit } from '../src/core/events.js';
import { loadDatasets, loadDeferredDatasets } from '../src/data/datasets.js';
import { initPoints, rebuildPoints, enabledPoints } from '../src/domain/points.js';
import { initLines, buildLines } from '../src/domain/lines.js';
import { initUnderground } from '../src/domain/underground.js';
import { initSiteTypes } from '../src/domain/site-types.js';
import { S, persist, initState, KEYK } from '../src/state/state.js';
import { V2, v2Persist } from '../src/state/preferences.js';
import { PAL, setC, buildSTY } from '../src/render/palette.js';
import { initMapChrome, renderKey } from '../src/ui/map-chrome.js';
import { initEvents } from '../src/ui/events.js';
import { runAction } from '../src/ui/registry.js';
import { changed } from '../src/ui/sheet.js';
import { initMapControls } from '../src/features/map-controls.js';

vi.mock('../src/map/draw.js', () => ({ req: vi.fn(), setBC: vi.fn() }));
vi.mock('../src/map/interaction.js', () => ({ setView: vi.fn() }));
vi.mock('../src/ui/sheet.js', () => ({
  changed: vi.fn(),
  setSheet: vi.fn(),
  renderTab: vi.fn(),
  selectTab: vi.fn(),
  keepScroll: (_target, fn) => fn(),
}));

let initial, initialV2;
const document = globalThis.document;
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
  initSiteTypes();
  initPoints();
  initLines();
  initUnderground();
  initial = structuredClone(S);
  initialV2 = structuredClone(V2);
});
beforeEach(() => {
  clearAllHandlers();
  globalThis.localStorage.clear();
  document.body.innerHTML = readFileSync('index.html', 'utf8').match(/<body>([\s\S]*?)<\/body>/)[1];
  document.querySelector('#app').classList.add('v2-home');
  Object.assign(S, structuredClone(initial));
  Object.assign(V2, structuredClone(initialV2), { tab: null, host: null, disc: null });
  S.work = { name: 'Unsaved research', o: [51, 1], brg: 45, len: 100, anchors: [] };
  S.userLines = [{ id: 'saved', name: 'Saved research', o: [50, 2], brg: 30, len: 20, anchors: [] }];
  S.active = 'work';
  setC(PAL.light);
  buildSTY();
  rebuildPoints();
  buildLines();
  vi.mocked(changed).mockImplementation(() => {
    buildLines();
    persist();
    v2Persist();
    renderKey();
    emit('ui:screen', V2.tab);
  });
  initMapChrome();
  initMapControls();
  initEvents();
  renderKey();
});
const toggle = id => document.querySelector(`[data-map-toggle="${id}"]`);
const open = () => document.querySelector('#lyr').click();
const legendItem = label =>
  [...document.querySelectorAll('#key .legend-item')].find(el => el.textContent === label);

describe('live map layers', () => {
  it('returns from a hosted panel to the map without losing the line being edited', () => {
    V2.tab = 'menu';
    V2.host = 'layers';
    const work = structuredClone(S.work);
    open();
    expect(V2.tab).toBeNull();
    expect(V2.host).toBeNull();
    expect(S.work).toEqual(work);
    expect(S.active).toBe('work');
    expect(document.querySelector('#map-layer-popover').hidden).toBe(false);
  });
  it('switches minerals repeatedly without navigating or changing personal work', () => {
    const work = structuredClone(S.work),
      saved = structuredClone(S.userLines),
      cam = { ...S.cam };
    open();
    expect(document.querySelector('#map-layer-popover').hidden).toBe(false);
    toggle('under:iron').focus();
    toggle('under:iron').click();
    expect(S.under.iron).toBe(true);
    expect(toggle('under:iron').getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(toggle('under:iron'));
    expect(legendItem('Iron ore').querySelector('polygon').getAttribute('fill')).toBe(PAL.light.dep.iron);
    toggle('under:iron').click();
    expect(S.under.iron).toBe(false);
    expect(legendItem('Iron ore')).toBeUndefined();
    expect(S.work).toEqual(work);
    expect(S.userLines).toEqual(saved);
    expect(S.active).toBe('work');
    expect(S.cam).toEqual(cam);
    expect(V2.tab).toBeNull();
    expect(document.querySelector('#map-layer-popover').hidden).toBe(false);
  });
  it('makes both site types and source datasets available on the map', () => {
    open();
    expect(document.querySelectorAll('[data-map-toggle^="cat:"]')).toHaveLength(11);
    expect(document.querySelectorAll('[data-map-toggle^="src:"]')).toHaveLength(8);
    toggle('cat:castle').click();
    expect(enabledPoints().some(p => p.cat === 'castle')).toBe(false);
    toggle('src:roman').click();
    expect(enabledPoints().some(p => p.set === 'roman')).toBe(false);
    expect(JSON.parse(globalThis.localStorage.getItem('leyatlas.v2.preferences')).src.roman).toBe(false);
  });
  it('preserves imported collections when changing their visibility, including IDs with colons', () => {
    S.imports = [
      {
        id: 'research:one',
        name: '<Field notes>',
        on: true,
        rows: [{ n: 'Spot', lat: 1, lon: 2, cat: 'ruin' }],
      },
    ];
    open();
    toggle('import:research:one').click();
    expect(S.imports[0].on).toBe(false);
    expect(S.imports[0].rows).toHaveLength(1);
    expect(JSON.parse(globalThis.localStorage.getItem('leyatlas.imports.v1'))[0].on).toBe(false);
    expect(toggle('import:research:one').textContent).toContain('<Field notes>');
    expect(toggle('import:research:one').querySelector('field')).toBeNull();
  });
  it('shows enabled example lines without replacing the working or active line', () => {
    open();
    toggle('layer:primary').click();
    expect(S.layers.primary).toBe(true);
    expect(S.focus).toBe(false);
    expect(S.active).toBe('work');
    expect(S.work.name).toBe('Unsaved research');
  });
  it('keeps removed case studies out of the live switches', () => {
    S.removedCaseStudies = ['vatican'];
    buildLines();
    open();
    expect(toggle('layer:primary')).toBeNull();
    expect(toggle('layer:bestfit')).toBeNull();
  });
  it('clears underground layers independently and keeps map toggles synchronized', () => {
    S.under.iron = true;
    S.under.mag = true;
    open();
    document.querySelector('[data-map-bulk="under-off"]').click();
    expect(Object.values(S.under).some(Boolean)).toBe(false);
    expect(S.layers.cat.castle).toBe(true);
    toggle('layer:labels').click();
    expect(S.layers.labels).toBe(false);
    expect(JSON.parse(globalThis.localStorage.getItem('leyatlas.v2.preferences')).layers.labels).toBe(false);
  });
  it('keeps the opacity range mounted while saving a drag', () => {
    open();
    const range = document.querySelector('[data-map-opacity]');
    range.value = '40';
    range.dispatchEvent(new globalThis.Event('input', { bubbles: true }));
    expect(document.querySelector('[data-map-opacity]')).toBe(range);
    expect(V2.overlayOpacity).toBe(40);
    expect(JSON.parse(globalThis.localStorage.getItem('leyatlas.v2.preferences')).opacity).toBe(40);
  });
  it('closes on Escape or navigation and restores focus for keyboard users', () => {
    open();
    document
      .querySelector('#map-layer-popover')
      .dispatchEvent(new globalThis.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelector('#map-layer-popover').hidden).toBe(true);
    expect(document.activeElement).toBe(document.querySelector('#lyr'));
    runAction('map-layers');
    emit('ui:navigate', null, 'menu');
    expect(document.querySelector('#map-layer-popover').hidden).toBe(true);
    expect(document.querySelector('#lyr').getAttribute('aria-expanded')).toBe('false');
  });
  it('does not turn unavailable satellite imagery on', () => {
    S.satFailed = true;
    open();
    toggle('layer:sat').click();
    expect(toggle('layer:sat').disabled).toBe(true);
    expect(S.layers.sat).toBe(false);
  });
});

describe('enabled-layer legend', () => {
  it('uses the current mineral palette and describes density without implying abundance', () => {
    S.under.copper = true;
    V2.ugDep = 'heat';
    setC(PAL.dark);
    buildSTY();
    renderKey();
    expect(
      legendItem('Copper').querySelector('.legend-density').style.getPropertyValue('--legend-colour'),
    ).toBe(PAL.dark.dep.copper);
    expect(document.querySelector('#key').textContent).toContain('not mineral concentration');
    expect(legendItem('Gold')).toBeUndefined();
  });
  it('uses Roman dataset symbols instead of the generic ruin colour', () => {
    for (const id of Object.keys(S.src)) S.src[id] = false;
    for (const id of Object.keys(S.layers.cat)) S.layers.cat[id] = false;
    S.src.roman = true;
    S.layers.cat.ruin = true;
    renderKey();
    expect(legendItem('Roman sites').querySelector('[fill]').getAttribute('fill')).toBe(PAL.light.roman);
    expect(legendItem('Ruin / tomb')).toBeUndefined();
  });
  it('persists collapsing and reopening without disabling map layers', () => {
    S.under.gold = true;
    renderKey();
    document.querySelector('#keyhide').click();
    expect(document.querySelector('#key').hidden).toBe(true);
    expect(globalThis.localStorage.getItem(KEYK)).toBe('0');
    S.keyOpen = true;
    initState();
    expect(S.keyOpen).toBe(false);
    document.querySelector('#keybtn').click();
    expect(document.querySelector('#key').hidden).toBe(false);
    expect(S.under.gold).toBe(true);
    expect(globalThis.localStorage.getItem(KEYK)).toBe('1');
  });
  it('explains the empty legend when all relevant layers are disabled', () => {
    for (const id of Object.keys(S.layers.cat)) S.layers.cat[id] = false;
    S.layers.user = false;
    S.layers.stonework = false;
    renderKey();
    expect(document.querySelector('#key').textContent).toContain(
      'No site, line or underground layers enabled',
    );
  });
});
