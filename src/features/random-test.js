// Is it unusual? Random-line test
import { fairP, independentDirections } from '../core/stats.js';
import { GEO } from '../core/geo.js';
import { $, $$, esc, nf, wrap } from '../core/util.js';
import { INTS } from '../domain/analysis.js';
import { LINEBY, activeLine } from '../domain/lines.js';
import { ALLP, findPoint, rebuildPoints, srcOn } from '../domain/points.js';
import { bindUgTest, ugTestPanel } from './underground-test.js';
import { DEPV, UG, UGBIT, depData, depVecs } from '../domain/underground.js';
import { flyTo } from '../map/camera.js';
import { kForKm } from '../map/canvas.js';
import { req } from '../map/draw.js';
import { fmtKm, fmtLL } from '../core/format.js';
import { showDetail } from '../panels/detail.js';
import { parseCoords } from '../panels/forts-pane.js';
import { S } from '../state/state.js';
import { toast } from '../ui/intro.js';
import { lineSw, setFocus } from '../ui/map-chrome.js';
import { setMode } from '../ui/modes.js';
import { openLinePicker } from '../ui/picker.js';
import { changed } from '../ui/sheet.js';

// ================= TEST pane =================
let TEST = null;
const POOLS = () => [
  [
    'fort',
    'Star forts (catalogue + project)',
    ALLP.filter(p => p.cat === 'fort' && (p.set === 'fort' || p.set === 'core')),
  ],
  ['pleiades', 'Pleiades ancient temples', ALLP.filter(p => p.set === 'pleiades')],
  ['unesco', 'UNESCO World Heritage', ALLP.filter(p => p.set === 'unesco')],
  ['roman', 'Roman-era monuments (Pleiades)', ALLP.filter(p => p.set === 'roman')],
  ['castle', 'Castles, fortresses & palaces', ALLP.filter(p => p.cat === 'castle' && srcOn(p))],
  ['church', 'Cathedrals, churches & monasteries', ALLP.filter(p => p.cat === 'church' && srcOn(p))],
  ['stone', 'Precision stonework & megaliths', ALLP.filter(p => p.stone || p.cat === 'megalith')],
  ['core', 'Project sites + wonders (biased)', ALLP.filter(p => p.set === 'core' || p.set === 'wonder')],
  ...(S.imports.length ? [['import', 'Your imports', ALLP.filter(p => p.set === 'import')]] : []),
  ...UG.map(([g, t]) => ['dep-' + g, 'Deposits: ' + t, depPool(g)]),
];
const DEPPOOL = {};
/** Forget the cached deposit pools (the deposits dataset changed). */
export function resetDepPools() {
  for (const k of Object.keys(DEPPOOL)) delete DEPPOOL[k];
}
function depPool(g) {
  if (DEPPOOL[g]) return DEPPOOL[g];
  const D = depData();
  depVecs(0);
  const out = [];
  for (let k = 0; k < D.n; k++)
    if (!D.approx[k] && D.m[k] & UGBIT[g])
      out.push({
        id: 'dep' + k,
        lat: D.lat[k],
        lon: D.lon[k],
        v: [DEPV[k * 3], DEPV[k * 3 + 1], DEPV[k * 3 + 2]],
      });
  return (DEPPOOL[g] = out);
}
const LAB_OPEN = { site: false, line: true, crossings: false };
import { compareLine } from '../core/line-comparison.js';

