// Find alignments: straight lines through 4 or more of the sites showing on the map,
// with one plain luck check (the same sites nudged at random).
import { alignmentSearch, nudged } from '../core/alignments.js';
import { fmtKm } from '../core/format.js';
import { GEO } from '../core/geo.js';
import { esc, nf } from '../core/util.js';
import { ALLP, shownP } from '../domain/points.js';
import { flyTo } from '../map/camera.js';
import { ctx, kForKm, ptInB, viewBounds } from '../map/canvas.js';
import { req } from '../map/draw.js';
import { addDrawLayer, addSiteHighlighter } from '../map/hooks.js';
import { V2 } from '../state/preferences.js';
import { v2Button, v2Peek } from '../ui/panel-parts.js';
import { v2ChangeTab, v2Render } from '../ui/panels.js';
import { registerAction, registerScreen } from '../ui/registry.js';
import { v2ApplyEnds } from './create-lines.js';

const WIDTH_KM = 1; // a site within this of the line is "on" it
const MAX_SITES = 400; // more than this in view: ask to zoom in
const SHUFFLES = 3;

// one search at a time; kept until the next search
let RUN = null; // { state: 'running'|'done'|'toomany'|'toofew', n, progress, lines, chance, sel }

const sitesInView = () => {
  const B = viewBounds();
  return ALLP.filter(p => shownP(p) && p.cat !== 'marker' && ptInB(p.lat, p.lon, B));
};

function start() {
  const pts = sitesInView();
  if (pts.length > MAX_SITES) {
    RUN = { state: 'toomany', n: pts.length };
    return;
  }
  if (pts.length < 4) {
    RUN = { state: 'toofew', n: pts.length };
    return;
  }
  const run = (RUN = { state: 'running', n: pts.length, progress: 0, lines: [], chance: null, sel: null });
  // the real search first, then the nudged copies for the luck check
  const jobs = [alignmentSearch(pts, { widthKm: WIDTH_KM })];
  for (let k = 0; k < SHUFFLES; k++) jobs.push(alignmentSearch(nudged(pts, 101 + k), { widthKm: WIDTH_KM }));
  let j = 0;
  const tick = () => {
    if (RUN !== run) return; // a newer search replaced this one
    const done = jobs[j].step(24);
    run.progress = (j + jobs[j].progress()) / jobs.length;
    if (done) {
      if (j === 0)
        run.lines = jobs[0].lines(8).map(L => ({
          ...L,
          A: pts[L.a],
          B: pts[L.b],
          sites: L.members.map(m => pts[m]),
        }));
      j++;
    }
    if (j < jobs.length) {
      const el = document.getElementById('al-prog');
      if (el) el.textContent = `Searching… ${Math.round(run.progress * 100)}%`;
      setTimeout(tick, 0);
      return;
    }
    run.chance = jobs.slice(1).map(s => s.lines(1)[0]?.count || 0);
    run.state = 'done';
    if (V2.tab === 'align') v2Render();
    req();
  };
  tick();
}

function verdict(run) {
  const best = run.lines[0].count,
    luck = Math.max(...run.chance);
  if (best > luck)
    return `<b>More than chance gave here.</b> The same sites nudged at random lined up ${luck ? `${luck} at most` : 'not at all'}; the best real line has ${best}. Worth a closer look. A guide, not proof.`;
  return `<b>About what chance gives.</b> The same sites nudged at random also lined up ${luck} at a time; the best real line has ${best}.`;
}

