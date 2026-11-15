import { describe, expect, it } from 'vitest';
import { decodeShare, encodeShare } from '../src/core/share.js';

describe('share links', () => {
  it('round-trips a line between two sites', () => {
    const d = { sites: ['stonehenge', 'sf-1024'], global: false, corridorKm: 5 };
    const q = encodeShare(d);
    expect(q).toBe('?a=stonehenge&b=sf-1024&w=5');
    expect(decodeShare(q)).toEqual({ sites: ['stonehenge', 'sf-1024'], corridorKm: 5 });
  });
  it('round-trips a freehand line to about a metre, with its name and globe flag', () => {
    const ends = [
      [51.178912, -1.826215],
      [53.0066, 7.1921],
    ];
    const back = decodeShare(encodeShare({ ends, name: 'Test line', global: true, corridorKm: 10 }));
    expect(back.global).toBe(true);
    expect(back.name).toBe('Test line');
    expect(back.ends[0][0]).toBeCloseTo(51.17891, 5);
    expect(back.ends[1][1]).toBeCloseTo(7.1921, 5);
  });
  it('round-trips a published line and a bare view', () => {
    expect(decodeShare(encodeShare({ line: 'primary', corridorKm: 25 }))).toEqual({
      line: 'primary',
      corridorKm: 25,
    });
    expect(decodeShare(encodeShare({ cam: { lon: 14, lat: 44, k: 2345.6 } }))).toEqual({
      cam: { lon: 14, lat: 44, k: 2346 },
    });
  });
  it('rejects junk instead of guessing', () => {
    expect(decodeShare('')).toBeNull();
    expect(decodeShare('?p=95,0;10,10')).toBeNull(); // latitude out of range
    expect(decodeShare('?p=10,10')).toBeNull(); // one point only
    expect(decodeShare('?a=x&b=x')).toBeNull(); // same site twice
    expect(decodeShare('?a=<script>&b=y')).toBeNull();
    expect(decodeShare('?c=1,2')).toBeNull();
    expect(decodeShare('?utm_source=x')).toBeNull();
  });
});
