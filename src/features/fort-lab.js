// Star fort lab: the shape of a star fort, which way its points face, and whether they aim
// at other forts, ancient sites or the sun more often than chance would give.
//
// "Points" are the tips of the traced outline: bastions plus any ravelins and outworks,
// as the outline records them (so Bourtange has 10, not its 5 bastions).
import {
  aimedAt,
  fortShape,
  poissonAtLeast,
  rayleigh,
  rotationTest,
  tipBearings,
} from '../core/fort-geometry.js';
import { fmtKm } from '../core/format.js';
import { GEO } from '../core/geo.js';
import { skyEvents } from '../core/sky.js';
import { esc, nf } from '../core/util.js';
import { FORT_OUTLINES } from '../data/datasets.js';
import { dec } from '../core/polyline.js';
import { ALLP, findPoint } from '../domain/points.js';
import { flyTo } from '../map/camera.js';
import { ctx, kForKm } from '../map/canvas.js';
import { req } from '../map/draw.js';
import { addDrawLayer, addSiteHighlighter } from '../map/hooks.js';
import { V2, v2Persist } from '../state/preferences.js';
import { v2Button, v2ButtonId, v2Peek } from '../ui/panel-parts.js';
import { v2ChangeTab, v2Render } from '../ui/panels.js';
import { toast } from '../ui/intro.js';
import { registerAction, registerScreen, registerTool } from '../ui/registry.js';

const REACH_KM = 1000; // how far to look for targets
const RAY_KM = 800; // how far the rays are drawn on the map
const TOLS = [0.5, 1, 2];
const GROUPS = {
  forts: { label: 'Other star forts', test: p => p.cat === 'fort' },
  ancient: {
    label: 'Ancient & sacred sites',
    test: p => ['core', 'wonder', 'megalith', 'unesco'].includes(p.set) && p.cat !== 'fort',
  },
};
const QUICK = ['bourtange', 'palmanova', 'naarden', 'neufbrisach', 'goryokaku', 'mchenry'];

/** The traced geometry of a fort site, or null when it is only a catalogue point. */
export function fortGeometry(p) {
  const e = p && p.ext;
  if (!e || !e.c || !e.t || e.t.length < 2) return null;
  return { centre: e.c, tips: e.t, ha: e.a, year: e.y, outline: FORT_OUTLINES[e.id] ? e.id : null };
}

// ---------- one fort ----------
function analyseFort(p) {
  const g = fortGeometry(p);
  const tips = tipBearings(g.centre, g.tips),
    brgs = tips.map(t => t.brg),
    shape = fortShape(tips),
    tol = V2.fortTol;
  const group = GROUPS[V2.fortGroup] || GROUPS.forts;
  const targets = [];
  for (const q of ALLP) {
    if (q === p || !group.test(q)) continue;
    const km = GEO.dist(g.centre[0], g.centre[1], q.lat, q.lon);
    if (km < 1 || km > REACH_KM) continue;
    targets.push({ p: q, km, brg: GEO.bearing(g.centre[0], g.centre[1], q.lat, q.lon) });
  }
  const hits = aimedAt(brgs, targets, tol);
  const luck = rotationTest(
    brgs,
    targets.map(t => t.brg),
    tol,
    hits.length,
  );
  const era = g.year || 1600;
  const sky = skyEvents(g.centre[0], era);
  const sunHits = [];
  for (const ev of sky) {
    const best = aimedAt(brgs, [{ brg: ev.az }], tol)[0];
    if (best) sunHits.push({ ...ev, off: best.off, tip: best.tip });
  }
  const sunLuck = rotationTest(
    brgs,
    sky.map(e => e.az),
    tol,
    sunHits.length,
  );
  return { g, tips, shape, targets, hits, luck, era, sky, sunHits, sunLuck, group };
}

const pct = v => `${Math.round(v * 100)}%`;
const chance = p => (p < 0.001 ? 'under 0.1%' : p < 0.01 ? `${(p * 100).toFixed(1)}%` : pct(p));

