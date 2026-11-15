// Which sites sit on which lines
import { GEO } from '../core/geo.js';
import { LINES, activeLine, lineDist, lineShown, lineUncAt } from './lines.js';
import { enabledPoints, findPoint } from './points.js';
import { S } from '../state/state.js';

// ================= analysis =================
export let MATCH = [],
  MATCHBY = new Map(),
  INTS = [];
export function analyse() {
  const L = activeLine(),
    w = S.corridorKm,
    pts = enabledPoints();
  MATCH = !L
    ? []
    : pts
        .map(p => {
          const r = lineDist(L, p.lat, p.lon),
            uk = (p.unc || 0) / 1000;
          const status = r.d <= w ? (r.d + uk > w ? 'edge' : 'in') : r.d - uk <= w ? 'edge' : 'out';
          return {
            p,
            d: r.d,
            xt: r.xt,
            at: r.at,
            onSpan: r.onSpan,
            seg: r.seg,
            status,
            anchor: L.anchors.includes(p.id),
            lu: lineUncAt(L, r.at),
          };
        })
        .sort((a, b) => a.d - b.d);
  MATCHBY = new Map(MATCH.map(m => [m.p.id, m]));
  const vis = LINES.filter(lineShown),
    rad = Math.max(w, 0.1);
  INTS = [];
  for (let i = 0; i < vis.length; i++)
    for (let j = i + 1; j < vis.length; j++) {
      const A = vis[i],
        B = vis[j];
      if (A.group === B.group) continue;
      for (const sa of A.segs)
        for (const sb of B.segs)
          for (const x of GEO.intersect(sa, sb)) {
            const shared = A.anchors
              .filter(a => B.anchors.includes(a))
              .some(id => {
                const s = findPoint(id);
                return s && GEO.dist(s.lat, s.lon, x.lat, x.lon) < 0.3;
              });
            const sameOrigin =
              GEO.dist(sa.o[0], sa.o[1], x.lat, x.lon) < 0.05 &&
              GEO.dist(sb.o[0], sb.o[1], x.lat, x.lon) < 0.05;
            const dlat = rad / 111 + 0.01,
              near = [];
            for (const p of pts) {
              if (Math.abs(p.lat - x.lat) > dlat) continue;
              const d = GEO.dist(p.lat, p.lon, x.lat, x.lon);
              if (d <= rad) near.push({ p, d });
            }
            near.sort((a, b) => a.d - b.d);
            INTS.push({ ...x, a: A.id, b: B.id, trivial: shared || sameOrigin, near });
          }
    }
  INTS.sort((a, b) => b.near.length - a.near.length || (a.near[0]?.d ?? 1e9) - (b.near[0]?.d ?? 1e9));
}
