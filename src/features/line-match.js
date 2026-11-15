// Line match: how promising is A to B versus nearby directions
import { GEO } from '../core/geo.js';
import { PIR, R, esc, nf } from '../core/util.js';
import { buildLines } from '../domain/lines.js';
import { enabledPoints, findPoint } from '../domain/points.js';
import { depData, faultData, magAt, plateData } from '../layers/underground.js';
import { W, ctx } from '../map/canvas.js';
import { req } from '../map/draw.js';
import { C } from '../render/palette.js';
import { V2 } from '../state/preferences.js';
import { S, persist } from '../state/state.js';
import { v2Render } from '../ui/panels.js';

// ================= line match: how promising is A→B compared with every other direction from A =================
// Everything is measured in a frame centred on A, where every line from A is a straight ray at one bearing.
// For each candidate B we count, along the corridor of A→B: mineral deposits, fault/plate crossings, km over strong
// magnetic rock and historic sites (crowded sites count less). Each count is then ranked against 360 other directions
// from A at the same length, so a long line or a dense region does not win by default. The score is a guide, not evidence.
export const MSIG = [
  ['dep', 'Minerals', 'var(--glow-min)'],
  ['fau', 'Faults', 'var(--glow-fault)'],
  ['mag', 'Magnetic', 'var(--glow-both)'],
  ['site', 'Sites', 'var(--glow-site)'],
];
export let LM = null,
  LMHOT = null;
function lmBasis(A) {
  const a = GEO.vec(A.lat, A.lon);
  let e = [-a[1], a[0], 0];
  const ne = Math.hypot(e[0], e[1]) || 1;
  e = [e[0] / ne, e[1] / ne, 0];
  const n = [a[1] * e[2] - a[2] * e[1], a[2] * e[0] - a[0] * e[2], a[0] * e[1] - a[1] * e[0]];
  return {
    a,
    e,
    n,
    pol: (lat, lon) => {
      const v = GEO.vec(lat, lon),
        x = v[0] * e[0] + v[1] * e[1] + v[2] * e[2],
        y = v[0] * n[0] + v[1] * n[1] + v[2] * n[2],
        z = v[0] * a[0] + v[1] * a[1] + v[2] * a[2];
      return [Math.atan2(x, y), Math.atan2(Math.hypot(x, y), z)];
    },
  };
}
const TAU = 2 * Math.PI,
  wrapA = t => {
    t %= TAU;
    return t < -Math.PI ? t + TAU : t > Math.PI ? t - TAU : t;
  };