/** A small drawing of the fort: its outline, numbered points and the directions they face. */
function fortSvg(A) {
  const { g, tips } = A;
  const c = g.centre,
    kx = Math.cos((c[0] * Math.PI) / 180);
  const toXY = (lat, lon) => [(lon - c[1]) * kx, -(lat - c[0])];
  const ring = g.outline ? dec(FORT_OUTLINES[g.outline], 1e5).map(([lon, lat]) => toXY(lat, lon)) : [];
  const tipXY = g.tips.map(([lat, lon]) => toXY(lat, lon));
  const extent = Math.max(...[...ring, ...tipXY].map(([x, y]) => Math.max(Math.abs(x), Math.abs(y)))) || 1e-4;
  const S_ = 78 / extent,
    P = ([x, y]) => [(110 + x * S_).toFixed(1), (110 + y * S_).toFixed(1)];
  const hitTips = new Set([...A.hits.map(h => h.tip), ...A.sunHits.map(h => h.tip)]);
  const rays = tips
    .map((t, i) => {
      const r = (t.brg * Math.PI) / 180,
        x = 110 + Math.sin(r) * 104,
        y = 110 - Math.cos(r) * 104;
      return `<line x1="110" y1="110" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="fl-ray${hitTips.has(i) ? ' hit' : ''}"/>`;
    })
    .join('');
  const outline = ring.length ? `<polygon points="${ring.map(P).join(' ')}" class="fl-outline"/>` : '';
  const dots = tipXY
    .map((q, i) => {
      const [x, y] = P(q),
        idx = tips.findIndex(
          t => Math.abs(t.brg - GEO.bearing(c[0], c[1], g.tips[i][0], g.tips[i][1])) < 1e-9,
        );
      return `<circle cx="${x}" cy="${y}" r="3.2" class="fl-tip"/><text x="${x}" y="${y - 6}" class="fl-num" text-anchor="middle">${idx + 1}</text>`;
    })
    .join('');
  return `<svg class="fl-svg" viewBox="0 0 220 220" role="img" aria-label="Outline of the fort and the directions its points face"><circle cx="110" cy="110" r="104" class="fl-ring"/>${rays}${outline}${dots}<text x="110" y="12" text-anchor="middle" class="fl-n">N</text></svg>`;
}

function fortSection(p) {
  const A = analyseFort(p);
  const { shape, g } = A;
  const tolChips = TOLS.map(t => v2ButtonId('fort-tol', t, `±${t}°`, t === V2.fortTol ? 'primary' : '')).join(
    '',
  );
  const groupChips = Object.entries(GROUPS)
    .map(([k, gr]) => v2ButtonId('fort-group', k, gr.label, k === V2.fortGroup ? 'primary' : ''))
    .join('');
  const hitRows = A.hits
    .slice(0, 20)
    .map(
      h =>
        `<button class="v2-find" data-v2="fort-see" data-id="${esc(h.p.id)}"><span class="nm"><strong>${esc(h.p.n)}</strong><small>point ${h.tip + 1} · ${h.off.toFixed(2)}° off · ${esc(h.p.reg || '')}</small></span><span class="km">${fmtKm(h.km)}</span></button>`,
    )
    .join('');
  const sunRows = A.sunHits
    .map(
      h =>
        `<div class="sky-hit ${h.body}"><span class="sky-dot"></span><span><strong>${esc(h.label)}</strong><small>point ${h.tip + 1} · ${h.az.toFixed(1)}° · ${h.off.toFixed(2)}° off</small></span></div>`,
    )
    .join('');
  const verdict = (luck, n) =>
    luck.p < 0.05
      ? `<b>Unusual for this fort:</b> turned to a random angle, it would do this well only ${chance(luck.p)} of the time.`
      : `<b>About what chance gives:</b> turned to a random angle, it would aim at ${n ? 'this many or more' : 'at least as many'} ${chance(luck.p)} of the time (on average ${luck.expected.toFixed(1)}).`;
  return (
    `<div class="v2-card tinted"><h3 style="margin:0">${esc(p.n)}</h3>${p.reg ? `<p class="v2-muted" style="margin:2px 0 0">${esc(p.reg)}</p>` : ''}` +
    `<div class="fl-top">${fortSvg(A)}<dl class="kv fl-kv">` +
    `<dt>Points</dt><dd>${shape.n}</dd>` +
    `<dt>Evenly spaced</dt><dd>${pct(shape.regularity)}</dd>` +
    `<dt>Same reach</dt><dd>${pct(shape.roundness)}</dd>` +
    `<dt>Faces</dt><dd>${shape.facing.toFixed(1)}° <small>(of ${(360 / shape.n).toFixed(0)}°)</small></dd>` +
    (g.ha ? `<dt>Area</dt><dd>${nf(Math.round(g.ha * 10) / 10)} ha</dd>` : '') +
    (g.year ? `<dt>Built</dt><dd>${g.year}</dd>` : '') +
    `</dl></div>` +
    `<p class="v2-muted" style="margin:6px 0 0">Points are the tips of the traced outline: bastions plus any ravelins and outworks. "Faces" is the direction of the points folded into one sector, so forts with the same number of points can be compared.</p>` +
    `<div class="v2-actions">${v2Button('fort-rays', V2.fortRays ? 'Hide its directions on the map' : 'Show its directions on the map', V2.fortRays ? '' : 'primary')}${v2Button('fort-goto', 'Go to the fort')}</div></div>` +
    `<div class="v2-card"><div class="v2-row"><h3>What its points aim at</h3><span class="v2-label">${nf(A.hits.length)} within ±${V2.fortTol}°</span></div>` +
    `<div class="v2-actions sky-chips">${groupChips}</div><div class="v2-actions sky-chips">${tolChips}</div>` +
    `<p class="v2-muted" style="margin:0 0 6px">${nf(A.targets.length)} ${esc(A.group.label.toLowerCase())} within ${fmtKm(REACH_KM)}.</p>` +
    (hitRows || `<p class="v2-muted">No point aims at one of them within ±${V2.fortTol}°.</p>`) +
    `<p class="v2-note" style="margin:8px 0 0">${verdict(A.luck, A.hits.length)}</p></div>` +
    `<div class="v2-card"><div class="v2-row"><h3>The sun and moon</h3><span class="v2-label">${A.sunHits.length ? 'points at one' : 'no match'}</span></div>` +
    `<p class="v2-muted" style="margin:0 0 6px">Solstice, equinox and lunar standstill rises and sets in ${g.year ? 'the year it was built' : 'AD 1600 (build year not recorded)'}, ±${V2.fortTol}°.</p>` +
    (sunRows || `<p class="v2-muted">No point faces one.</p>`) +
    `<p class="v2-note" style="margin:8px 0 0">${verdict(A.sunLuck, A.sunHits.length)}</p></div>`
  );
}

