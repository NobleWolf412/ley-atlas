// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { emit } from '../src/core/events.js';
import { cv } from '../src/map/canvas.js';
import { gest, initInteraction } from '../src/map/interaction.js';
import { S } from '../src/state/state.js';

vi.mock('../src/core/events.js', () => ({ emit: vi.fn() }));
vi.mock('../src/map/camera.js', () => ({ anim: null, flyTo: vi.fn(), setAnim: vi.fn() }));
vi.mock('../src/map/draw.js', () => ({ req: vi.fn() }));
vi.mock('../src/map/canvas.js', () => {
  const canvas = globalThis.document.createElement('canvas');
  canvas.setPointerCapture = vi.fn();
  const projection = point => point;
  projection.invert = point => point;
  return { cv: canvas, H: 600, W: 400, clampCam: vi.fn(), kForKm: vi.fn(), proj: () => projection };
});
const { document, Event } = globalThis;
let now = 0;
function pointer(type, id, x = 100, y = 100) {
  const event = new Event(type);
  Object.assign(event, { pointerId: id, offsetX: x, offsetY: y });
  cv.dispatchEvent(event);
}
beforeAll(() => {
  document.body.innerHTML = ['zin', 'zout', 'home', 'v-map', 'v-globe']
    .map(id => `<button id="${id}"></button>`)
    .join('');
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 1),
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  initInteraction();
});
beforeEach(() => {
  now += 1000;
  S.view = 'globe';
  S.cam = { lon: 0, lat: 0, k: 100 };
  S.mode = null;
  vi.clearAllMocks();
});
describe('map pointer gestures', () => {
  it('does not turn a cancelled touch into a tap or the first half of a double tap', () => {
    pointer('pointerdown', 1);
    pointer('pointercancel', 1);
    expect(emit).not.toHaveBeenCalledWith('map:tap', 100, 100);
    expect(gest).toBeNull();
    pointer('pointerdown', 2);
    pointer('pointerup', 2);
    expect(emit).toHaveBeenCalledWith('map:tap', 100, 100);
  });
  it('does not start inertia when a drag is cancelled', () => {
    pointer('pointerdown', 1);
    now += 10;
    pointer('pointermove', 1, 150, 100);
    vi.mocked(globalThis.requestAnimationFrame).mockClear();
    pointer('pointercancel', 1, 150, 100);
    expect(globalThis.requestAnimationFrame).not.toHaveBeenCalled();
    expect(gest).toBeNull();
  });
  it('pans and pinches without emitting a tap, then accepts a new tap', () => {
    pointer('pointerdown', 1);
    pointer('pointerdown', 2, 200, 100);
    pointer('pointermove', 2, 250, 100);
    expect(S.cam.k).toBeGreaterThan(100);
    pointer('pointercancel', 2, 250, 100);
    pointer('pointermove', 1, 110, 100);
    expect(S.cam.lon).not.toBe(0);
    pointer('pointercancel', 1, 110, 100);
    expect(emit.mock.calls.filter(([name]) => name === 'map:tap')).toHaveLength(0);
    pointer('pointerdown', 3);
    pointer('pointerup', 3);
    expect(emit).toHaveBeenCalledWith('map:tap', 100, 100);
  });
});
