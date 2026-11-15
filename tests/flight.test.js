import { describe, expect, it } from 'vitest';
import {
  buildFlightPath,
  flightCoords,
  flightPosition,
  flightSeconds,
  flightZoom,
  stopsAlong,
  stopsNear,
  turn,
} from '../src/core/flight.js';
import { GEO } from '../src/core/geo.js';

const STONEHENGE = [51.1789, -1.8262];
const BOURTANGE = [53.0066, 7.1921];
const seg = (a, b) => ({ o: a, brg: GEO.bearing(...a, ...b), len: GEO.dist(...a, ...b) });

describe('flight path', () => {
  const path = buildFlightPath([seg(STONEHENGE, BOURTANGE)]);
  it('is as long as the line and starts and ends on its end points', () => {
    expect(path.length).toBeCloseTo(GEO.dist(...STONEHENGE, ...BOURTANGE), 6);
    const a = flightPosition(path, 0),
      b = flightPosition(path, path.length);
    expect(GEO.dist(a.lat, a.lon, ...STONEHENGE)).toBeLessThan(0.001);
    expect(GEO.dist(b.lat, b.lon, ...BOURTANGE)).toBeLessThan(0.001);
  });
  it('heads the way the line runs', () => {
    expect(flightPosition(path, 0).bearing).toBeCloseTo(GEO.bearing(...STONEHENGE, ...BOURTANGE), 1);
  });
  it('clamps positions outside the path to its ends', () => {
    expect(flightPosition(path, -50)).toEqual(flightPosition(path, 0));
    expect(flightPosition(path, path.length + 50)).toEqual(flightPosition(path, path.length));
  });
  it('chains legs for a path through several sites', () => {
    const mid = [52, 3];
    const two = buildFlightPath([seg(STONEHENGE, mid), seg(mid, BOURTANGE)]);
    expect(two.length).toBeCloseTo(GEO.dist(...STONEHENGE, ...mid) + GEO.dist(...mid, ...BOURTANGE), 6);
    const p = flightPosition(two, two.legs[1].start);
    expect(GEO.dist(p.lat, p.lon, ...mid)).toBeLessThan(0.001);
  });
  it('a line right round the globe is one full circle', () => {
    const round = buildFlightPath([{ o: STONEHENGE, brg: 68, len: Infinity }]);
    expect(round.length).toBeCloseTo(2 * Math.PI * GEO.R, 3);
  });
});

describe('flightCoords', () => {
  it('keeps longitudes continuous across the date line', () => {
    const path = buildFlightPath([seg([10, 170], [10, -170])]);
    const lons = flightCoords(path, 50).map(c => c[0]);
    for (let i = 1; i < lons.length; i++) expect(Math.abs(lons[i] - lons[i - 1])).toBeLessThan(5);
    expect(lons.at(-1)).toBeCloseTo(190, 3);
  });
});

describe('stops', () => {
  const path = buildFlightPath([seg(STONEHENGE, BOURTANGE)]);
  const half = flightPosition(path, path.length / 2);
  const beside = GEO.dest(half.lat, half.lon, half.bearing - 90, 3); // 3 km to the left of travel
  const stops = stopsAlong(path, [
    { id: 'far', lat: 40, lon: 30 }, // beyond the end of the line
    { id: 'end', lat: BOURTANGE[0], lon: BOURTANGE[1] },
    { id: 'beside', lat: beside[0], lon: beside[1] },
  ]);
  it('places each item by distance along and to the side, in travel order', () => {
    expect(stops.map(s => s.item.id)).toEqual(['beside', 'end']);
    expect(stops[0].km).toBeCloseTo(path.length / 2, 0);
    expect(stops[0].off).toBeCloseTo(3, 1);
    expect(stops[1].km).toBeCloseTo(path.length, 1);
  });
  it('finds what is near the current position, nearest first', () => {
    expect(stopsNear(stops, path.length / 2 + 5, 20).map(s => s.item.id)).toEqual(['beside']);
    expect(stopsNear(stops, 10, 20)).toEqual([]);
  });
});

describe('flight settings', () => {
  it('zooms out and takes longer for longer lines, within limits', () => {
    expect(flightZoom(20)).toBeGreaterThan(flightZoom(648));
    expect(flightZoom(648)).toBeGreaterThan(flightZoom(20000));
    expect(flightSeconds(5)).toBeCloseTo(40, 0);
    expect(flightSeconds(648)).toBeCloseTo(94, 0);
    expect(flightSeconds(40000)).toBe(180);
  });
  it('turn() takes the short way round', () => {
    expect(turn(350, 10)).toBe(20);
    expect(turn(10, 350)).toBe(-20);
  });
});