// ---------- every fort ----------
let NETWORK = null; // { key, running, done, result }

function allForts() {
  return ALLP.filter(p => p.cat === 'fort' && fortGeometry(p));
}

function datasetSection() {
  const forts = allForts();
  const byN = new Map();
  for (const p of forts) {
    const n = p.ext.t.length;
    if (!byN.has(n)) byN.set(n, []);
    byN.get(n).push(p);
  }
  const counts = [...byN].sort((a, b) => a[0] - b[0]);
  const max = Math.max(...counts.map(c => c[1].length));
  const bars = counts
    .map(
      ([n, list]) =>
        `<div class="fl-bar"><span>${n}</span><i style="width:${((list.length / max) * 100).toFixed(1)}%"></i><b>${nf(list.length)}</b></div>`,
    )
    .join('');
  const shapes = counts.filter(([n, list]) => n >= 3 && list.length >= 10);
  // several shapes are tested, so each chance is multiplied by how many (the fair-p correction)
  const facingRows = shapes
    .map(([n, list]) => {
      const r = rayleigh(
          list.map(p => fortShape(tipBearings(p.ext.c, p.ext.t)).facing),
          n,
        ),
        fair = Math.min(1, r.p * shapes.length);
      return `<tr><td>${n} points</td><td class="n">${nf(list.length)}</td><td class="n">${r.R.toFixed(2)}</td><td>${fair < 0.05 ? `<b>lined up</b> (${chance(fair)} by luck)` : `no shared direction (${chance(fair)})`}</td></tr>`;
    })
    .join('');
  const net = NETWORK && NETWORK.key === networkKey() ? NETWORK : null;
  const netHtml = !net
    ? `<div class="v2-actions">${v2Button('fort-network', 'Run the network test', 'primary')}</div>`
    : net.running
      ? `<p class="v2-muted" id="fl-net">Checking every fort… ${Math.round(net.progress * 100)}%</p>`
      : (() => {
          const r = net.result,
            ratio = r.expected ? r.observed / r.expected : 0;
          return (
            `<dl class="kv"><dt>Forts checked</dt><dd>${nf(r.forts)}</dd><dt>Points aimed at another fort</dt><dd>${nf(r.observed)}</dd><dt>Expected by chance</dt><dd>${r.expected.toFixed(1)}</dd><dt>Ratio</dt><dd>${ratio.toFixed(2)}×</dd></dl>` +
            `<p class="v2-note" style="margin:8px 0 0">${
              r.p < 0.05
                ? `<b>More than chance:</b> this many or more would happen by luck only ${chance(r.p)} of the time.`
                : `<b>About what chance gives:</b> randomly turned forts would do at least this well ${chance(r.p)} of the time.`
            } Forts that stand close together (a fortified town and its outer forts, say) can push this up without any long-range plan.</p>`
          );
        })();
  return (
    `<h3 style="margin:16px 0 4px">All traced star forts</h3>` +
    `<div class="v2-card"><div class="v2-row"><h3>How many points</h3><span class="v2-label">${nf(forts.length)} forts</span></div><div class="fl-bars">${bars}</div>` +
    `<p class="v2-muted" style="margin:6px 0 0">Four and five points are the most common shapes. Counts include ravelins and outworks where the outline traces them.</p></div>` +
    `<div class="v2-card"><div class="v2-row"><h3>Do forts face the same way?</h3><span class="v2-label">by number of points</span></div>` +
    `<p class="v2-muted" style="margin:0 0 6px">If forts were laid out on one worldwide plan, forts with the same shape might share a direction. "Lined up" ranges from 0 (directions spread evenly) to 1 (all identical).</p>` +
    `<div class="tblwrap"><table class="tbl"><tr><th>Shape</th><th style="text-align:right">Forts</th><th style="text-align:right">Lined up</th><th>Verdict</th></tr>${facingRows}</table></div>` +
    `<p class="v2-muted" style="margin:6px 0 0">${shapes.length} shapes are checked, so each chance is multiplied by ${shapes.length} to stay fair. A shared direction can have plain causes too: forts on one coast facing the sea, or one engineer's designs.</p></div>` +
    `<div class="v2-card"><div class="v2-row"><h3>Do forts point at each other?</h3><span class="v2-label">within ${fmtKm(500)}, ±${V2.fortTol}°</span></div>` +
    `<p class="v2-muted" style="margin:0 0 6px">Counts every point of every fort that aims at another star fort, and compares the total with forts turned to random angles.</p>${netHtml}</div>`
  );
}

