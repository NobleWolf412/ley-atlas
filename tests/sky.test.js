import { describe, expect, it } from 'vitest';
import {
  angleBetween,
  chanceOfMatch,
  lineMatches,
  obliquity,
  riseAzimuth,
  skyEvents,
} from '../src/core/sky.js';

const STONEHENGE_LAT = 51.1789;

describe('obliquity (tilt of the axis)', () => {
  it('is 23.439° in AD 2000 and about 24.02° in 3000 BC', () => {
    expect(obliquity(2000)).toBeCloseTo(23.4393, 3);
    expect(obliquity(-2999)).toBeCloseTo(24.02, 1);
  });
  it('was larger in the past', () => {
    expect(obliquity(-999)).toBeGreaterThan(obliquity(1000));
  });
});

describe('riseAzimuth', () => {
  it('puts the equinox sunrise due east on a flat, airless horizon', () => {
    expect(riseAzimuth(40, 0, 0)).toBeCloseTo(90, 9);
  });
  it('with refraction, the equinox sun first shows a little north of east', () => {
    const az = riseAzimuth(STONEHENGE_LAT, 0, -0.833);
    expect(az).toBeGreaterThan(88.5);
    expect(az).toBeLessThan(90);
  });
  it('gives the Stonehenge midsummer sunrise at about 49°', () => {
    expect(riseAzimuth(STONEHENGE_LAT, obliquity(2000), -0.833)).toBeCloseTo(49.3, 0);
  });
  it('is 90° − tilt at the equator for the June solstice', () => {
    expect(riseAzimuth(0, 23.44, 0)).toBeCloseTo(90 - 23.44, 6);
  });
  it('returns null where the sun does not rise or set that day', () => {
    expect(riseAzimuth(75, 23.44, -0.833)).toBeNull(); // midnight sun
    expect(riseAzimuth(75, -23.44, -0.833)).toBeNull(); // polar night
  });
});

describe('skyEvents', () => {
  it('lists 14 directions at a mid latitude, rises east of north–south, sets west', () => {
    const ev = skyEvents(STONEHENGE_LAT, 2000);
    expect(ev).toHaveLength(14);
    for (const e of ev) {
      if (e.id.endsWith('-rise')) expect(e.az).toBeLessThan(180);
      else expect(e.az).toBeGreaterThan(180);
    }
  });
  it('a set is the mirror of its rise', () => {
    const ev = skyEvents(STONEHENGE_LAT, -2999);
    const rise = ev.find(e => e.id === 'sun-june-rise'),
      set = ev.find(e => e.id === 'sun-june-set');
    expect(rise.az + set.az).toBeCloseTo(360, 9);
  });
  it('leaves out events that do not happen at high latitude', () => {
    expect(skyEvents(70, 2000).length).toBeLessThan(14);
  });
});

describe('lineMatches', () => {
  const ev = skyEvents(STONEHENGE_LAT, 2000);
  const june = ev.find(e => e.id === 'sun-june-rise');
  it('finds the solstice along the line, in either direction', () => {
    expect(lineMatches(june.az + 0.4, ev, 1)[0].id).toBe('sun-june-rise');
    const back = lineMatches(june.az + 180 - 0.4, ev, 1)[0];
    expect(back.id).toBe('sun-june-rise');
    expect(back.back).toBe(true);
  });
  it('reports how far off it is', () => {
    expect(lineMatches(june.az + 0.7, ev, 1)[0].off).toBeCloseTo(0.7, 9);
  });
  it('a line pointing at nothing has no matches', () => {
    expect(lineMatches(0, ev, 1)).toEqual([]); // due north
  });
  it('angleBetween wraps round', () => {
    expect(angleBetween(359, 1)).toBeCloseTo(2, 9);
  });
});

describe('chanceOfMatch (luck)', () => {
  it('one direction within ±1° is hit by about 1 line in 90', () => {
    expect(chanceOfMatch([{ az: 50 }], 1)).toBeCloseTo(2 / 180, 3);
  });
  it('the full set of sun and moon directions catches a large share of random lines', () => {
    const p = chanceOfMatch(skyEvents(STONEHENGE_LAT, 2000), 1);
    expect(p).toBeGreaterThan(0.1);
    expect(p).toBeLessThan(0.16);
  });
});