const LM_K = 1.5;
let LM_R0;
function lmRings(items) {
  // items: [theta, ang, weight, tag]; rings by distance from A, each sorted by bearing
  const rings = [];
  for (const it of items) {
    const k = it[1] < LM_R0 ? 0 : 1 + Math.floor(Math.log(it[1] / LM_R0) / Math.log(LM_K));
    (rings[k] || (rings[k] = [])).push(it);
  }
  return rings.map((arr, k) => {
    if (!arr) return null;
    arr.sort((p, q) => p[0] - q[0]);
    const n = arr.length,
      th = new Float64Array(n),
      sd = new Float64Array(n),
      cd = new Float64Array(n),
      wt = new Float32Array(n),
      tag = new Int32Array(n);
    arr.forEach((p, i) => {
      th[i] = p[0];
      sd[i] = Math.sin(p[1]);
      cd[i] = Math.cos(p[1]);
      wt[i] = p[2];
      tag[i] = p[3];
    });
    const rin = k ? LM_R0 * Math.pow(LM_K, k - 1) : 0,
      rout = LM_R0 * Math.pow(LM_K, k);
    return { n, th, sd, cd, wt, tag, rin, rout };
  });
}
function lmLower(th, x) {
  let lo = 0,
    hi = th.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (th[m] < x) lo = m + 1;
    else hi = m;
  }
  return lo;
}
let LMCNT = 0;
function lmCount(rings, beta, Lr, wr, skip, tr) {
  // weighted count of points inside the corridor of the ray (beta, tr..Lr-tr); plain count left in LMCNT
  const sw = Math.sin(wr);
  let sum = 0;
  LMCNT = 0;
  for (const r of rings) {
    if (!r || r.rin > Lr + wr) continue;
    const smin = Math.min(Math.sin(Math.max(r.rin, 1e-9)), Math.sin(Math.min(r.rout, Math.PI))),
      dth = r.rin === 0 || sw >= smin ? Math.PI : Math.asin(sw / smin);
    const visit = (i0, i1) => {
      for (let i = i0; i < i1; i++) {
        if (r.tag[i] === skip) continue;
        const d = r.th[i] - beta,
          s = Math.sin(d);
        if (Math.abs(Math.asin(Math.max(-1, Math.min(1, r.sd[i] * s)))) > wr) continue;
        const at = Math.atan2(r.sd[i] * Math.cos(d), r.cd[i]);
        if (at < tr || at > Lr - tr) continue;
        sum += r.wt[i];
        if (r.wt[i] > 0) LMCNT++;
      }
    };
    if (dth >= Math.PI) {
      visit(0, r.n);
      continue;
    }
    let lo = beta - dth,
      hi = beta + dth;
    if (lo < -Math.PI) {
      visit(lmLower(r.th, lo + TAU), r.n);
      lo = -Math.PI;
    }
    if (hi > Math.PI) {
      visit(0, lmLower(r.th, hi - TAU));
      hi = Math.PI;
    }
    visit(lmLower(r.th, lo), lmLower(r.th, hi));
  }
  return sum;
}
const LM_NB = 720;
function* lmBuildGen(A) {
  // a generator so the work can be spread over several frames (yields progress 0..1)
  const t0 = performance.now(),
    B = lmBasis(A),
    w = Math.max(S.corridorKm, 0.5),
    wr = w / R;
  // mineral deposits (every recorded deposit, minus country-centre placeholders)
  const D = depData(),
    dep = [];
  for (let k = 0; k < D.n; k++) {
    if (D.approx[k]) continue;
    const [t, g] = B.pol(D.lat[k], D.lon[k]);
    dep.push([t, g, 1, -1]);
    if (k % 20000 === 0) yield 0.02;
  }
  // historic sites: everything switched on; a site with neighbours within 3 km counts for less, so one cluster cannot carry a line
  const pts = enabledPoints(),
    cell = new Map(),
    ck = (la, lo) => Math.floor(la * 30) + ',' + Math.floor(lo * 30);
  for (const p of pts) {
    const k = ck(p.lat, p.lon);
    (cell.get(k) || cell.set(k, []).get(k)).push(p);
  }
  const site = pts.map((p, i) => {
    if (p.id === A.id) {
      const [t, g] = B.pol(p.lat, p.lon);
      return [t, g, 0, i];
    }
    let nb = 0;
    for (let a = -1; a <= 1; a++)
      for (let b = -1; b <= 1; b++)
        for (const q of cell.get(Math.floor(p.lat * 30) + a + ',' + (Math.floor(p.lon * 30) + b)) || [])
          if (q !== p && GEO.dist(p.lat, p.lon, q.lat, q.lon) < 3) nb++;
    const [t, g] = B.pol(p.lat, p.lon);
    return [t, g, 1 / (1 + nb), i];
  });
  // fault and plate-boundary segments, filed under every bearing bin they span
  const segBins = Array.from({ length: LM_NB }, () => []),
    binOf = t => ((Math.floor(((t + Math.PI) / TAU) * LM_NB) % LM_NB) + LM_NB) % LM_NB;
  const addLine = pts2 => {
    let prev = null;
    for (const [lon, lat] of pts2) {
      const cur = B.pol(lat, lon);
      if (prev) {
        const dl = wrapA(cur[0] - prev[0]);
        if (Math.abs(dl) < 1.5 && dl !== 0) {
          const t1 = prev[0],
            b1 = binOf(t1),
            nbins = Math.ceil((Math.abs(dl) / TAU) * LM_NB) + 1,
            sgn = dl > 0 ? 1 : -1;
          for (let j = 0; j <= nbins; j++)
            segBins[(b1 + sgn * j + LM_NB * 4) % LM_NB].push([t1, dl, prev[1], cur[1]]);
        }
      }
      prev = cur;
    }
  };
  for (const r of faultData().rows) addLine(r.pts);
  for (const r of plateData()) addLine(r.pts);
  yield 0.1;
  // magnetic: sample a polar grid once (0.5° x growing steps) and keep running km over strong rock (|anomaly| >= 200 nT)
  const steps = [];
  for (let d = 2; d < PIR; d += Math.max(5, d * 0.025)) steps.push(d);
  const MB = 360,
    magCum = new Float32Array(MB * steps.length);
  for (let b = 0; b < MB; b++) {
    const brg = (((b + 0.5) / MB) * 360 - 180 + 360) % 360,
      f = GEO.frame(A.lat, A.lon, brg);
    let acc = 0,
      prevD = 0;
    for (let j = 0; j < steps.length; j++) {
      const g = GEO.ll(GEO.pointAt(f, steps[j])),
        v = magAt(g[0], g[1]);
      if (v != null && Math.abs(v) >= 200) acc += steps[j] - prevD;
      prevD = steps[j];
      magCum[b * steps.length + j] = acc;
    }
    if (b % 30 === 29) yield 0.1 + (0.15 * b) / MB;
  }
  const M = { A, B, w, wr, dep: lmRings(dep), site: lmRings(site), segBins, binOf, steps, magCum, pts };
  const trim = Math.max(10, 2 * w);
  M.trim = trim;
  M.raw = (beta, L, skip) => {
    // the four counts for the line from A at bearing beta (radians), L km long, leaving out `trim` km at each end
    const Lr = L / R,
      tr = Math.min(trim, L / 4) / R,
      b = binOf(beta);
    let fau = 0;
    for (const [t1, dl, g1, g2] of segBins[b]) {
      const u = wrapA(beta - t1) / dl;
      if (u < 0 || u > 1) continue;
      const g = g1 + (g2 - g1) * u;
      if (g >= tr && g <= Lr - tr) fau++;
    }
    const mb = Math.min(MB - 1, Math.floor(((beta + Math.PI) / TAU) * MB)),
      cum = x => {
        const j = lmLower(steps, x) - 1;
        return j < 0 ? 0 : magCum[mb * steps.length + j];
      },
      mag = Math.max(0, cum(L - tr * R) - cum(tr * R));
    const dep = lmCount(M.dep, beta, Lr, wr, -2, tr),
      site = lmCount(M.site, beta, Lr, wr, skip, tr);
    return { dep, fau, mag, site, sites: LMCNT };
  };
  // background: 360 directions x 32 lengths from 20 km to half the globe
  M.lens = [];
  for (let L = 20; L < PIR; L *= 1.38) M.lens.push(L);
  M.bg = [];
  for (const L of M.lens) {
    const cells = [];
    for (let i = 0; i < 360; i++) cells.push(M.raw(((i + 0.5) / 360) * TAU - Math.PI, L, -1));
    M.bg.push({ cells });
    yield 0.25 + (0.3 * M.bg.length) / M.lens.length;
  }
  // rank against the neighbouring directions (±15° at about the same length), not against the whole compass:
  // that asks "does more line up along this direction than along the ones beside it?", so a line is not rewarded
  // just for running over land instead of sea, or through a busy region
  M.li = L => {
    let li = 0;
    for (let i = 1; i < M.lens.length; i++)
      if (Math.abs(Math.log(M.lens[i] / L)) < Math.abs(Math.log(M.lens[li] / L))) li = i;
    return li;
  };
  M.pct = (k, v, L, beta) => {
    const cells = M.bg[M.li(L)].cells,
      i0 = Math.floor(((beta + Math.PI) / TAU) * 360);
    let below = 0,
      eq = 0,
      n = 0;
    for (let d = -15; d <= 15; d++) {
      if (!d) continue;
      const x = cells[(i0 + d + 360) % 360][k];
      n++;
      if (x < v - 1e-9) below++;
      else if (x <= v + 1e-9) eq++;
    }
    return (below + eq / 2) / n;
  };
  // every switched-on site as a candidate B
  M.scores = new Map();
  const tB = performance.now();
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (i % 600 === 0) yield 0.55 + (0.45 * i) / pts.length;
    if (p.id === A.id) continue;
    const [t, g] = B.pol(p.lat, p.lon),
      L = g * R;
    if (L < 1) continue;
    const raw = M.raw(t, L, i),
      pc = {};
    for (const [k] of MSIG) pc[k] = M.pct(k, raw[k], L, t);
    M.scores.set(p.id, { raw, pc, L, brg: t });
  }
  M.n = M.scores.size;
  M.ms = Math.round(performance.now() - t0);
  M.msB = Math.round(performance.now() - tB);
  M.key = A.id + '|' + w + '|' + pts.length;
  return M;
}
export function lmCombined(s) {
  const on = MSIG.filter(([k]) => V2.msig[k]);
  if (!on.length) return 0;
  let t = 0;
  for (const [k] of on) t += s.pc[k];
  return Math.round((100 * t) / on.length);
}
const lmKey = A => A.id + '|' + Math.max(S.corridorKm, 0.5) + '|' + enabledPoints().length;
export function lmReady(aId) {
  const A = findPoint(aId);
  return !!(A && LM && LM.key === lmKey(A));
}
let LMJOB = null;
export function lmForAsync(aId, onDone, onProg) {
  // builds in ~30 ms slices so the screen keeps responding; calls back when ready
  const A = findPoint(aId);
  if (!A) return;
  if (lmReady(aId)) {
    onDone && onDone(LM);
    return;
  }
  const key = lmKey(A);
  if (LMJOB && LMJOB.key === key) {
    if (onDone) LMJOB.cbs.push(onDone);
    if (onProg) LMJOB.prog.push(onProg);
    return;
  }
  const job = (LMJOB = {
    key,
    g: lmBuildGen(A),
    cbs: onDone ? [onDone] : [],
    prog: onProg ? [onProg] : [],
    p: 0,
  });
  const step = () => {
    if (LMJOB !== job) return;
    const t0 = performance.now();
    while (performance.now() - t0 < 30) {
      const r = job.g.next();
      if (r.done) {
        LM = r.value;
        LM.top = null;
        LMJOB = null;
        job.cbs.forEach(f => f(LM));
        req();
        return;
      }
      job.p = r.value;
    }
    job.prog.forEach(f => f(job.p));
    setTimeout(step, 0);
  };
  setTimeout(step, 0);
}
export function lmTop() {
  if (!LM) return new Set();
  if (LM.top && LM.topKey === JSON.stringify(V2.msig)) return LM.top;
  const arr = [...LM.scores].map(([id, s]) => [id, lmCombined(s)]).sort((a, b) => b[1] - a[1]);
  LM.top = new Set(
    arr
      .slice(0, 25)
      .filter(x => x[1] >= 75)
      .map(x => x[0]),
  );
  LM.topKey = JSON.stringify(V2.msig);
  return LM.top;
}
export function lmWhy(s) {
  const bits = [],
    top = p => `${Math.round(p * 30)}/30`; // n/30 = beats n of the 30 directions beside it
  if (V2.msig.dep && s.pc.dep >= 0.8 && s.raw.dep > 0)
    bits.push(`${nf(Math.round(s.raw.dep))} deposit${s.raw.dep === 1 ? '' : 's'} ${top(s.pc.dep)}`);
  if (V2.msig.fau && s.pc.fau >= 0.8 && s.raw.fau > 0)
    bits.push(`${s.raw.fau} fault${s.raw.fau === 1 ? '' : 's'} crossed ${top(s.pc.fau)}`);
  if (V2.msig.mag && s.pc.mag >= 0.8 && s.raw.mag > 0)
    bits.push(`${Math.round(s.raw.mag)} km magnetic rock ${top(s.pc.mag)}`);
  if (V2.msig.site && s.pc.site >= 0.8 && s.raw.site > 0)
    bits.push(`${nf(s.raw.sites)} site${s.raw.sites === 1 ? '' : 's'} ${top(s.pc.site)}`);
  return bits.length ? bits.join(' · ') : 'Nothing stands out against the directions beside it';
}
export function lmBar(s) {
  const c = lmCombined(s);
  return `<span class="lm-score" title="Match ${c} of 100"><span class="lm-bar"><i style="width:${c}%"></i></span><b>${c}</b>${MSIG.filter(
    ([k]) => V2.msig[k] && s.pc[k] >= 0.8 && s.raw[k] > 0,
  )
    .map(([, t, col]) => `<span class="lm-dot" style="background:${col}" title="${t}"></span>`)
    .join('')}</span>`;
}
// the fan: directions from A, brighter where the combined rank is high (top quarter only)
export function lmFanDraw(P) {
  if (!lmPicking() || (S.view !== 'map' && S.view !== 'globe')) return;
  const on = MSIG.filter(([k]) => V2.msig[k]);
  if (!on.length) return;
  const key = JSON.stringify(V2.msig);
  if (LM.fanKey !== key) {
    LM.fan = new Float32Array(LM.lens.length * 360);
    const raw = new Float32Array(LM.lens.length * 360);
    LM.lens.forEach((L1, li) =>
      LM.bg[li].cells.forEach((r, i) => {
        let t = 0;
        for (const [k] of on) t += LM.pct(k, r[k], L1, ((i + 0.5) / 360) * TAU - Math.PI);
        raw[li * 360 + i] = t / on.length;
      }),
    );
    for (let li = 0; li < LM.lens.length; li++)
      for (let i = 0; i < 360; i++) {
        let t = 0;
        for (let d = -1; d <= 1; d++) t += raw[li * 360 + ((i + d + 360) % 360)];
        LM.fan[li * 360 + i] = t / 3;
      } // smoothed over 3° so bands read as directions
    LM.fanKey = key;
  }
  ctx.save();
  for (let li = 0; li < LM.lens.length; li++) {
    const L0 = li ? LM.lens[li - 1] : 0,
      L1 = LM.lens[li];
    for (let i = 0; i < 360; i++) {
      const sc = LM.fan[li * 360 + i];
      if (sc < 0.68) continue;
      const b0 = i - 180,
        b1 = b0 + 1,
        q = [
          [b0, L0],
          [b1, L0],
          [b1, L1],
          [b0, L1],
        ].map(([b, d]) => {
          const g = d ? GEO.dest(LM.A.lat, LM.A.lon, (b + 360) % 360, d) : [LM.A.lat, LM.A.lon];
          return P([g[1], g[0]]);
        });
      if (q.some(x => !x)) continue;
      if (Math.abs(q[0][0] - q[2][0]) > W) continue;
      ctx.globalAlpha = Math.min(0.6, 0.14 + (sc - 0.68) * 2.2);
      ctx.fillStyle = C.gold;
      ctx.beginPath();
      ctx.moveTo(q[0][0], q[0][1]);
      for (let j = 1; j < 4; j++) ctx.lineTo(q[j][0], q[j][1]);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}
export function lmCardLine(s) {
  if (!V2.pick.a || V2.pick.b || s.id === V2.pick.a || !LM || LM.A.id !== V2.pick.a) return '';
  const sc = LM.scores.get(s.id);
  if (!sc) return '';
  return `<div class="lm-card"><span class="v2-kicker">Line from ${esc(findPoint(V2.pick.a)?.n || 'A')} to here</span>${lmBar(sc)}<small>${esc(lmWhy(sc))}</small></div>`;
}
export function lmRankLine(L) {
  if (L.layer !== 'user' || !L.sites || L.anchors.length !== 2) return '';
  if (!lmReady(L.anchors[0])) {
    lmForAsync(L.anchors[0], () => {
      if (V2.tab === 'analyze' || V2.tab === 'draw') v2Render();
    });
    return `<div class="lm-card"><span class="v2-kicker">Comparing with the directions beside this one…</span></div>`;
  }
  const M = LM,
    sc = M.scores.get(L.anchors[1]);
  if (!sc) return '';
  return `<div class="lm-card"><span class="v2-kicker">Match from ${esc(M.A.n)}: this direction vs the 30 beside it</span>${lmBar(sc)}<small>${esc(lmWhy(sc))}${L.pickedBy ? ' · You chose this end after seeing these scores, so a high match is expected; “Is it unusual?” allows for that.' : ''}</small></div>`;
}
export function lmMarkPicked() {
  if (!S.work?.sites || !LM || LM.A.id !== S.work.sites[0]) return;
  S.work.pickedBy = {
    n: LM.n,
    w: LM.w,
    L: Math.round(GEO.dist(S.work.o[0], S.work.o[1], ...S.work.v2ends[1])),
  };
  persist();
  buildLines();
}
export const lmPicking = () =>
  !!(LM && V2.pick.a && !V2.pick.b && LM.A.id === V2.pick.a && S.mode !== 'draw');

export function initLineMatch() {
  LM_R0 = 5 / R;
}

// Setters for variables that other modules change.
export function setLMHOT(v) {
  return (LMHOT = v);
}