const networkKey = () => `${V2.fortTol}|${allForts().length}`;

function runNetwork() {
  const forts = allForts().map(p => {
    const brgs = tipBearings(p.ext.c, p.ext.t).map(t => t.brg);
    return { p, c: p.ext.c, brgs };
  });
  const tol = V2.fortTol;
  NETWORK = { key: networkKey(), running: true, progress: 0 };
  let i = 0,
    observed = 0,
    expected = 0;
  const step = () => {
    if (!NETWORK || NETWORK.key !== networkKey()) return;
    const t0 = performance.now();
    while (i < forts.length && performance.now() - t0 < 25) {
      const a = forts[i++];
      const cover = Math.min(1, (a.brgs.length * 2 * tol) / 360);
      for (const b of forts) {
        if (b === a) continue;
        const km = GEO.dist(a.c[0], a.c[1], b.c[0], b.c[1]);
        if (km < 1 || km > 500) continue;
        expected += cover;
        const brg = GEO.bearing(a.c[0], a.c[1], b.c[0], b.c[1]);
        if (a.brgs.some(x => Math.abs(((((x - brg) % 360) + 540) % 360) - 180) <= tol)) observed++;
      }
    }
    NETWORK.progress = i / forts.length;
    if (i < forts.length) {
      const el = document.getElementById('fl-net');
      if (el) el.textContent = `Checking every fort… ${Math.round(NETWORK.progress * 100)}%`;
      setTimeout(step, 0);
      return;
    }
    NETWORK = {
      key: NETWORK.key,
      running: false,
      result: { forts: forts.length, observed, expected, p: poissonAtLeast(observed, expected) },
    };
    if (V2.tab === 'fortlab') v2Render();
  };
  step();
}

