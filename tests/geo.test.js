import { describe, expect, it } from 'vitest';
import { GEO } from '../src/core/geo.js';

const LONDON = [51.5074, -0.1278];
const PARIS = [48.8566, 2.3522];
const STONEHENGE = [51.1789, -1.8262];

describe('GEO.dist (great-circle distance, km)', () => {
  it('London → Paris is about 343.5 km', () => {
    expect(GEO.dist(...LONDON, ...PARIS)).toBeCloseTo(343.5, 0);
  });
  it('is symmetric and zero for the same point', () => {
    expect(GEO.dist(...LONDON, ...PARIS)).toBeCloseTo(GEO.dist(...PARIS, ...LONDON), 9);
    expect(GEO.dist(...STONEHENGE, ...STONEHENGE)).toBe(0);
  });
  it('a quarter of the equator is π·R/2', () => {
    expect(GEO.dist(0, 0, 0, 90)).toBeCloseTo((Math.PI * GEO.R) / 2, 6);
  });
});

describe('GEO.bearing', () => {
  it('due east along the equator is 90°, due north is 0°', () => {
    expect(GEO.bearing(0, 0, 0, 10)).toBeCloseTo(90, 9);
    expect(GEO.bearing(0, 0, 10, 0)).toBeCloseTo(0, 9);
  });
  it('is always in [0, 360)', () => {
    const b = GEO.bearing(...PARIS, ...LONDON);
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThan(360);
  });
});

describe('GEO.dest', () => {
  it('travelling the bearing and distance to Paris lands on Paris', () => {
    const brg = GEO.bearing(...LONDON, ...PARIS);
    const km = GEO.dist(...LONDON, ...PARIS);
    const [lat, lon] = GEO.dest(...LONDON, brg, km);
    expect(GEO.dist(lat, lon, ...PARIS)).toBeLessThan(0.001); // within 1 m
  });
});

describe('GEO.vec / GEO.ll', () => {
  it('round-trips a coordinate through a unit vector', () => {
    const [lat, lon] = GEO.ll(GEO.vec(...STONEHENGE));
    expect(lat).toBeCloseTo(STONEHENGE[0], 9);
    expect(lon).toBeCloseTo(STONEHENGE[1], 9);
  });
});

describe('GEO.rng', () => {
  it('is reproducible for the same seed', () => {
    const a = GEO.rng(42),
      b = GEO.rng(42);
    const xs = Array.from({ length: 5 }, a),
      ys = Array.from({ length: 5 }, b);
    expect(xs).toEqual(ys);
    xs.forEach(x => expect(x).toBeGreaterThanOrEqual(0));
    xs.forEach(x => expect(x).toBeLessThan(1));
  });
});
