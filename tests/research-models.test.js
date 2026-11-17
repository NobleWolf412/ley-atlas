import { describe, expect, it } from 'vitest';
import { normalizeResearch, referenceLine, researchGeometry, researchMetrics } from '../src/core/research.js';
import { GEO } from '../src/core/geo.js';
const source = [{ id: 'fixture' }];
const make = rows =>
  normalizeResearch(
    [
      {
        id: 'fixture',
        title: 'Fixture',
        type: 'path',
        sourceIds: ['fixture'],
        section: 'Test fixture',
        rows,
      },
    ],
    source,
  ).collections[0];
describe('computed model variants', () => {
  it('fits an equatorial great circle with known zero residual', () => {
    const r = make([
        ['a', 'A', 0, 0],
        ['b', 'B', 0, 45],
        ['c', 'C', 0, 90],
      ]),
      fit = referenceLine(r, 'fit');
    expect(fit.rmsKm).toBeCloseTo(0, 8);
    expect(researchMetrics(r, 'fit').maxOffsetKm).toBeCloseTo(0, 8);
    expect(
      researchGeometry(r, true, 'fit')
        .features.find(f => f.geometry.type === 'LineString')
        .geometry.coordinates.every(p => Math.abs(p[1]) < 1e-8),
    ).toBe(true);
  });
  it('fits all source points rather than silently reusing endpoints', () => {
    const r = make([
        ['a', 'A', 1, 0],
        ['b', 'B', 0, 20],
        ['c', 'C', 0, 40],
        ['d', 'D', -1, 60],
      ]),
      fit = referenceLine(r, 'fit'),
      end = referenceLine(r);
    const sum = line => r.members.reduce((s, m) => s + GEO.distToLine(line, m.lat, m.lon).d ** 2, 0);
    expect(sum(fit)).toBeLessThan(sum(end));
    expect(fit.brg).not.toBe(end.brg);
  });
});