// ---------- the screen ----------
function labScreen() {
  const p = V2.fortLab && findPoint(V2.fortLab);
  const quick = QUICK.map(id => findPoint(id))
    .filter(q => q && fortGeometry(q))
    .map(q => v2ButtonId('fort-open', q.id, esc(q.n), q === p ? 'primary' : ''))
    .join('');
  return (
    v2Peek(p ? `Star fort lab · ${esc(p.n)}` : 'Star fort lab') +
    `<p class="v2-sub" style="margin:0 0 8px">Measure a fort's shape and the directions its points face, then check whether they aim at anything more often than chance would give.</p>` +
    `<div class="v2-kicker">Pick a fort</div><div class="v2-actions sky-chips">${quick}</div>` +
    `<p class="v2-muted" style="margin:2px 0 8px">Or tap any star fort on the map and choose <b>Star fort lab</b> on its card.</p>` +
    (p && fortGeometry(p) ? fortSection(p) : '') +
    datasetSection()
  );
}

// rays on the map along each point of the chosen fort
function drawFortRays(P) {
  if (!V2.fortRays || V2.tab !== 'fortlab') return;
  const p = V2.fortLab && findPoint(V2.fortLab),
    g = fortGeometry(p);
  if (!g) return;
  ctx.save();
  ctx.strokeStyle = '#d99a1e';
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.85;
  for (const t of tipBearings(g.centre, g.tips)) {
    ctx.beginPath();
    let first = true;
    for (let k = 0; k <= 40; k++) {
      const [la, lo] = GEO.dest(g.centre[0], g.centre[1], t.brg, (RAY_KM * k) / 40),
        q = P([lo, la]);
      if (!q) {
        first = true;
        continue;
      }
      if (first) ctx.moveTo(q[0], q[1]);
      else ctx.lineTo(q[0], q[1]);
      first = false;
    }
    ctx.stroke();
  }
  ctx.restore();
}

function openFort(id) {
  V2.fortLab = id;
  v2Persist();
  if (V2.tab !== 'fortlab') v2ChangeTab('fortlab');
  else v2Render();
  req();
}

export function initFortLab() {
  registerScreen('fortlab', labScreen, { title: 'Star fort lab', parent: 'tools' });
  registerTool({
    id: 'fortlab',
    icon: '✶',
    title: 'Star fort lab',
    sub: 'Shapes, the way their points face, and what they aim at',
    action: 'fort-lab',
  });
  registerAction('fort-lab', id => {
    if (id && fortGeometry(findPoint(id))) V2.fortLab = id;
    openFort(V2.fortLab);
  });
  registerAction('fort-open', id => {
    openFort(id);
    const p = findPoint(id);
    if (p) flyTo(p.lon, p.lat, kForKm(4), 900);
  });
  const redo = () => {
    v2Persist();
    v2Render();
    req();
  };
  registerAction('fort-tol', t => {
    V2.fortTol = +t;
    redo();
  });
  registerAction('fort-group', g => {
    V2.fortGroup = g;
    redo();
  });
  registerAction('fort-rays', () => {
    V2.fortRays = !V2.fortRays;
    redo();
    const p = findPoint(V2.fortLab);
    if (V2.fortRays && p) flyTo(p.lon, p.lat, kForKm(RAY_KM * 2.2), 900); // pull back so the rays show
  });
  registerAction('fort-goto', () => {
    const p = findPoint(V2.fortLab);
    if (p) flyTo(p.lon, p.lat, kForKm(1200), 900);
  });
  // show a target on the map without leaving the lab
  registerAction('fort-see', id => {
    const q = findPoint(id);
    if (!q) return;
    if (!V2.fortRays) V2.fortRays = true;
    flyTo(q.lon, q.lat, kForKm(600), 900);
    toast(`${q.n}`, 3000);
    v2Render();
  });
  registerAction('fort-network', () => {
    runNetwork();
    v2Render();
  });
  addDrawLayer('top', drawFortRays);
  // the targets a fort aims at stay visible on the map while the lab is open
  addSiteHighlighter(() => {
    if (V2.tab !== 'fortlab' || !V2.fortRays) return null;
    const p = V2.fortLab && findPoint(V2.fortLab);
    if (!fortGeometry(p)) return null;
    return new Set(analyseFort(p).hits.map(h => h.p.id));
  });
}
