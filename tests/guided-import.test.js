import { describe, expect, it } from 'vitest';
import {
  findImportMatches,
  importSearchIndex,
  readPastedSites,
  pastedCoordinates,
  prepareImportReview,
  reviewedImportRows,
} from '../src/core/guided-import.js';
import { parseImport, rowsFromMap } from '../src/core/site-import.js';

const points = [
  { id: 'stonehenge', n: 'Stonehenge', lat: 51.1789, lon: -1.8262, cat: 'megalith', reg: 'England' },
  { id: 'copy', n: 'Stonehenge', lat: 51.179, lon: -1.826, cat: 'megalith', reg: 'England' },
  { id: 'mont', n: 'Mont-Saint-Michel', lat: 48.636, lon: -1.511, cat: 'church', reg: 'France' },
  { id: 'delphi', n: 'Temple of Apollo, Delphi', lat: 38.482, lon: 22.501, cat: 'temple', reg: 'Greece' },
  { id: 'mary1', n: 'St. Mary’s Church', lat: 51, lon: 0, cat: 'church', reg: 'England' },
  { id: 'mary2', n: 'Saint Marys Church', lat: 52, lon: 1, cat: 'church', reg: 'England' },
];
const index = () => importSearchIndex(points);
describe('friendly paste parsing', () => {
  it('reads bullets, names, inline coordinates and coordinate-only following lines', () => {
    const result = readPastedSites(
      '• Stonehenge\n2. Mont Saint-Michel\n51.0000, -1.0000\nMy place (40.2, -70.1)',
    );
    expect(result.entries).toHaveLength(3);
    expect(result.entries[0].label).toBe('Stonehenge');
    expect(result.entries[1]).toMatchObject({ label: 'Mont Saint-Michel', location: { lat: 51, lon: -1 } });
    expect(result.entries[2]).toMatchObject({ label: 'My place', location: { lat: 40.2, lon: -70.1 } });
  });
  it.each([
    ['51.1789, -1.8262', 51.1789, -1.8262],
    ['51.1789 N 1.8262 W', 51.1789, -1.8262],
    ['POINT(-1.8262 51.1789)', 51.1789, -1.8262],
    ['https://www.google.com/maps/@51.1789,-1.8262,17z', 51.1789, -1.8262],
    ['https://maps.google.com/?q=51.1789,-1.8262', 51.1789, -1.8262],
    ['latitude: 51.1789 longitude: -1.8262', 51.1789, -1.8262],
  ])('reads %s without reversing coordinates', (text, lat, lon) => {
    expect(pastedCoordinates(text)).toMatchObject({ lat, lon });
  });
  it('reads DMS and rejects invalid minutes and out-of-range positions', () => {
    expect(pastedCoordinates(`51°10'44"N 1°49'34"W`).lat).toBeCloseTo(51.178889, 5);
    expect(pastedCoordinates(`51°70'44"N 1°49'34"W`)).toEqual({ invalid: true });
    expect(pastedCoordinates('95.0, 200.0')).toEqual({ invalid: true });
  });
  it('does not turn years, short map links or empty text into locations', () => {
    expect(pastedCoordinates('built 1580 and 1620')).toBeNull();
    expect(pastedCoordinates('https://maps.app.goo.gl/abc123')).toBeNull();
    expect(readPastedSites('  ').error).toBeTruthy();
    expect(readPastedSites(Array(502).fill('place').join('\n')).error).toMatch(/500/);
  });
  it('keeps invalid coordinate entries for correction rather than guessing from a name', () => {
    const review = prepareImportReview(readPastedSites('Stonehenge 95.0, 200.0').entries, index());
    expect(review[0].invalid).toBe(true);
    expect(review[0].selected).toBe(false);
    expect(reviewedImportRows(review)).toEqual([]);
  });
});
describe('offline atlas matching', () => {
  it('handles punctuation, saint variants and country qualifiers', () => {
    expect(findImportMatches('Mont Saint-Michel', index())[0].id).toBe('mont');
    expect(findImportMatches('Delphi, Greece', index())[0].id).toBe('delphi');
    expect(findImportMatches('Saint Marys Church', index())).toHaveLength(2);
  });
  it('deduplicates nearby catalogue copies but requires a choice for distinct namesakes', () => {
    const review = prepareImportReview(
      readPastedSites('Stonehenge\nSt. Mary’s Church\nUnknown place\nDelphi, Greece').entries,
      index(),
    );
    expect(review[0].selected).toBe(true);
    expect(review[0].candidates).toHaveLength(1);
    expect(review[1].selected).toBe(false);
    expect(review[1].candidates).toHaveLength(2);
    expect(review[2].selected).toBe(false);
    expect(review[3].selected).toBe(false);
  });
  it('imports only selected, located entries and preserves their provenance', () => {
    const review = prepareImportReview(
      readPastedSites('Stonehenge\nStonehenge\nDelphi, Greece\nUnknown place\nMy point 30.1, -90.2').entries,
      index(),
    );
    review[2].choice = review[2].candidates[0];
    review[2].selected = true;
    review[2].coordinateSource = 'Atlas match';
    const rows = reviewedImportRows(review);
    expect(rows).toHaveLength(3);
    expect(rows[0].matchedSiteId).toBeTruthy();
    expect(rows[1].n).toBe('Temple of Apollo, Delphi');
    expect(rows[2]).toMatchObject({
      n: 'My point',
      lat: 30.1,
      lon: -90.2,
      coordinateSource: 'Pasted coordinates',
    });
  });
});
describe('existing structured imports', () => {
  it('keeps the first named data row in a headerless CSV', () => {
    const parsed = parseImport('First site,51.5,-.12\nSecond site,48.86,2.337');
    // Coordinates with a leading zero remain the canonical CSV format.
    const canonical = parseImport('First site,51.5,-0.12\nSecond site,48.86,2.337');
    expect(canonical.body).toHaveLength(2);
    expect(rowsFromMap(canonical).rows.map(r => r.n)).toEqual(['First site', 'Second site']);
    expect(parsed.err).toBeUndefined();
  });
  it('retains headers, TSV and quoted coordinate fields', () => {
    const csv = parseImport('name,coordinates,type\nStonehenge,"51.1789, -1.8262",megalith');
    expect(rowsFromMap(csv).rows[0]).toMatchObject({ n: 'Stonehenge', lat: 51.1789, lon: -1.8262 });
    const tsv = parseImport('name\tlatitude\tlongitude\nA\t0\t0');
    expect(rowsFromMap(tsv).rows[0]).toMatchObject({ n: 'A', lat: 0, lon: 0 });
  });
});
