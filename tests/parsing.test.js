import { describe, expect, it } from 'vitest';
import { parseCoords } from '../src/panels/forts-pane.js';
import { parseImport, splitCSV } from '../src/features/import.js';
import { dec } from '../src/core/polyline.js';

describe('parseCoords', () => {
  it('reads degrees-minutes-seconds', () => {
    const [[lat, lon]] = parseCoords(`51°10'44"N 1°49'34"W`);
    expect(lat).toBeCloseTo(51.17889, 4);
    expect(lon).toBeCloseTo(-1.82611, 4);
  });
  it('reads decimal pairs and ignores integer-only noise', () => {
    expect(parseCoords('53.0313, 4.8281')).toEqual([[53.0313, 4.8281]]);
    expect(parseCoords('built 1580 and 1620')).toEqual([]);
  });
});

describe('splitCSV', () => {
  it('detects the delimiter and handles quoted fields', () => {
    const { rows, delim } = splitCSV('name;lat;lon\n"Fort ""A""; north";52.1;5.2\n');
    expect(delim).toBe(';');
    expect(rows[1][0]).toBe('Fort "A"; north');
  });
});

describe('parseImport', () => {
  it('reads GeoJSON points and skips features without usable coordinates', () => {
    const r = parseImport(
      JSON.stringify({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [4.8281, 53.0313] },
            properties: { name: 'Fort De Schans' },
          },
          { type: 'Feature', geometry: null, properties: { name: 'No geometry' } },
        ],
      }),
    );
    expect(r.kind).toBe('GeoJSON');
    expect(r.fixed.rows).toHaveLength(1);
    expect(r.fixed.rows[0]).toMatchObject({ n: 'Fort De Schans', lat: 53.0313, lon: 4.8281 });
    expect(r.fixed.skipped).toEqual([2]);
  });
  it('reports unreadable JSON instead of throwing', () => {
    expect(parseImport('{ not json').err).toMatch(/could not be read/);
  });
});

describe('dec (encoded polyline decoder)', () => {
  it('decodes the standard Google polyline example', () => {
    const pts = dec('_p~iF~ps|U_ulLnnqC_mqNvxq`@', 1e5);
    expect(pts).toEqual([
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453],
    ]);
  });
});
