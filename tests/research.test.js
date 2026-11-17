import { describe, expect, it } from 'vitest';
import { RESEARCH_RECORDS, RESEARCH_SOURCES } from '../src/data/research.js';
import {
  normalizeResearch,
  coordinateSpread,
  filterResearch,
  researchGeometry,
  researchMetrics,
  referenceLine,
  parseNotebook,
} from '../src/core/research.js';
import { compareLine, researchFingerprint } from '../src/core/line-comparison.js';
import { GEO } from '../src/core/geo.js';

const library = () => normalizeResearch(RESEARCH_RECORDS, RESEARCH_SOURCES);
const get = id => library().collections.find(r => r.id === id);
describe('research source intake and publication', () => {
  it('retains all public source memberships while deduplicating shared entities', () => {
    const data = library();
    expect(data.collections).toHaveLength(17);
    expect(data.collections.reduce((n, r) => n + r.members.length, 0)).toBe(80);
    expect(data.sites.length).toBeLessThan(80);
    const skellig = data.sites.find(s => s.id === 'skellig');
    expect(skellig.positions).toHaveLength(2);
    expect(skellig.positions[0].lat).toBe(51.77);
    expect(skellig.positions[1].lat).toBe(51.771);
    expect(coordinateSpread(skellig)).toBeGreaterThan(0.1);
    expect(skellig.recordIds).toEqual(['michael', 'apollo']);
  });
  it('holds cultural routes and excludes personal interpretations from shipped records', () => {
    expect(RESEARCH_RECORDS.some(r => ['songlines', 'lungmei'].includes(r.id))).toBe(false);
    expect(JSON.stringify(RESEARCH_RECORDS)).not.toMatch(
      /Jyeshtha|Aries Lagna|natal|your chart|docs.google.com|drive.google.com/,
    );
    for (const r of library().collections) {
      expect(r.editorial.status).toBe('needs_source_review');
      expect(r.claims.every(c => c.sourceIds.length && c.section)).toBe(true);
      expect(r.members.every(m => m.uncertaintyM === null && m.sourceEntryId)).toBe(true);
    }
  });
  it('keeps conflicting world models distinct and does not manufacture topology', () => {
    expect(get('becker').members).toHaveLength(9);
    expect(researchGeometry(get('becker')).features.every(f => f.geometry.type === 'Point')).toBe(true);
    expect(researchGeometry(get('globalcircle')).features).toEqual([]);
    expect(get('mary').type).toBe('cluster');
  });
  it.each([
    r => ({ ...r, rows: [['bad', 'Invalid', 91, 0]] }),
    r => ({ ...r, rows: [['bad', 'Invalid', 0, 181]] }),
    r => ({ ...r, rows: [['bad', 'Invalid', NaN, 0]] }),
    r => ({ ...r, sourceIds: ['missing'] }),
    r => ({ ...r, type: 'parallel', latitude: 90 }),
    r => ({ ...r, type: 'meridian', longitude: Infinity }),
  ])('rejects malformed candidates before rendering', mutate => {
    expect(() => normalizeResearch([mutate(RESEARCH_RECORDS[0])], RESEARCH_SOURCES)).toThrow();
  });
  it('searches accents, aliases and sites within region/topic filters', () => {
    expect(filterResearch(library().collections, 'Sacsayhuaman').map(r => r.id)).toEqual(['viracocha']);
    expect(filterResearch(library().collections, 'Rose').map(r => r.id)).toEqual(['paris', 'americanrose']);
    expect(filterResearch(library().collections, 'Rose', 'all', 'France').map(r => r.id)).toEqual(['paris']);
    expect(filterResearch(library().collections, 'impossibleword')).toEqual([]);
  });
});
describe('geometry model correctness', () => {
  it('keeps exact meridians and latitude small circles distinct', () => {
    const meridian = researchGeometry(get('paris')).features.find(f => f.geometry.type === 'LineString')
      .geometry.coordinates;
    expect(new Set(meridian.map(p => p[0]))).toEqual(new Set([2.336]));
    const parallel = researchGeometry(get('parallel39')).features.find(f => f.geometry.type === 'LineString')
      .geometry.coordinates;
    expect(new Set(parallel.map(p => p[1]))).toEqual(new Set([39]));
    expect(parallel).toHaveLength(361);
    expect(Math.abs(GEO.dest(39, -120, 90, 3000)[0] - 39)).toBeGreaterThan(1);
  });
  it('surfaces source outliers without silently snapping them', () => {
    const r = get('parallel33'),
      result = researchMetrics(r);
    expect(result.offsets.at(-1)).toBeGreaterThan(1400);
    expect(r.members.at(-1).lat).toBe(46.191);
    expect(researchMetrics(get('americanrose')).maxOffsetKm).toBeGreaterThan(3);
  });
  it('uses existing geodesy for endpoint reference offsets and source sequence length', () => {
    const r = get('michael'),
      result = researchMetrics(r),
      line = referenceLine(r);
    expect(result.segments).toHaveLength(7);
    expect(result.offsets[2]).toBeCloseTo(GEO.distToLine(line, r.members[2].lat, r.members[2].lon).d, 9);
    expect(result.lengthKm).toBeCloseTo(
      result.segments.reduce((s, l) => s + l.len, 0),
      9,
    );
    expect(researchGeometry(r, true).features.filter(f => f.geometry.type === 'LineString')).toHaveLength(1);
  });
  it('does not create degenerate or antipodal reference lines', () => {
    expect(
      referenceLine({
        members: [
          { lat: 0, lon: 0 },
          { lat: 0, lon: 0 },
        ],
      }),
    ).toBeNull();
    expect(
      referenceLine({
        members: [
          { lat: 0, lon: 0 },
          { lat: 0, lon: 180 },
        ],
      }),
    ).toBeNull();
  });
});
describe('shared comparison engine', () => {
  it('counts fixtures and reproduces the two existing seeded null models', () => {
    const line = { o: [0, 0], brg: 90, len: 1000 };
    const pool = [
      { lat: 0, lon: 1 },
      { lat: 0, lon: 5 },
      { lat: 10, lon: 5 },
      { lat: 0, lon: 20 },
    ];
    for (const mode of ['rotate', 'random']) {
      const result = compareLine(line, pool, 1, mode, 42, 50);
      expect(result.obs).toBe(2);
      expect(result.hist).toHaveLength(50);
      expect(result).toEqual(compareLine(line, pool, 1, mode, 42, 50));
      expect(result.p).toBe((result.hist.filter(n => n >= 2).length + 1) / 51);
    }
  });
  it('fingerprints parameter content independent of object key order', () => {
    expect(researchFingerprint({ a: 1, b: [2, 3] })).toBe(researchFingerprint({ b: [2, 3], a: 1 }));
    expect(researchFingerprint({ a: 1 })).not.toBe(researchFingerprint({ a: 2 }));
  });
  it('rejects invalid test configuration', () => {
    expect(() => compareLine({}, [], 0, 'rotate')).toThrow();
    expect(() => compareLine({}, [], 1, 'invalid')).toThrow();
  });
});
describe('notebook import validation', () => {
  const ids = new Set(['michael']);
  it('rejects unknown collection IDs, duplicate entries and malformed investigations', () => {
    const wrap = entries => ({ format: 'ley-atlas-notebook', version: 1, entries });
    expect(() => parseNotebook(wrap([{ recordId: 'bad', text: '' }]), ids)).toThrow();
    expect(() =>
      parseNotebook(
        wrap([
          { recordId: 'michael', text: '' },
          { recordId: 'michael', text: '' },
        ]),
        ids,
      ),
    ).toThrow();
    expect(() => parseNotebook(wrap([{ recordId: 'michael', text: '', investigation: {} }]), ids)).toThrow();
  });
});
