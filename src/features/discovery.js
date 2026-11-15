// Discovery: what lies along the active line
import { addDrawLayer } from '../map/hooks.js';
import { GEO } from '../core/geo.js';
import { $, D2R, PIR, R, esc, nf } from '../core/util.js';
import { MATCH, analyse } from '../domain/analysis.js';
import { activeLine } from '../domain/lines.js';
import { enabledPoints } from '../domain/points.js';
import { faultData, magAt, plateData } from '../domain/underground.js';
import { ctx } from '../map/canvas.js';
import { req } from '../map/draw.js';
import { lineCoords } from '../map/line-sampling.js';
import { ugAlongLine } from '../panels/lines-pane.js';
import { C, STY } from '../render/palette.js';
import { V2 } from '../state/preferences.js';
import { S } from '../state/state.js';
import { v2ChangeTab } from '../ui/panels.js';
import { v2HandleAction } from '../ui/actions.js';

// ---------- discovery: what lies along the active line (cached per line + corridor) ----------
function v2CrossCheck(L, w, rows) {
  // mapped polylines (faults, plate boundaries) against the whole line
  const sw = Math.sin(w / R),
    hits = [];
  for (const sg of L.segs) {
    const f = sg.f || (sg.f = GEO.frame(sg.o[0], sg.o[1], sg.brg)),
      full = !isFinite(sg.len);
    for (const r of rows) {
      let best = null,
        prev = null,
        prevQ = null;
      for (const q of r.pts) {
        const cl = Math.cos(q[1] * D2R),
          v = [cl * Math.cos(q[0] * D2R), cl * Math.sin(q[0] * D2R), Math.sin(q[1] * D2R)],
          dn = GEO.dot(f.n, v);
        const crosses = prev != null && Math.sign(dn) !== Math.sign(prev) && Math.abs(dn - prev) < 0.1;
        const pq = prevQ;
        prev = dn;
        prevQ = q;
        if (!(Math.abs(dn) <= sw || crosses)) continue;
        let d = Math.asin(Math.min(1, Math.abs(dn))) * R,
          lat = q[1],
          lon = q[0];
        if (crosses) {
          // where the trace meets the line, interpolated between the two vertices
          const t = Math.abs(prevDn(pq, f)) / (Math.abs(prevDn(pq, f)) + Math.abs(dn));
          lat = pq[1] + (q[1] - pq[1]) * t;
          lon = pq[0] + (q[0] - pq[0]) * t;
          d = 0;
        }
        if (!full) {
          const t = GEO.distToLine(sg, lat, lon);
          if (!t.onSpan || (d > 0 && t.d > w)) continue;
          if (d > 0) d = t.d;
        }
        if (!best || d < best.d) best = { d, lat, lon };
      }
      if (best) hits.push({ ...best, r });
    }
  }
  hits.sort((a, b) => a.d - b.d);
  const seen = new Set(),
    uniq = hits.filter(h => !seen.has(h.r) && seen.add(h.r));
  return { n: uniq.length, crossed: uniq.filter(h => h.d === 0).length, list: uniq };
}
function prevDn(q, f) {
  const cl = Math.cos(q[1] * D2R);
  return GEO.dot(f.n, [cl * Math.cos(q[0] * D2R), cl * Math.sin(q[0] * D2R), Math.sin(q[1] * D2R)]);
}
function v2MagAlong(L) {
  // samples the magnetic grids along the line itself (Britain survey where it exists, world model elsewhere)
  const out = { km: 0, max: null, strong: 0, step: 2 };
  for (const sg of L.segs) {
    const f = sg.f || (sg.f = GEO.frame(sg.o[0], sg.o[1], sg.brg)),
      full = !isFinite(sg.len),
      len = full ? 2 * PIR : sg.len;
    const n = Math.min(25000, Math.ceil(len / 2));
    for (let i = 0; i <= n; i++) {
      const g = GEO.ll(GEO.pointAt(f, (len * i) / n));
      const v = magAt(g[0], g[1]);
      if (v == null) continue;
      out.km += len / n;
      if (Math.abs(v) >= 200) out.strong += len / n;
      if (!out.max || Math.abs(v) > Math.abs(out.max.v)) out.max = { v, lat: g[0], lon: g[1] };
    }
  }
  return out;
}
function v2LineKey(L) {
  return (
    L.id +
    '|' +
    L.segs.map(g => g.o.map(x => x.toFixed(6)).join(',') + '/' + g.brg.toFixed(6) + '/' + g.len).join(';')
  );
}
export function v2Discover() {
  const L = activeLine();
  if (!L) return null;
  const w = S.corridorKm,
    key = v2LineKey(L) + '|' + w + '|' + enabledPoints().length;
  if (V2.disc && V2.disc.key === key) return V2.disc;
  const t0 = performance.now();
  const dep = ugAlongLine(L, w),
    fau = v2CrossCheck(L, w, faultData().rows),
    pla = v2CrossCheck(L, w, plateData());
  const mg =
    V2.magCache && V2.magCache.key === v2LineKey(L)
      ? V2.magCache.v
      : (V2.magCache = { key: v2LineKey(L), v: v2MagAlong(L) }).v;
  const sites = MATCH.filter(m => m.status !== 'out' && !m.anchor);
  const minerals = dep.total > 0,
    faults = fau.n > 0 || pla.n > 0,
    hist = sites.length > 0;
  const kind = minerals && faults ? 'both' : faults ? 'fault' : minerals ? 'min' : hist ? 'site' : 'none';
  return (V2.disc = { key, L, w, dep, fau, pla, mg, sites, kind, ms: performance.now() - t0 });
}
const GLOWVAR = { min: '--glow-min', fault: '--glow-fault', both: '--glow-both', site: '--glow-site' };
export const glowColor = k =>
  GLOWVAR[k] ? getComputedStyle(document.documentElement).getPropertyValue(GLOWVAR[k]).trim() : null;
