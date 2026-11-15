import { describe, expect, it } from 'vitest';
import { fairP, independentDirections } from '../src/core/stats.js';

describe('fairP: allowing for picking the best of many directions', () => {
  it('matches the changelog example: p = 0.001 with 689 directions → fair p ≈ 0.50', () => {
    expect(fairP(0.001, 689)).toBeCloseTo(0.498, 3);
  });
  it('one try changes nothing', () => {
    expect(fairP(0.03, 1)).toBeCloseTo(0.03, 12);
  });
  it('never decreases as tries grow', () => {
    expect(fairP(0.01, 10)).toBeGreaterThan(fairP(0.01, 5));
  });
});

describe('independentDirections', () => {
  it('is about π · length / corridor', () => {
    expect(independentDirections(10000, 1000, 5)).toBe(Math.round((Math.PI * 1000) / 5)); // 628
  });
  it('is capped by the number of candidate sites and never below 1', () => {
    expect(independentDirections(50, 1000, 5)).toBe(50);
    expect(independentDirections(10, 0, 5)).toBe(1);
  });
  it('treats corridors under 0.5 km as 0.5 km', () => {
    expect(independentDirections(1e6, 100, 0.1)).toBe(Math.round((Math.PI * 100) / 0.5));
  });
});
