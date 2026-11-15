// Formatting for distances, coordinates and map links (pure: no DOM, no state)
import { nf } from './util.js';

export function fmtKm(d) {
  if (!isFinite(d)) return '∞';
  if (d < 1) return Math.round(d * 1000) + ' m';
  if (d < 10) return d.toFixed(2) + ' km';
  if (d < 100) return d.toFixed(1) + ' km';
  return nf(Math.round(d)) + ' km';
}
export function fmtLL(lat, lon, dp = 5) {
  return `${Math.abs(lat).toFixed(dp)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(dp)}°${lon >= 0 ? 'E' : 'W'}`;
}
// Google's documented cross-platform link: a pin exactly on these coordinates, in the Google Maps app on phones or the website on a computer.
// (Links that also force the satellite view are not honoured by the phone app, which then shows the wrong place; tap Layers → Satellite there.)
export function satUrl(lat, lon) {
  return `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)}%2C${lon.toFixed(6)}`;
}
