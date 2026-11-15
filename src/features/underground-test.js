// Do sites sit closer to deposits, faults or magnetic rock than chance?
import { GEO } from '../core/geo.js';
import { $, $$, esc, nf } from '../core/util.js';
import { ALLP, shownP, srcOn } from '../domain/points.js';
import { renderLab } from './random-test.js';
import { UGBIT, depAnyWithin, faultNearest, landAt, magAt } from '../domain/underground.js';
import { S } from '../state/state.js';
import { keepScroll } from '../ui/sheet.js';

// ================= underground test: do sites sit closer to deposits / faults / magnetic rock than chance? =================
let UT = null;
const UT_SETS = () => [
  ['church', 'Cathedrals, churches & monasteries', p => p.cat === 'church'],
  ['temple', 'Temples & sacred sites', p => p.cat === 'temple'],
  ['castle', 'Castles, fortresses & palaces', p => p.cat === 'castle'],
  ['fort', 'Star forts', p => p.cat === 'fort'],
  ['stone', 'Precision stonework & megaliths', p => !!p.stone || p.cat === 'megalith'],
  ['obelisk', 'Obelisks & standing stones', p => p.cat === 'obelisk'],
  ['ruin', 'Ruins, tombs & pyramids', p => p.cat === 'ruin'],
  ...(S.imports.length ? [['import', 'Your imports', p => p.set === 'import']] : []),
  ['shown', 'Every site switched on', shownP],
];
const UT_TARGETS = [
  ['any', 'Any metal deposit (iron, copper, silver, gold, lead/zinc)'],
  ['iron', 'Iron ore'],
  ['copper', 'Copper'],
  ['silver', 'Silver'],
  ['gold', 'Gold'],
  ['leadzinc', 'Lead & zinc'],
  ['crystal', 'Quartz, gems & crystals'],
  ['fault', 'An active fault'],
  ['mag', 'Strong magnetic rock'],
];
const utMask = t => (t === 'any' ? 1 | 2 | 4 | 8 | 16 : UGBIT[t]);
function utSites() {
  const st = UT_SETS().find(x => x[0] === S.utest.set) || UT_SETS()[0];
  let arr = ALLP.filter(p => srcOn(p) && st[2](p) && p.set !== 'marker');
  if (S.utest.target === 'mag') arr = arr.filter(p => magAt(p.lat, p.lon) != null);
  return { st, arr };
}
export function ugTestPanel() {
  const { st, arr } = utSites(),
    t = S.utest;
  return `<h2>Do these sites sit on metal, crystal or faults?</h2>
  <p class="lede">Checks how many sites have the chosen thing within the radius, then moves every site a random 25–150 km (staying on land) and checks again, 300 times. If the real sites beat almost all the moved copies, the closeness is unlikely to be chance.</p>
  <div class="mapgrid">
    <label class="f">Sites<select id="ut-set">${UT_SETS()
      .map(([k, n]) => `<option value="${k}" ${k === st[0] ? 'selected' : ''}>${esc(n)}</option>`)
      .join('')}</select></label>
    <label class="f">Near<select id="ut-tg">${UT_TARGETS.map(([k, n]) => `<option value="${k}" ${k === t.target ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
  </div>
  ${t.target === 'mag' ? '<p class="small" style="margin-top:6px">Compares the average strength of the magnetic signal (above or below normal) at the sites with the moved copies. Britain uses its detailed survey; elsewhere the world model (about 25 km detail).</p>' : `<label class="f" style="margin-top:8px">Within</label><div class="chips" style="margin-top:4px">${[2, 5, 10, 25, 50].map(r => `<button class="chip" data-utr="${r}" aria-pressed="${t.r === r}">${r} km</button>`).join('')}</div>`}
  <p class="small" style="margin-top:6px">${nf(arr.length)} site${arr.length === 1 ? '' : 's'}${arr.length > 400 ? ' (a fixed sample of 400 is tested)' : ''}${t.target === 'mag' ? ' inside the British survey' : ''}.</p>
  <button class="btn primary block" id="ut-run" style="margin-top:8px" ${arr.length ? '' : 'disabled'}>Run underground test</button>
  <div id="ut-out" style="margin-top:12px">${UT && UT.key === utKey() ? utView(UT) : ''}</div>`;
}
const utKey = () => [S.utest.set, S.utest.target, S.utest.r, S.imports.length].join('|');
export function bindUgTest() {
  $('#ut-set').onchange = e => {
    S.utest.set = e.target.value;
    keepScroll('#p-lab', renderLab);
  };
  $('#ut-tg').onchange = e => {
    S.utest.target = e.target.value;
    keepScroll('#p-lab', renderLab);
  };
  $$('#p-lab [data-utr]').forEach(
    b =>
      (b.onclick = () => {
        S.utest.r = +b.dataset.utr;
        keepScroll('#p-lab', renderLab);
      }),
  );
  $('#ut-run').onclick = runUgTest;
}
function runUgTest() {
  const { st, arr } = utSites(),
    t = { ...S.utest },
    rng = GEO.rng(1108);
  if (!arr.length) return;
  let sites = arr.slice();
  if (sites.length > 400) {
    for (let i = sites.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [sites[i], sites[j]] = [sites[j], sites[i]];
    }
    sites = sites.slice(0, 400);
  }
  const mag = t.target === 'mag',
    fault = t.target === 'fault',
    mask = utMask(t.target),
    r = t.r,
    reps = fault ? 150 : 300;
  const hit = (la, lo) =>
    fault ? (faultNearest(la, lo, Math.ceil(r / 80) + 1)?.d ?? 1e9) <= r : depAnyWithin(la, lo, r, mask);
  const metric = pts => {
    if (mag) {
      let s = 0,
        n = 0;
      for (const [la, lo] of pts) {
        const v = magAt(la, lo);
        if (v != null) {
          s += Math.abs(v);
          n++;
        }
      }
      return n ? s / n : 0;
    }
    let n = 0;
    for (const [la, lo] of pts) if (hit(la, lo)) n++;
    return n;
  };
  const move = (la, lo) => {
    for (let i = 0; i < 25; i++) {
      const d = mag ? 15 + rng() * 85 : 25 + rng() * 125,
        b = rng() * 360,
        f = GEO.frame(la, lo, b),
        q = GEO.ll(GEO.pointAt(f, d));
      if (!landAt(q[0], q[1])) continue;
      if (mag && magAt(q[0], q[1]) == null) continue;
      return q;
    }
    return null;
  };
  const obs = metric(sites.map(p => [p.lat, p.lon])),
    hist = [];
  let done = 0;
  $('#ut-run').disabled = true;
  $('#ut-run').textContent = 'Running… 0%';
  const tick = () => {
    const t0 = performance.now();
    while (done < reps && performance.now() - t0 < 40) {
      const pts = [];
      for (const p of sites) {
        const q = move(p.lat, p.lon);
        if (q) pts.push(q);
      }
      hist.push(mag ? metric(pts) : (metric(pts) * sites.length) / Math.max(1, pts.length));
      done++;
    }
    const b = $('#ut-run');
    if (b) b.textContent = `Running… ${Math.round((done / reps) * 100)}%`;
    if (done < reps) {
      setTimeout(tick, 0);
      return;
    }
    const ge = hist.filter(h => h >= obs - 1e-9).length,
      mean = hist.reduce((a, b) => a + b, 0) / hist.length;
    UT = {
      key: utKey(),
      obs,
      hist,
      reps,
      p: (ge + 1) / (reps + 1),
      mean,
      n: sites.length,
      total: arr.length,
      setName: st[1],
      target: t.target,
      tname: UT_TARGETS.find(x => x[0] === t.target)[1],
      r,
      mag,
    };
    keepScroll('#p-lab', renderLab);
    $('#ut-out')?.scrollIntoView({ block: 'nearest' });
  };
  setTimeout(tick, 20);
}
function utView(u) {
  const fmtv = v => (u.mag ? Math.round(v) + ' nT' : ((v / u.n) * 100).toFixed(0) + '%');
  const lo = Math.min(u.obs, ...u.hist),
    hi = Math.max(u.obs, ...u.hist),
    nb = 30,
    span = Math.max(1e-9, hi - lo),
    bins = Array(nb).fill(0);
  u.hist.forEach(h => bins[Math.min(nb - 1, Math.floor(((h - lo) / span) * nb))]++);
  const bm = Math.max(...bins),
    Wd = 320,
    Hd = 100,
    bw = (Wd - 30) / nb,
    ob = Math.min(nb - 1, Math.floor(((u.obs - lo) / span) * nb));
  let s = `<svg class="hist" viewBox="0 0 ${Wd} ${Hd + 26}" role="img" aria-label="Histogram of moved-site results">`;
  bins.forEach((b, i) => {
    const h = (b / bm) * Hd;
    s += `<rect x="${20 + i * bw + 0.5}" y="${Hd - h}" width="${Math.max(1, bw - 1)}" height="${h}" style="fill:var(--${i >= ob ? 'muted' : 'line'})"/>`;
  });
  const ox = 20 + ((u.obs - lo) / span) * (Wd - 30);
  s += `<line x1="${ox}" y1="0" x2="${ox}" y2="${Hd}" style="stroke:var(--accent)" stroke-width="2.5"/><text x="${Math.min(ox + 4, Wd - 90)}" y="12" style="fill:var(--accent)" font-size="11" font-weight="700" font-family="JetBrains Mono, monospace">real sites: ${fmtv(u.obs)}</text>`;
  s += `<text x="20" y="${Hd + 14}" style="fill:var(--muted)" font-size="10" font-family="JetBrains Mono, monospace">${fmtv(lo)}</text><text x="${Wd - 10}" y="${Hd + 14}" style="fill:var(--muted)" font-size="10" text-anchor="end" font-family="JetBrains Mono, monospace">${fmtv(hi)}</text>`;
  s += `<text x="${Wd / 2}" y="${Hd + 25}" style="fill:var(--muted)" font-size="10" text-anchor="middle" font-family="Instrument Sans, sans-serif">${u.mag ? 'average magnetic strength' : 'share of sites with one within ' + u.r + ' km'}, ${u.reps} moved copies</text></svg>`;
  const low = (u.hist.filter(h => h <= u.obs + 1e-9).length + 1) / (u.reps + 1);
  const verdict =
    u.p < 0.01
      ? 'Closer than almost every moved copy.'
      : u.p < 0.05
        ? 'Somewhat closer than chance.'
        : low < 0.05
          ? 'Further away than chance.'
          : 'No different from chance.';
  return `<div class="verdict ${u.p < 0.05 ? 'hi' : ''}"><b>${verdict}</b><span class="mono">p ≈ ${u.p.toFixed(3)}</span></div>${s}
  <dl class="kv"><dt>Sites</dt><dd class="t">${esc(u.setName)} · ${nf(u.n)}${u.total > u.n ? ' of ' + nf(u.total) : ''}</dd><dt>Near</dt><dd class="t">${esc(u.tname)}${u.mag ? '' : ' · within ' + u.r + ' km'}</dd><dt>Real sites</dt><dd>${fmtv(u.obs)}</dd><dt>Moved copies</dt><dd>${fmtv(u.mean)} on average</dd></dl>
  <p class="note">${u.mag ? 'Moved copies stay inside the survey area and on land.' : 'Moving each site 25–150 km keeps it in the same region, so patchy records by country affect the real and moved sites alike.'} A “closer than chance” result can still have an everyday cause: towns, roads and rich patrons grew up around mines and river valleys, and churches and castles followed the people.</p>`;
}
