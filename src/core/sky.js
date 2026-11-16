// Sun and moon directions on the horizon, for checking whether a line points at them
// (pure: no DOM, no state)
//
// Simplifications, stated in the app as well:
//  * a flat horizon (real hills move a rising point by about 1–2° per degree of horizon height)
//  * mean positions: the moon's small extra wobble (about 0.15°) and nutation are ignored
//  * the sun counts as rising when its upper edge clears the horizon (altitude −0.833°, the
//    usual almanac value including refraction); the moon at altitude +0.125° (its parallax
//    outweighs refraction and its radius)

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

/** Tilt of Earth's axis (degrees) in a given year (negative = BC, astronomical: 1 BC = 0). */
export function obliquity(year) {
  // Laskar (1986), valid for about ±10,000 years around AD 2000; t in units of 10,000 Julian years
  const t = (year - 2000) / 10000;
  const c = [-4680.93, -1.55, 1999.25, -51.38, -249.67, -39.05, 7.12, 27.87, 5.79, 2.45];
  let arcsec = 84381.448,
    tp = 1;
  for (const k of c) {
    tp *= t;
    arcsec += k * tp;
  }
  return arcsec / 3600;
}

/** Inclination of the moon's orbit to the ecliptic, degrees (mean value). */
export const MOON_INCLINATION = 5.145;

/**
 * Azimuth (degrees clockwise from north) where a body with declination `decl` crosses
 * altitude `alt` while rising, at latitude `lat`. Null when it never rises or never sets there.
 */
export function riseAzimuth(lat, decl, alt) {
  const c =
    (Math.sin(decl * D2R) - Math.sin(lat * D2R) * Math.sin(alt * D2R)) /
    (Math.cos(lat * D2R) * Math.cos(alt * D2R));
  if (!(Math.abs(c) <= 1)) return null;
  return Math.acos(c) * R2D;
}

/**
 * The rising and setting directions that alignment research usually looks for.
 * @returns [{ id, body: 'sun'|'moon', label, az }] — events that do not happen at this
 *   latitude (for example near the poles) are left out
 */
export function skyEvents(lat, year = 2000) {
  const e = obliquity(year),
    i = MOON_INCLINATION;
  const kinds = [
    ['sun-june', 'sun', 'June solstice', e, -0.833],
    ['sun-equinox', 'sun', 'Equinox', 0, -0.833],
    ['sun-december', 'sun', 'December solstice', -e, -0.833],
    ['moon-major-north', 'moon', 'Major lunar standstill, northern', e + i, 0.125],
    ['moon-minor-north', 'moon', 'Minor lunar standstill, northern', e - i, 0.125],
    ['moon-minor-south', 'moon', 'Minor lunar standstill, southern', -(e - i), 0.125],
    ['moon-major-south', 'moon', 'Major lunar standstill, southern', -(e + i), 0.125],
  ];
  const out = [];
  for (const [id, body, name, decl, alt] of kinds) {
    const az = riseAzimuth(lat, decl, alt);
    if (az == null) continue;
    out.push({ id: id + '-rise', body, label: `${name} ${body}rise`, az });
    out.push({ id: id + '-set', body, label: `${name} ${body}set`, az: 360 - az });
  }
  return out;
}

/** Smallest angle between two directions, degrees (0–180). */
export const angleBetween = (a, b) => Math.abs(((((a - b) % 360) + 540) % 360) - 180);

/**
 * Which events the line points at, looking either way along it from this spot.
 * @param bearing direction of the line here, degrees
 * @returns [{ ...event, off, back }] within `tol` degrees, closest first;
 *   back = true when it is the opposite direction along the line that matches
 */
export function lineMatches(bearing, events, tol) {
  const out = [];
  for (const ev of events) {
    const fwd = angleBetween(bearing, ev.az),
      back = angleBetween(bearing + 180, ev.az);
    const off = Math.min(fwd, back);
    if (off <= tol) out.push({ ...ev, off, back: back < fwd });
  }
  return out.sort((a, b) => a.off - b.off);
}

/**
 * How often a line drawn in a random direction would match at least one event within `tol`
 * degrees (either way along it). This is the chance of a "hit" by luck alone.
 */
export function chanceOfMatch(events, tol, step = 0.02) {
  let hit = 0,
    n = 0;
  for (let d = 0; d < 180; d += step, n++) if (lineMatches(d, events, tol).length) hit++;
  return hit / n;
}

/** Era choices offered in the app: [year, label]. */
export const ERAS = [
  [2000, 'Today'],
  [1000, 'AD 1000'],
  [0, 'AD 1 / 1 BC'],
  [-999, '1000 BC'],
  [-1999, '2000 BC'],
  [-2999, '3000 BC'],
];
