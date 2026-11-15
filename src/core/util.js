// DOM helpers, escaping and number formatting
import { GEO } from './geo.js';

export const D2R = Math.PI / 180;
export const R2D = 180 / Math.PI;
export let R, PIR;
export const $ = s => document.querySelector(s);
export const $$ = s => document.querySelectorAll(s);
export const esc = s =>
  String(s ?? '').replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
export const wrap = d => ((d + 540) % 360) - 180;
export let reduceMotion;
export const nf = n => Number(n).toLocaleString('en-US');

export function initUtil() {
  R = GEO.R;
  PIR = Math.PI * GEO.R;
  reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
}
