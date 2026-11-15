// What the map shows when zoomed out
import { highlightedSites } from './hooks.js';
import { $, nf } from '../core/util.js';
import { MATCHBY } from '../domain/analysis.js';
import { activeLine } from '../domain/lines.js';
import { clear } from '../layers/underground.js';
import { ctx } from './canvas.js';
import { HITS } from './draw.js';
import { C } from '../render/palette.js';
import { V2 } from '../state/preferences.js';
import { S } from '../state/state.js';

// ---------- what the map shows when zoomed out (the user picks) ----------
// key = notable sites only · heat = soft density shading · groups = numbered bubbles · all = every site
export const ZOOM_MODES = [
  ['key', 'Key sites', 'Only the best-known sites; everything appears as you zoom in'],
  ['heat', 'Density', 'Soft shading where sites are dense, no numbers'],
  ['groups', 'Groups', 'A few large numbered bubbles'],
  ['all', 'Every site', 'All markers, which can crowd at continent scale'],
];
const WIDE_RV = 300;
export let CLB = null,
  ZM = 'all',
  ZMHIDDEN = 0;
export function v2IsKey(s) {
  if (s._key != null) return s._key;
  return (s._key =
    s.set === 'core' ||
    s.set === 'wonder' ||
    s.set === 'megalith' ||
    !!s.stone ||
    s.set === 'import' ||
    s.set === 'marker' ||
    (s.set === 'castle' && s.rank <= 150) ||
    (s.cat === 'fort' && !!(s.wikiUrl || (s.fort && s.fort.pts))) ||
    (s.set === 'unesco' &&
      s.cls !== 'feature' &&
      /cathedral|temple|pyramid|castle|fort|citadel|abbey/i.test(s.n)));
}
export function v2ClusterBegin(rv) {
  ZM = rv > WIDE_RV ? V2.zoomMode : 'all';
  ZMHIDDEN = 0;
  CLB = ZM === 'groups' || ZM === 'heat' ? new Map() : null;
  return !!CLB;
}
export function v2Pinned(s) {
  if (S.sel?.id === s.id) return true;
  if (V2.pick.a === s.id || highlightedSites()?.has(s.id)) return true;
  const L = activeLine();
  if (L && L.anchors.includes(s.id)) return true;
  const m = MATCHBY.get(s.id);
  return !!(m && m.status !== 'out');
}
export function v2Bin(s, p) {
  const cell = ZM === 'heat' ? 26 : 104;
  const k = Math.floor(p[0] / cell) + ',' + Math.floor(p[1] / cell);
  let b = CLB.get(k);
  if (!b) CLB.set(k, (b = []));
  b.push([s, p]);
}
const CATCOL = () => ({
  fort: C.star,
  castle: C.castle,
  megalith: C.megalith,
  church: C.church,
  temple: C.temple,
  ruin: C.ruin,
  mountain: C.mountain,
  obelisk: C.mountain,
  landmark: C.landmark,
  heritage: C.dotUn,
  marker: C.marker,
});
export const CATWORD = {
  fort: 'star forts',
  castle: 'castles',
  megalith: 'megaliths',
  church: 'churches',
  temple: 'temples',
  ruin: 'ruins',
  mountain: 'natural sites',
  obelisk: 'standing stones',
  landmark: 'landmarks',
  heritage: 'UNESCO sites',
  marker: 'markers',
};
export function v2ClusterFlush(icons) {
  if (!CLB) {
    v2ZoomNote();
    return;
  }
  const cols = CATCOL(),
    heat = ZM === 'heat';
  ctx.save();
  for (const b of CLB.values()) {
    if (!heat && b.length === 1) {
      icons.push(b[0]);
      continue;
    }
    let x = 0,
      y = 0;
    const cnt = {};
    for (const [s, p] of b) {
      x += p[0];
      y += p[1];
      cnt[s.cat] = (cnt[s.cat] || 0) + 1;
    }
    x /= b.length;
    y /= b.length;
    const order = Object.entries(cnt).sort((u, v) => v[1] - u[1]),
      top = order[0][0],
      col = cols[top] || C.text;
    if (heat) {
      const r = 14 + Math.min(22, Math.log2(b.length + 1) * 5),
        g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, col);
      g.addColorStop(1, clear(col));
      ctx.globalAlpha = Math.min(0.55, 0.16 + Math.log2(b.length + 1) * 0.07);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 7);
      ctx.fill();
      HITS.push({ x, y, r: Math.max(16, r * 0.6), type: 'cluster', ref: order, n: b.length, pri: 0 });
      continue;
    }
    const r = Math.min(20, 11 + Math.log2(b.length) * 1.8);
    ctx.globalAlpha = 0.94;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 7);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--cluster').trim() || '#fff';
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = col;
    ctx.stroke();
    ctx.fillStyle = C.text;
    ctx.font = '700 10.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      b.length > 999 ? (b.length / 1000).toFixed(b.length > 9999 ? 0 : 1) + 'k' : String(b.length),
      x,
      y + 0.5,
    );
    HITS.push({ x, y, r: Math.max(22, r + 6), type: 'cluster', ref: order, n: b.length, pri: 1 });
  }
  ctx.restore();
  CLB = null;
  v2ZoomNote();
}
function v2ZoomNote() {
  const el = $('#v2zoomnote');
  if (!el) return;
  const t =
    ZM === 'key' && ZMHIDDEN
      ? `Key sites only · ${nf(ZMHIDDEN)} more appear as you zoom in`
      : ZM === 'heat'
        ? 'Shading shows where sites cluster · zoom in for markers'
        : ZM === 'groups'
          ? 'Numbers are site counts · tap a bubble to zoom in'
          : '';
  if (el.textContent !== t) el.textContent = t;
  el.hidden = !t;
}

// Setters for variables that other modules change.
export function setZMHIDDEN(v) {
  return (ZMHIDDEN = v);
}
