// Line details: underground along the line, precision
import { GEO } from '../core/geo.js';
import { $$, R, R2D, esc } from '../core/util.js';
import { CLASSES } from '../data/catalog.js';
import { MATCH } from '../domain/analysis.js';
import { LINEBY, lineUncAt } from '../domain/lines.js';
import { catOn, findPoint, srcOn } from '../domain/points.js';
import { DEPV, UG, UGBIT, depData, depVecs } from '../domain/underground.js';
import { fmtKm } from '../core/format.js';
import { V2 } from '../state/preferences.js';
import { S, persistImports } from '../state/state.js';
import { v2SelectSite } from '../ui/panels.js';
import { changed } from '../ui/sheet.js';

// ================= LINES pane =================
export function tag(cls) {
  return `<span class="tag ${cls}">${esc(CLASSES[cls] || cls)}</span>`;
}
let UGL = null;
/** Forget the cached deposits-along-the-line result (the deposits dataset changed). */
export function resetLineUnderground() {
  UGL = null;
}
export function ugAlongLine(L, w) {
  const key = L.id + '|' + w + '|' + L.segs.map(g => g.brg.toFixed(6) + g.o.join() + '/' + g.len).join();
  if (UGL && UGL.key === key) return UGL;
  const D = depData();
  depVecs(0);
  const counts = {},
    near = [];
  for (const [g] of UG) counts[g] = 0;
  const sw = Math.sin(w / R);
  for (const sg of L.segs) {
    const f = sg.f || (sg.f = GEO.frame(sg.o[0], sg.o[1], sg.brg)),
      n0 = f.n[0],
      n1 = f.n[1],
      n2 = f.n[2],
      full = !isFinite(sg.len);
    for (let k = 0; k < D.n; k++) {
      if (D.approx[k]) continue;
      const dn = n0 * DEPV[k * 3] + n1 * DEPV[k * 3 + 1] + n2 * DEPV[k * 3 + 2];
      if (Math.abs(dn) > sw) continue;
      let d = Math.asin(Math.min(1, Math.abs(dn))) * R;
      if (!full) {
        const r = GEO.distToLine(sg, D.lat[k], D.lon[k]);
        if (r.d > w) continue;
        d = r.d;
      }
      near.push({ k, d });
    }
  }
  const seen = new Set();
  const uniq = near.sort((a, b) => a.d - b.d).filter(o => !seen.has(o.k) && seen.add(o.k));
  for (const o of uniq) for (const [g] of UG) if (D.m[o.k] & UGBIT[g]) counts[g]++;
  return (UGL = { key, counts, near: uniq, total: uniq.length });
}
export function precisionBlock(L) {
  const A = findPoint(L.anchors[0]),
    B = findPoint(L.anchors[1]);
  if (!A || !B) return '';
  const far = MATCH.filter(m => !m.anchor && m.status !== 'out' && Math.abs(m.at) > 100).sort(
    (a, b) => Math.abs(b.at) - Math.abs(a.at),
  )[0];
  const rows = [1, 10, 100, 1000, 5000].map(d => [fmtKm(d), lineUncAt(L, d)]),
    mx = lineUncAt(L, 5000);
  return `<h2>How precise is this line?</h2><p class="lede">Two anchors ${fmtKm(GEO.dist(A.lat, A.lon, B.lat, B.lon))} apart, known to about ±${fmtKm((A.unc || 0) / 1000)} and ±${fmtKm((B.unc || 0) / 1000)}, fix the bearing to <b class="mono">±${(L.sigma * R2D).toFixed(2)}°</b>. The farther out, the wider the line really is:</p>
  <div class="bars">${rows.map(([d, u]) => `<div class="bar"><span class="mono">${d}</span><i style="width:${Math.max(1, Math.sqrt(u / mx) * 100)}%"></i><b class="mono">±${fmtKm(u)}</b></div>`).join('')}${far ? `<div class="bar hot"><span>${esc(far.p.n)}</span><i style="width:${Math.max(1, Math.sqrt(far.lu / mx) * 100)}%"></i><b class="mono">±${fmtKm(far.lu)}</b></div>` : ''}</div>`;
}
export function setActive(id) {
  S.active = id;
  const L = LINEBY[id];
  if (L && !S.layers[L.layer]) S.layers[L.layer] = true;
  changed();
}
export function bindSiteRows(root) {
  $$(root + ' [data-site]').forEach(r => (r.onclick = () => focusSite(r.dataset.site)));
}
export function revealPoint(s) {
  let ch = false;
  if (!catOn(s)) {
    S.layers.cat[s.cat] = true;
    ch = true;
  }
  if (!srcOn(s)) {
    if (s.set === 'import') {
      const im = S.imports.find(i => i.id === s.imp);
      if (im) im.on = true;
      persistImports();
    } else S.src[s.set] = true;
    ch = true;
  }
  return ch;
}
function focusSite(id) {
  V2.host = null;
  v2SelectSite(id);
}