export function renderLab() {
  $$('#p-lab [data-lab-section]').forEach(d => {
    LAB_OPEN[d.dataset.labSection] = d.open;
  });
  const L = activeLine();
  const vis = INTS.filter(x => !(S.hideTrivial && x.trivial)),
    mode = TEST?.mode || 'rotate',
    pools = POOLS();
  if (!pools.find(p => p[0] === S.control)) S.control = 'fort';
  const note =
    {
      core: 'The project list was partly built from leads found along the Vatican line, which biases this result. Prefer an independent set.',
      fort: 'Every star fort in open data: independent of this project, and the right comparison for the fort-node idea.',
      pleiades: 'Scholarly gazetteer of ancient temples and sanctuaries, made independently of this project.',
      unesco: 'Made independently of this project, so it can’t be biased toward the line.',
      import: 'Your imported rows.',
      castle: 'Castlemap list: made independently of this project.',
      church: 'Every church-type site switched on, from all lists.',
      stone: 'The 88 sites scored for stonework, plus any megalith from other lists.',
    }[S.control] ||
    (S.control.startsWith('dep-')
      ? 'Recorded mineral deposits. Counts are dominated by North America, where the records are most complete; a line through Europe crosses far fewer records.'
      : '');
  $('#p-lab').innerHTML = `
  <details class="v2-sec" data-lab-section="site" ${LAB_OPEN.site ? 'open' : ''}><summary>Site comparison</summary>${ugTestPanel()}</details>
  <details class="v2-sec" data-lab-section="line" ${LAB_OPEN.line ? 'open' : ''}><summary>Line comparison</summary>
  <div class="notebar">${L ? lineSw(L, 24, 12) : ''}<span style="flex:1;min-width:0">${L ? `<b>${esc(L.short || L.name)}</b> · ±${fmtKm(S.corridorKm)}` : 'No line chosen yet. Draw a line between two sites, or pick one here.'}</span><button class="btn" id="t-line">${L ? 'Change' : 'Choose a line'}</button></div>
  <p class="lede">Counts sites inside the corridor, then repeats with 2,000 control lines to see how often an ordinary line does as well.</p>
  <label class="f">Sites to count<select id="t-pool">${pools.map(([k, n, arr]) => `<option value="${k}" ${k === S.control ? 'selected' : ''}>${esc(n)} (${nf(arr.length)})</option>`).join('')}</select></label>
  <p class="small" style="margin:6px 0 10px">${note}</p>
  <label class="f">Control lines</label>
  <div class="seg" role="group" aria-label="Control type" style="margin-top:5px"><button id="t-rot" aria-pressed="${mode === 'rotate'}">Rotated about the start</button><button id="t-rnd" aria-pressed="${mode === 'random'}">Anywhere on Earth</button></div>
  <p class="small" style="margin-top:6px">${mode === 'rotate' ? 'Keeps the start point fixed: the fair comparison for a line through a dense area.' : 'Random lines often cross empty ocean, which flatters any line through Europe.'}</p>
  <button class="btn primary block" id="t-run" style="margin-top:10px" ${L ? '' : 'disabled'}>Run test</button>
  <div id="t-out" style="margin-top:12px">${TEST && TEST.res ? testView(TEST.res) : ''}</div>
  </details><details class="v2-sec" data-lab-section="crossings" ${LAB_OPEN.crossings ? 'open' : ''}><summary>Line crossings</summary>
  ${
    S.focus
      ? `<div class="notebar"><span style="flex:1">Crossings need more than one line on the map.</span><button class="btn" id="i-all">Show all lines</button></div>`
      : `
  <div class="row"><button class="tog" id="i-triv" role="switch" aria-checked="${S.hideTrivial}" aria-label="Hide crossings at a shared anchor"></button><span class="small">Hide crossings that share an anchor (${INTS.filter(x => x.trivial).length})</span></div>
  ${
    vis.length
      ? `<div class="tblwrap" style="margin-top:6px"><table class="tbl"><tr><th>Where</th><th>Lines</th><th style="text-align:right">Sites</th></tr>${vis
          .slice(0, 25)
          .map(
            x =>
              `<tr data-int="${INTS.indexOf(x)}"><td class="n" style="text-align:left">${fmtLL(x.lat, x.lon, 2)}<div class="small">${x.angle.toFixed(1)}° angle</div></td><td class="small">${esc(LINEBY[x.a]?.short || x.a)} × ${esc(LINEBY[x.b]?.short || x.b)}</td><td class="n">${x.near.length}</td></tr>`,
          )
          .join('')}</table></div>`
      : '<p class="empty">No crossings among the lines switched on.</p>'
  }`
  }
</details>`;
  bindUgTest();
  $('#t-line').onclick = openLinePicker;
  $('#t-pool').onchange = e => {
    S.control = e.target.value;
    TEST = { mode };
    renderLab();
  };
  $('#t-rot').onclick = () => {
    TEST = { mode: 'rotate' };
    renderLab();
  };
  $('#t-rnd').onclick = () => {
    TEST = { mode: 'random' };
    renderLab();
  };
  $('#t-run').onclick = () => {
    $('#t-run').textContent = 'Running…';
    $('#t-run').disabled = true;
    setTimeout(() => runTest(mode), 30);
  };
  if ($('#i-all')) $('#i-all').onclick = () => setFocus(false);
  if ($('#i-triv'))
    $('#i-triv').onclick = () => {
      S.hideTrivial = !S.hideTrivial;
      renderLab();
      req();
    };
  $$('#p-lab [data-int]').forEach(
    r =>
      (r.onclick = () => {
        const x = INTS[+r.dataset.int];
        S.sel = { type: 'int', ref: x };
        flyTo(x.lon, x.lat, Math.max(S.cam.k, kForKm(200)), 1400);
        showDetail();
      }),
  );
}

