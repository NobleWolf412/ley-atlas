// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadDatasets } from '../src/data/datasets.js';
import { initPoints, rebuildPoints, findPoint, ALLP, srcOn } from '../src/domain/points.js';
import { initLines } from '../src/domain/lines.js';
import { S } from '../src/state/state.js';
import { openImport } from '../src/features/import.js';
import { stateCode, loadState } from '../src/panels/data-pane.js';
import { flyTo } from '../src/map/camera.js';
import { emit } from '../src/core/events.js';
import { initMapTaps } from '../src/ui/map-taps.js';

vi.mock('../src/map/draw.js', () => ({ req: vi.fn(), setBC: vi.fn(), draw: vi.fn() }));
vi.mock('../src/map/camera.js', () => ({ flyTo: vi.fn(), flyToLine: vi.fn() }));
vi.mock('../src/ui/map-chrome.js', () => ({
  renderKey: vi.fn(),
  renderChrome: vi.fn(),
  setFocus: vi.fn(),
  lineSw: vi.fn(() => ''),
}));
vi.mock('../src/map/canvas.js', () => ({
  proj: () => ({ invert: () => [-1.5, 51.5] }),
  W: 400,
  H: 400,
  kForKm: () => 10,
}));
vi.mock('../src/ui/sheet.js', () => ({
  changed: vi.fn(),
  keepScroll: (_, fn) => fn(),
  renderTab: vi.fn(),
  selectTab: vi.fn(),
  setSheet: vi.fn(),
}));
vi.mock('../src/map/interaction.js', () => ({ setView: vi.fn() }));
const { document, Event } = globalThis;
import { initSiteTypes } from '../src/domain/site-types.js';
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
  initSiteTypes();
  initPoints();
  initLines();
  initial = structuredClone(S);
});
beforeEach(() => {
  Object.assign(S, structuredClone(initial));
  globalThis.localStorage.clear();
  document.body.innerHTML = readFileSync('index.html', 'utf8').match(/<body>([\s\S]*?)<\/body>/)[1];
  document.querySelector('#guided-pin-toolbar')?.remove();
  globalThis.HTMLElement.prototype.scrollIntoView = vi.fn();
  rebuildPoints();
  vi.clearAllMocks();
});
const paste = text => {
  openImport();
  document.querySelector('#im-text').value = text;
  document.querySelector('#im-parse').click();
};
describe('guided import flow', () => {
  it('previews valid polar coordinates without invalid SVG positions', () => {
    paste('North pole (90.0, 0.0)');
    expect(document.querySelector('.import-preview-map').outerHTML).not.toMatch(/NaN|Infinity/);
    expect(document.querySelector('#im-go').disabled).toBe(false);
  });
  it('reviews a pasted list without adding anything before confirmation', () => {
    const count = ALLP.length;
    S.work = { name: 'Keep work', o: [51, 1], brg: 45, len: 10 };
    S.active = 'work';
    const work = structuredClone(S.work);
    paste('Stonehenge\nMont Saint-Michel\nUnknown place\nMy point 40.2, -70.1');
    expect(document.querySelector('#modaltitle').textContent).toBe('Review sites');
    expect(document.querySelectorAll('[data-review-row]')).toHaveLength(4);
    expect(S.imports).toHaveLength(0);
    expect(ALLP).toHaveLength(count);
    expect(document.querySelector('[data-review-row="2"]').textContent).toContain('Location needed');
    document.querySelector('#im-go').click();
    expect(S.imports).toHaveLength(1);
    expect(S.imports[0].rows).toHaveLength(3);
    expect(ALLP).toHaveLength(count + 1);
    expect(S.work).toEqual(work);
    expect(S.active).toBe('work');
    expect(S.imports[0].rows[0].originalText).toBe('Stonehenge');
    expect(S.imports[0].rows[0].matchedSiteId).toBeTruthy();
  });
  it('allows manual coordinate resolution, unselecting rows and editing the original paste', () => {
    paste('Unknown place\nOther unknown');
    expect(document.querySelector('#im-go').disabled).toBe(true);
    document.querySelector('[data-import-coords="0"]').value = '51.5, -0.12';
    document.querySelector('[data-import-apply="0"]').click();
    expect(document.querySelector('#im-go').textContent).toContain('1 selected site');
    const checkbox = document.querySelector('[data-import-select="0"]');
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change'));
    expect(document.querySelector('#im-go').disabled).toBe(true);
    document.querySelector('#guided-import-back').click();
    expect(document.querySelector('#im-text').value).toBe('Unknown place\nOther unknown');
  });
  it('can place or cancel a map pin without changing work or layers', () => {
    initMapTaps();
    S.work = { name: 'Keep', o: [0, 0], brg: 90, len: 10 };
    const before = structuredClone(S);
    paste('Unknown place');
    document.querySelector('[data-import-pin="0"]').click();
    expect(document.querySelector('#modal').hidden).toBe(true);
    document.querySelector('#guided-pin-cancel').click();
    expect(document.querySelector('#modal').hidden).toBe(false);
    expect(S).toEqual(before);
    document.querySelector('[data-import-pin="0"]').click();
    emit('map:tap', 100, 100);
    expect(document.querySelector('#im-go').textContent).toContain('1 selected site');
    expect(S).toEqual(before);
    expect(flyTo).toHaveBeenCalled();
    document.querySelector('#im-go').click();
    expect(S.imports[0].rows[0]).toMatchObject({ lat: 51.5, lon: -1.5, coordinateSource: 'User map pin' });
  });
  it('preserves conventional CSV and GeoJSON import paths', () => {
    paste('name,latitude,longitude\nNew point,40.1,-70.2');
    expect(document.querySelector('[data-map="lat"]')).not.toBeNull();
    document.querySelector('#im-go').click();
    expect(S.imports[0].rows[0].n).toBe('New point');
    paste(
      JSON.stringify({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [2.1, 48.2] },
        properties: { name: 'Geo point' },
      }),
    );
    document.querySelector('#im-go').click();
    expect(S.imports.at(-1).rows[0].n).toBe('Geo point');
  });
  it('escapes pasted labels in review and preserves matched membership across backups', () => {
    paste('<img src=x onerror=alert(1)>\nStonehenge');
    expect(document.querySelector('#modalbody img')).toBeNull();
    document.querySelector('#im-go').click();
    const count = ALLP.length,
      code = stateCode();
    S.imports = [];
    rebuildPoints();
    loadState(code);
    expect(ALLP).toHaveLength(count);
    const row = S.imports[0].rows[0],
      point = findPoint(row.matchedSiteId);
    expect(point.importIds).toContain(S.imports[0].id);
    S.src[point.set] = false;
    expect(srcOn(point)).toBe(true);
    S.imports[0].on = false;
    expect(srcOn(point)).toBe(false);
  });
});
