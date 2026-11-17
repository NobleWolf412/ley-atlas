import { describe, expect, it } from 'vitest';
import { findAlignments, nudged } from '../src/core/alignments.js';
import { GEO } from '../src/core/geo.js';

// scattered sites with no line through them
const noise = () => {
  const r = GEO.rng(7);
  return Array.from({ length: 40 }, () => ({ lat: 50 + r() * 4, lon: r() * 6 }));
};
// six sites exactly on one line, 30 km apart
const onLine = Array.from({ length: 6 }, (_, k) => {
  const [lat, lon] = GEO.dest(51, 1, 70, 20 + k * 30);
  return { lat, lon, tag: 'L' + k };
});

describe('findAlignments', () => {
  it('finds a planted line and names its two end sites', () => {
    const pts = [...noise(), ...onLine];
    const [best] = findAlignments(pts, { widthKm: 0.5 });
    expect(best.count).toBe(6);
    expect([pts[best.a].tag, pts[best.b].tag].sort()).toEqual(['L0', 'L5']);
    expect(best.km).toBeCloseTo(150, 0);
    expect(best.rms).toBeLessThan(0.05);
  });
  it('reports the planted line once, not once per pair of its sites', () => {
    const lines = findAlignments([...noise(), ...onLine], { widthKm: 0.5 });
    expect(lines.filter(l => l.count >= 5).length).toBe(1);
  });
  it('a cluster of sites in one town counts once', () => {
    const [la, lo] = [onLine[2].lat, onLine[2].lon];
    const town = Array.from({ length: 5 }, (_, k) => ({ lat: la + k * 0.0005, lon: lo + k * 0.0005 }));
    const three = [onLine[0], onLine[2], onLine[5], ...town];
    expect(findAlignments(three, { widthKm: 1, minSites: 4 })).toEqual([]);
  });
  it('finds nothing in a handful of scattered sites', () => {
    expect(findAlignments(noise().slice(0, 8), { widthKm: 0.2, minSites: 5 })).toEqual([]);
  });
});

describe('nudged', () => {
  it('moves every site 5–25 km and breaks the planted line', () => {
    const moved = nudged(onLine, 3);
    moved.forEach((m, k) => {
      const d = GEO.dist(m.lat, m.lon, onLine[k].lat, onLine[k].lon);
      expect(d).toBeGreaterThanOrEqual(4.99);
      expect(d).toBeLessThanOrEqual(25.01);
    });
    expect(findAlignments(moved, { widthKm: 0.5, minSites: 6 })).toEqual([]);
  });
});