function screen() {
  const run = RUN;
  let body;
  if (!run)
    body = `<div class="v2-actions">${v2Button('align-run', 'Search the sites in view', 'primary')}</div>`;
  else if (run.state === 'toomany')
    body = `<p class="v2-note">${nf(run.n)} sites are in view; the search handles up to ${MAX_SITES}. Zoom in, or switch some site types off in Map layers.</p><div class="v2-actions">${v2Button('align-run', 'Try again', 'primary')}</div>`;
  else if (run.state === 'toofew')
    body = `<p class="v2-note">Only ${run.n} site${run.n === 1 ? ' is' : 's are'} in view. Zoom out a little.</p><div class="v2-actions">${v2Button('align-run', 'Try again', 'primary')}</div>`;
  else if (run.state === 'running')
    body = `<p class="v2-muted" id="al-prog">Searching… ${Math.round(run.progress * 100)}%</p>`;
  else if (!run.lines.length)
    body = `<p class="v2-note">No line passes through 4 or more of the ${nf(run.n)} sites in view.</p><div class="v2-actions">${v2Button('align-run', 'Search again', 'primary')}</div>`;
  else {
    const rows = run.lines
      .map(
        (L, k) =>
          `<button class="v2-find al-row${run.sel === k ? ' on' : ''}" data-v2="align-see" data-id="${k}"><span class="nm"><strong>${L.count} sites · ${fmtKm(L.km)}</strong><small>${esc(L.A.n)} → ${esc(L.B.n)}</small></span><span class="km">±${fmtKm(L.rms)}</span></button>`,
      )
      .join('');
    const sel = run.sel != null ? run.lines[run.sel] : null;
    body =
      `<p class="v2-note" style="margin:0 0 8px">${verdict(run)}</p>` +
      rows +
      (sel
        ? `<div class="v2-card tinted" style="margin-top:10px"><p class="v2-muted" style="margin:0 0 6px">${sel.sites.map(s => esc(s.n)).join(' · ')}</p><div class="v2-actions">${v2Button('align-use', 'Open as my line', 'primary')}</div></div>`
        : `<p class="v2-muted" style="margin:8px 0 0">Tap a line to see it on the map.</p>`) +
      `<div class="v2-actions" style="margin-top:10px">${v2Button('align-run', 'Search this view again')}</div>`;
  }
  return (
    v2Peek('Find alignments') +
    `<p class="v2-sub" style="margin:0 0 10px">Looks for straight lines through 4 or more of the sites showing on the map, each within ${fmtKm(WIDTH_KM)} of the line. Sites in the same town count once.</p>` +
    body
  );
}

function drawLines(P) {
  if (V2.tab !== 'align' || !RUN || RUN.state !== 'done') return;
  RUN.lines.forEach((L, k) => {
    const on = RUN.sel === k,
      brg = GEO.bearing(L.A.lat, L.A.lon, L.B.lat, L.B.lon);
    ctx.save();
    ctx.strokeStyle = '#d99a1e';
    ctx.lineWidth = on ? 3.5 : 1.5;
    ctx.globalAlpha = on ? 1 : RUN.sel == null ? 0.75 : 0.3;
    ctx.beginPath();
    let first = true;
    for (let s = 0; s <= 32; s++) {
      const [la, lo] = GEO.dest(L.A.lat, L.A.lon, brg, (L.km * s) / 32),
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
    ctx.restore();
  });
}

export function initAlignments() {
  registerScreen('align', screen, { title: 'Find alignments', parent: 'menu' });
  registerAction('align', () => v2ChangeTab('align'));
  registerAction('align-run', () => {
    start();
    v2Render();
    req();
  });
  registerAction('align-see', k => {
    if (!RUN?.lines) return;
    RUN.sel = RUN.sel === +k ? null : +k;
    const L = RUN.lines[RUN.sel];
    if (L) {
      const [la, lo] = GEO.dest(L.A.lat, L.A.lon, GEO.bearing(L.A.lat, L.A.lon, L.B.lat, L.B.lon), L.km / 2);
      flyTo(lo, la, kForKm(L.km * 1.6), 800);
    }
    v2Render();
    req();
  });
  registerAction('align-use', () => {
    const L = RUN?.lines?.[RUN.sel];
    if (!L) return;
    if (
      v2ApplyEnds(
        [
          [L.A.lat, L.A.lon],
          [L.B.lat, L.B.lon],
        ],
        `${L.A.n} → ${L.B.n}`,
      )
    )
      v2ChangeTab('analyze');
  });
  addDrawLayer('top', drawLines);
  addSiteHighlighter(() => {
    if (V2.tab !== 'align' || RUN?.state !== 'done' || RUN.sel == null) return null;
    return new Set(RUN.lines[RUN.sel].sites.map(s => s.id));
  });
}