export function renderMapTools() {
  const ms = S.measure;
  let mres = '';
  if (ms.length >= 2) {
    const d1 = GEO.dist(...ms[0], ...ms[1]),
      b1 = GEO.bearing(...ms[0], ...ms[1]);
    mres = `<dt>A → B</dt><dd>${fmtKm(d1)} at ${b1.toFixed(2)}°</dd>`;
    if (ms.length === 3) {
      const d2 = GEO.dist(...ms[1], ...ms[2]),
        ba = GEO.bearing(...ms[1], ...ms[0]),
        bc = GEO.bearing(...ms[1], ...ms[2]);
      mres += `<dt>B → C</dt><dd>${fmtKm(d2)} at ${bc.toFixed(2)}°</dd><dt>Angle at B</dt><dd>${Math.abs(wrap(bc - ba)).toFixed(2)}°</dd>`;
    }
  }
  $('#p-tools').innerHTML = `  <h2>Measure & markers</h2>
  <div class="wrap"><button class="btn ${S.mode === 'measure' ? 'primary' : ''}" id="m-go">${S.mode === 'measure' ? 'Done measuring' : 'Measure distance / angle'}</button><button class="btn ${S.mode === 'marker' ? 'primary' : ''}" id="k-go">${S.mode === 'marker' ? 'Cancel' : 'Drop a marker'}</button></div>
  ${mres ? `<dl class="kv" style="margin-top:10px">${mres}</dl>` : ''}
  <label class="f" style="margin-top:10px">Marker name<input type="text" id="mk-name" aria-label="Marker name" placeholder="optional"></label>
  <div class="row" style="margin-top:6px"><input type="text" id="mk-ll" aria-label="Marker coordinates" placeholder="or type / paste coordinates"><button class="btn" id="mk-add">Add</button></div>`;
  $('#m-go').onclick = () => {
    if (S.mode === 'measure') setMode(null);
    else {
      S.measure = [];
      setMode('measure');
    }
  };
  $('#k-go').onclick = () => setMode(S.mode === 'marker' ? null : 'marker');
  $('#mk-add').onclick = () => {
    const c = parseCoords($('#mk-ll').value)[0];
    if (!c) {
      toast('No coordinates found');
      return;
    }
    S.markers.push({
      id: 'm' + Date.now(),
      n: $('#mk-name').value.trim() || `Marker ${S.markers.length + 1}`,
      lat: c[0],
      lon: c[1],
      reg: 'Your marker',
      unc: 0,
    });
    rebuildPoints();
    changed();
    toast('Marker added');
  };
}
function runTest(mode) {
  const L = activeLine(),
    w = S.corridorKm;
  if (!L) {
    renderLab();
    return;
  }
  if (L.segs.length !== 1) {
    TEST = { mode, res: { err: 'This line is a multi-point path. Test its best-fit line instead.' } };
    renderLab();
    return;
  }
  const sg = L.segs[0],
    anchors = L.anchors.map(findPoint).filter(Boolean);
  const pool = POOLS()
    .find(p => p[0] === S.control)[2]
    .filter(p => !L.anchors.includes(p.id) && !anchors.some(a => GEO.dist(a.lat, a.lon, p.lat, p.lon) < 0.3));
  const { obs, N, p, mean, hist } = compareLine(sg, pool, w, mode);
  TEST = {
    mode,
    res: {
      obs,
      N,
      p,
      mean,
      hist,
      w,
      mode,
      pool: pool.length,
      ctl: S.control,
      ctlName: POOLS().find(p => p[0] === S.control)[1],
      line: L.short || L.name,
      picked: L.pickedBy || null,
    },
  };
  renderLab();
  $('#t-out')?.scrollIntoView({ block: 'nearest' });
}
function testView(t) {
  if (t.err) return `<p class="note warn">${esc(t.err)}</p>`;
  const rawMax = Math.max(t.obs, ...t.hist),
    bwid = Math.max(1, Math.ceil((rawMax + 1) / 60)),
    max = Math.floor(rawMax / bwid),
    bins = Array(max + 1).fill(0);
  t.hist.forEach(h => bins[Math.floor(h / bwid)]++);
  const obsB = Math.floor(t.obs / bwid);
  const bm = Math.max(...bins),
    Wd = 320,
    Hd = 110,
    bw = (Wd - 30) / (max + 1);
  let s = `<svg class="hist" viewBox="0 0 ${Wd} ${Hd + 26}" role="img" aria-label="Histogram of control-line site counts">`;
  bins.forEach((b, i) => {
    const h = (b / bm) * Hd;
    s += `<rect x="${20 + i * bw + 0.5}" y="${Hd - h}" width="${Math.max(1, bw - 1)}" height="${h}" style="fill:var(--${i >= obsB ? 'muted' : 'line'})"/>`;
  });
  const ox = 20 + obsB * bw + bw / 2;
  s += `<line x1="${ox}" y1="0" x2="${ox}" y2="${Hd}" style="stroke:var(--accent)" stroke-width="2.5"/><text x="${Math.min(ox + 4, Wd - 70)}" y="12" style="fill:var(--accent)" font-size="11" font-weight="700" font-family="JetBrains Mono, monospace">this line: ${t.obs}</text>`;
  const step = Math.max(1, Math.ceil((max + 1) / 10));
  for (let i = 0; i <= max; i += step)
    s += `<text x="${20 + i * bw + bw / 2}" y="${Hd + 14}" style="fill:var(--muted)" font-size="10" text-anchor="middle" font-family="JetBrains Mono, monospace">${i * bwid}</text>`;
  s += `<text x="${Wd / 2}" y="${Hd + 25}" style="fill:var(--muted)" font-size="10" text-anchor="middle" font-family="Instrument Sans, sans-serif">points inside ±${fmtKm(t.w)} per control line</text></svg>`;
  const verdict =
    t.p < 0.01
      ? 'Very few control lines match this.'
      : t.p < 0.05
        ? 'Somewhat unusual.'
        : 'Ordinary: many control lines do as well or better.';
  // a B chosen after seeing match scores is the best of many tries: allow for that (independent directions ≈ π·length / corridor)
  const pk = t.picked,
    K = pk ? independentDirections(pk.n, pk.L, pk.w) : 1,
    padj = pk ? fairP(t.p, K) : t.p;
  const pnote = pk
    ? `<p class="note ${padj < 0.05 ? '' : 'warn'}"><b>This end point was chosen after seeing match scores</b> for ${nf(pk.n)} candidate sites. Picking the best of many lines will always turn up something, so allow for it: about ${nf(K)} genuinely different directions were on offer, which makes the fair figure <b>p ≈ ${padj.toFixed(3)}</b>${padj < 0.05 ? ' — still unusual.' : ' — not unusual once that is allowed for.'}</p>`
    : '';
  return `<div class="verdict ${padj < 0.05 ? 'hi' : ''}"><b>${pk && padj >= 0.05 && t.p < 0.05 ? 'Unusual on its own, but not once the search is allowed for.' : verdict}</b><span class="mono">p ≈ ${t.p.toFixed(3)}${pk ? ` · fair p ≈ ${padj.toFixed(3)}` : ''}</span></div>${pnote}${s}<dl class="kv"><dt>Line</dt><dd class="t">${esc(t.line)}</dd><dt>This line</dt><dd>${t.obs} of ${nf(t.pool)} · ${esc(t.ctlName)}</dd><dt>Typical control</dt><dd>${t.mean.toFixed(1)}</dd><dt>Controls ≥ this line</dt><dd>${(t.p * 100).toFixed(1)}%</dd></dl>${t.ctl === 'core' && t.p < 0.05 ? '<p class="note warn">Re-run with an independent set (star forts, Pleiades or UNESCO) before reading anything into this.</p>' : ''}`;
}
