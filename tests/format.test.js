import { describe, expect, it } from 'vitest';
import { fmtKm, fmtLL, satUrl } from '../src/core/format.js';

describe('fmtKm', () => {
  it('uses metres below 1 km and fewer decimals as distances grow', () => {
    expect(fmtKm(0.25)).toBe('250 m');
    expect(fmtKm(5.256)).toBe('5.26 km');
    expect(fmtKm(42.34)).toBe('42.3 km');
    expect(fmtKm(648.4)).toBe('648 km');
    expect(fmtKm(12345)).toBe('12,345 km');
    expect(fmtKm(Infinity)).toBe('∞');
  });
});

describe('fmtLL', () => {
  it('writes hemispheres instead of signs', () => {
    expect(fmtLL(51.1789, -1.8262, 4)).toBe('51.1789°N 1.8262°W');
    expect(fmtLL(-33.8568, 151.2153, 2)).toBe('33.86°S 151.22°E');
  });
});

describe('satUrl (Google Maps link)', () => {
  it('pins the exact coordinates, to 6 decimals', () => {
    const url = new URL(satUrl(53.0313, 4.8281));
    expect(url.origin + url.pathname).toBe('https://www.google.com/maps/search/');
    expect(url.searchParams.get('api')).toBe('1');
    expect(url.searchParams.get('query')).toBe('53.031300,4.828100');
  });
});
