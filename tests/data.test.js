// Guards the datasets in public/data: every file parses and site coordinates are valid.
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const DIR = new URL('../public/data/', import.meta.url);
const load = f => JSON.parse(readFileSync(new URL(f, DIR), 'utf8'));
const okLat = v => typeof v === 'number' && v >= -90 && v <= 90;
const okLon = v => typeof v === 'number' && v >= -180 && v <= 180;

describe('datasets', () => {
  it('every file in public/data is valid JSON', () => {
    const files = readdirSync(DIR).filter(f => f.endsWith('.json'));
    expect(files.length).toBe(18);
    for (const f of files) expect(() => load(f), f).not.toThrow();
  });
  it('star forts have valid coordinates', () => {
    const forts = load('star-forts.json');
    expect(forts.length).toBeGreaterThan(1000);
    for (const f of forts) {
      expect(okLat(f.lat), `${f.id} lat`).toBe(true);
      expect(okLon(f.lon), `${f.id} lon`).toBe(true);
    }
  });
  it('wonders have valid coordinates and unique ids', () => {
    const w = load('wonders.json');
    expect(new Set(w.map(x => x.id)).size).toBe(w.length);
    for (const x of w) expect(okLat(x.lat) && okLon(x.lon), x.id).toBe(true);
  });
});
