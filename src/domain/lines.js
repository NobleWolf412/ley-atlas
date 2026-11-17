// Lines: case studies, user lines and the work line
import { GEO } from '../core/geo.js';
import { R } from '../core/util.js';
import { ALIGNMENTS } from '../data/catalog.js';
import { CASE_STUDIES } from './case-studies.js';
import { PT, findPoint } from './points.js';
import { S } from '../state/state.js';

// ================= lines =================
export let CS0;
export let ob, cs;
export let PRIMARY_BRG;
export let LINES = [],
  LINEBY = {};
function sigmaFor(A, B) {
  const base = GEO.dist(A.lat, A.lon, B.lat, B.lon) * 1000;
  return base > 0 ? Math.atan(Math.hypot(A.unc || 0, B.unc || 0) / base) : null;
}
export function lineUncAt(L, at) {
  return L.sigma ? Math.abs(Math.sin(Math.abs(at) / R)) * R * Math.tan(L.sigma) : 0;
}
function polySegs(pts) {
  const s = [];
  for (let i = 0; i < pts.length - 1; i++)
    s.push({
      o: pts[i],
      brg: GEO.bearing(...pts[i], ...pts[i + 1]),
      len: GEO.dist(...pts[i], ...pts[i + 1]),
    });
  return s;
}
function userLineObj(u, isWork) {
  const A = u.anchors && findPoint(u.anchors[0]),
    B = u.anchors && u.anchors.length === 2 && findPoint(u.anchors[1]);
  return {
    ...u,
    short: u.name,
    sigma: A && B ? sigmaFor(A, B) : null,
    layer: 'user',
    style: isWork ? 'work' : 'user',
    cls: 'user',
    group: isWork ? 'work' : 'user:' + u.id,
    cat: 'Your lines',
    anchors: u.anchors || [],
    segs: [{ o: u.o, brg: u.brg, len: u.len == null ? Infinity : u.len }],
  };
}
export function buildLines() {
  const out = [],
    g = o => out.push(o);
  for (const c of CASE_STUDIES.filter(c => !S.removedCaseStudies.includes(c.id))) {
    const A = PT.get(c.nodes[0]),
      B = PT.get(c.nodes[1]),
      cat = 'Case study: ' + c.title;
    g({
      id: c.lineId,
      name: c.title + ' line',
      short: c.title + ' line',
      layer: c.lineId,
      style: 'primary',
      cls: 'projection',
      group: 'cs:' + c.id,
      cat,
      anchors: [...c.nodes, ...c.extra],
      segs: [{ o: [A.lat, A.lon], brg: GEO.bearing(A.lat, A.lon, B.lat, B.lon), len: Infinity }],
      sigma: sigmaFor(A, B),
      note: c.context,
    });
    if (c.extra.length) {
      const pts = [...c.extra, ...c.nodes].map(id => PT.get(id)),
        fit = GEO.bestFit(pts.map(p => [p.lat, p.lon]));
      g({
        id: c.fitId,
        name: c.title + ' best fit (all anchors)',
        short: c.title + ' best fit',
        layer: c.fitId,
        style: 'bestfit',
        cls: 'projection',
        group: 'cs:' + c.id,
        cat,
        anchors: [...c.extra, ...c.nodes],
        segs: [{ o: fit.o, brg: fit.brg, len: Infinity }],
        rms: fit.rmsKm,
      });
    }
  }
  for (const al of ALIGNMENTS.filter(a => a.path)) {
    const pts = al.path.map(id => PT.get(id)),
      nm = al.n.replace(/ \(.*\)/, '');
    g({
      id: al.id,
      name: al.n + ' (claimed path)',
      short: nm,
      layer: al.id,
      style: 'esoteric',
      cls: 'esoteric',
      group: al.id,
      cat: 'Published claims',
      anchors: al.path,
      segs: polySegs(pts.map(s => [s.lat, s.lon])),
      note: al.note,
    });
    const fit = GEO.bestFit(pts.map(s => [s.lat, s.lon]));
    g({
      id: al.id + 'fit',
      name: nm + ' — best-fit great circle',
      short: nm + ' best fit',
      layer: al.id + 'fit',
      style: 'esofit',
      cls: 'projection',
      group: al.id,
      cat: 'Published claims',
      anchors: al.path,
      segs: [{ o: fit.o, brg: fit.brg, len: Infinity }],
      rms: fit.rmsKm,
      fitOf: al.id,
    });
  }
  const me = ALIGNMENTS.find(a => a.id === 'meridian');
  g({
    id: 'meridian',
    name: 'Vatican Meridian (St. Peter’s Square)',
    short: 'Vatican Meridian',
    layer: 'meridian',
    style: 'documented',
    cls: 'alignment',
    group: 'meridian',
    cat: 'Documented alignments',
    anchors: ['obelisk'],
    segs: [{ o: [ob.lat, ob.lon], brg: 0, len: Infinity }],
    note: me.note,
  });
  const vs = ALIGNMENTS.find(a => a.id === 'viasacra');
  g({
    id: 'viasacra',
    name: 'Via Sacra (simplified trace)',
    short: 'Via Sacra',
    layer: 'viasacra',
    style: 'documented',
    cls: 'alignment',
    group: 'viasacra',
    cat: 'Documented alignments',
    anchors: [],
    segs: polySegs(vs.coords),
    note: vs.note,
    width: 1.4,
  });
  if (S.work) g(userLineObj({ ...S.work, id: 'work' }, true));
  for (const u of S.userLines) g(userLineObj(u, false));
  LINES = out;
  LINEBY = Object.fromEntries(out.map(l => [l.id, l]));
  if (S.active && !LINEBY[S.active]) S.active = null; // no line is chosen for you
}
export const activeLine = () => LINEBY[S.active];
export function lineShown(l) {
  if (!S.layers[l.layer]) return false;
  if (!S.focus) return true;
  const a = activeLine();
  return !!a && l.group === a.group;
}
export function lineDist(l, lat, lon) {
  let best = null;
  for (const sg of l.segs) {
    const r = GEO.distToLine(sg, lat, lon);
    if (!best || r.d < best.d) best = { ...r, seg: sg };
  }
  return best;
}

export function initLines() {
  // ================= lines =================
  CS0 = CASE_STUDIES[0];
  ob = PT.get(CS0.nodes[0]);
  cs = PT.get(CS0.nodes[1]);
  PRIMARY_BRG = GEO.bearing(ob.lat, ob.lon, cs.lat, cs.lon);
}