export const v2DiscFor = L => {
  const d = V2.disc;
  return d && L && v2LineKey(d.L) === v2LineKey(L) && d.w === S.corridorKm ? d : null;
};
export const KINDTXT = {
  min: 'Mineral deposits along the line',
  fault: 'Faults along the line',
  both: 'Minerals and faults along the line',
  site: 'Historic sites along the line',
  none: 'Nothing recorded along the line',
};
// called from draw(): line colour override and the discovery glow
export function v2PreDraw() {
  STY.work.c = V2.lineColor || C.cyan;
  STY.user.c = V2.lineColor || C.cyan;
}
export function v2Glow(path) {
  if (!V2.glow || S.intro) return;
  const L = activeLine(),
    d = v2DiscFor(L);
  if (!d || d.kind === 'none') return;
  const col = glowColor(d.kind);
  if (!col) return;
  const co = [];
  for (const sg of L.segs) for (const c of lineCoords(sg)) co.push(c);
  if (!co.length) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = col;
  ctx.globalAlpha = 0.16;
  ctx.lineWidth = 16;
  ctx.beginPath();
  path({ type: 'MultiLineString', coordinates: co });
  ctx.stroke();
  ctx.globalAlpha = 0.32;
  ctx.lineWidth = 8;
  ctx.beginPath();
  path({ type: 'MultiLineString', coordinates: co });
  ctx.stroke();
  ctx.restore();
}
export function v2Alert() {
  // on the bare map, the active line shows as one small card; tap it to open the line
  const el = $('#v2alert'),
    L = activeLine(),
    show = !V2.tab && !V2.host && !!L && S.mode !== 'draw';
  if (!show) {
    el.hidden = true;
    return;
  }
  const d = v2Discover(),
    key =
      L.id +
      '|' +
      (d
        ? d.kind + d.dep.total + d.fau.crossed + d.sites.length + (d.mg.max ? Math.round(d.mg.max.v) : '')
        : '') +
      '|' +
      (V2.lineColor || '');
  el.style.setProperty('--ac', (d && glowColor(d.kind)) || 'var(--line)');
  el.hidden = false;
  if (el.dataset.k === key) return;
  el.dataset.k = key;
  el.innerHTML = `<div class="t" id="v2alert-go" role="button" tabindex="0"><b>${esc(L.short || L.name)}</b><p class="s">${esc(v2Summary(d))}</p><span class="go">Open →</span></div><button class="x" id="v2alert-new" aria-label="Draw a new line" title="Draw a new line">＋</button>`;
  $('#v2alert-go').onclick = () => v2ChangeTab(L.id === 'work' ? 'draw' : 'analyze');
  $('#v2alert-go').onkeydown = e => {
    if (e.key === 'Enter') $('#v2alert-go').click();
  };
  $('#v2alert-new').onclick = () => v2HandleAction('new-line');
}
export function v2Summary(d) {
  if (!d) return '';
  const s = (n, w, p) => `${nf(n)} ${n === 1 ? w : p || w + 's'}`,
    bits = [];
  if (d.fau.crossed) bits.push(`crosses ${s(d.fau.crossed, 'fault')}`);
  if (d.pla.crossed) bits.push(`crosses ${s(d.pla.crossed, 'plate boundary', 'plate boundaries')}`);
  if (d.dep.total) bits.push(s(d.dep.total, 'mineral deposit'));
  if (d.mg.max && Math.abs(d.mg.max.v) >= 200) bits.push('strong magnetic signal');
  if (d.sites.length) bits.push(s(d.sites.length, 'historic site'));
  return bits.length
    ? bits.join(' · ').replace(/^./, ch => ch.toUpperCase())
    : 'Nothing recorded near this line';
}
export function v2LineChanged() {
  V2.disc = null;
  V2.hl = null;
  analyse();
  v2Discover();
  v2Alert();
  req();
}

export function initDiscovery() {
  addDrawLayer('beforeLines', v2PreDraw);
  addDrawLayer('underLines', (P, path) => v2Glow(path));
}
