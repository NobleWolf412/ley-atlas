import { describe, expect, it } from 'vitest';
import {
  aimedAt,
  foldedMean,
  fortShape,
  poissonAtLeast,
  rayleigh,
  rotationTest,
  tipBearings,
} from '../src/core/fort-geometry.js';
import { GEO } from '../src/core/geo.js';

// a perfect five-pointed fort, 300 m across, first point due north + `turn` degrees
const pentagon = (turn = 0, centre = [53, 7]) => ({
  centre,
  tips: Array.from({ length: 5 }, (_, i) => GEO.dest(centre[0], centre[1], turn + i * 72, 0.3)),
});

describe('tipBearings and fortShape', () => {
  it('a regular pentagon is fully regular and round, facing the way it was turned', () => {
    const f = pentagon(10);
    const t = tipBearings(f.centre, f.tips);
    expect(t.map(x => Math.round(x.brg))).toEqual([10, 82, 154, 226, 298]);
    const s = fortShape(t);
    expect(s.n).toBe(5);
    expect(s.regularity).toBeCloseTo(1, 3);
    expect(s.roundness).toBeCloseTo(1, 3);
    expect(s.facing).toBeCloseTo(10, 1);
  });
  it('turning a fort by a whole sector does not change its facing', () => {
    const a = fortShape(tipBearings(...Object.values(pentagon(10)))),
      b = fortShape(tipBearings(...Object.values(pentagon(82))));
    expect(b.facing).toBeCloseTo(a.facing, 6);
  });
  it('an uneven fort scores lower', () => {
    const c = [53, 7];
    const tips = [0, 30, 60, 200, 300].map(b => GEO.dest(c[0], c[1], b, 0.3));
    expect(fortShape(tipBearings(c, tips)).regularity).toBeLessThan(0.5);
  });
});

describe('foldedMean', () => {
  it('handles the wrap at the sector edge', () => {
    expect(foldedMean([71, 1, 73, 143], 5)).toBeCloseTo(0, 0); // 71 and 143 sit just below a sector edge
  });
});

describe('rayleigh', () => {
  it('finds no clustering in evenly spread directions', () => {
    const r = rayleigh(Array.from({ length: 60 }, (_, i) => i * 6));
    expect(r.R).toBeLessThan(0.01);
    expect(r.p).toBeGreaterThan(0.9);
  });
  it('finds strong clustering when everything faces the same way', () => {
    const r = rayleigh(Array.from({ length: 30 }, (_, i) => 40 + (i % 5)));
    expect(r.R).toBeGreaterThan(0.99);
    expect(r.p).toBeLessThan(1e-6);
  });
  it('folding by n treats a pentagon turned by 72° as the same', () => {
    expect(rayleigh([10, 82, 154, 226, 298, 10, 82], 5).R).toBeCloseTo(1, 6);
  });
});

describe('aimedAt and the rotation test', () => {
  const f = pentagon(0);
  const brgs = tipBearings(f.centre, f.tips).map(t => t.brg);
  it('lists targets within the tolerance of a point', () => {
    const hits = aimedAt(
      brgs,
      [
        { id: 'a', brg: 72.4 },
        { id: 'b', brg: 100 },
      ],
      1,
    );
    expect(hits.map(h => h.id)).toEqual(['a']);
    expect(hits[0].off).toBeCloseTo(0.4, 6);
  });
  it('one target: a five-pointed fort catches it within ±1° about 5 × 2 / 360 of the time', () => {
    const r = rotationTest(brgs, [123], 1, 1);
    expect(r.p).toBeCloseTo((5 * 2) / 360, 2);
    expect(r.expected).toBeCloseTo((5 * 2) / 360, 2);
  });
  it('a fort aimed at many targets at once is rare by luck', () => {
    const targets = brgs.map(b => b + 0.2); // every point aimed at something
    const r = rotationTest(brgs, targets, 0.5, 5);
    // a five-fold fort looks the same after a 72° turn, so the exact aim recurs 5 times per circle
    expect(r.p).toBeCloseTo((5 * 1) / 360, 3);
  });
});

describe('poissonAtLeast', () => {
  it('matches known values', () => {
    expect(poissonAtLeast(0, 3)).toBe(1);
    expect(poissonAtLeast(1, 2)).toBeCloseTo(1 - Math.exp(-2), 9);
    expect(poissonAtLeast(10, 2)).toBeLessThan(0.001);
  });
  it('stays sensible for large counts', () => {
    expect(poissonAtLeast(1479, 1479)).toBeCloseTo(0.5, 1);
    expect(poissonAtLeast(1508, 1478.9)).toBeGreaterThan(0.15);
    expect(poissonAtLeast(1508, 1478.9)).toBeLessThan(0.3);
    expect(poissonAtLeast(1700, 1478.9)).toBeLessThan(1e-6);
  });
});
