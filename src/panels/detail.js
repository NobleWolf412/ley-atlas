// Site detail (full record)
import { GEO } from '../core/geo.js';
import { $, $$, esc, nf } from '../core/util.js';
import { LINEBY, LINES, lineDist } from '../domain/lines.js';
import { AUTO, findPoint, rebuildPoints } from '../domain/points.js';
import { TYPENAME } from '../domain/site-types.js';
import { depData, depPrim, showDeposit, showFault, ugBlock, ugMask } from '../layers/underground.js';
import { flyTo } from '../map/camera.js';
import { kForKm } from '../map/canvas.js';
import { req } from '../map/draw.js';
import { fmtKm, fmtLL, satUrl } from '../core/format.js';
import { copyText } from './data-pane.js';
import { iconSvg } from '../render/icons.js';
import { bindSiteRows, tag } from './lines-pane.js';
import { V2 } from '../state/preferences.js';
import { S } from '../state/state.js';
import { v2CloseHost } from '../ui/panels.js';
import { changed, selectTab, setSheet } from '../ui/sheet.js';

// ================= SITES pane =================
// ================= DETAIL =================
export function showDetail(silent) {
  if (!S.sel) return;
  if (S.sel.type === 'dep') {
    showDeposit(S.sel.k);
    return;
  }
  if (S.sel.type === 'fault') {
    showFault(S.sel.ref);
    return;
  }
  const el = $('#p-detail');
  if (S.sel.type === 'site') {
    const s = findPoint(S.sel.id);
    if (!s) return;
    const dists = LINES.filter(l => S.layers[l.layer])
      .map(l => ({ l, r: lineDist(l, s.lat, s.lon) }))
      .sort((a, b) => a.r.d - b.r.d)
      .slice(0, 10);
    const cls = s.cls || 'structure',
      x = s.ext;
    const vtxt = s.given
      ? 'Your supplied anchor coordinate'
      : s.v2 === 'wiki'
        ? 'Checked against Wikipedia'
        : s.v2 === 'unesco'
          ? 'Agrees with the UNESCO list coordinate'
          : s.v2 === 'src'
            ? 'Taken from the claim’s own source'
            : s.srcLabel
              ? s.srcLabel
              : s.set === 'marker'
                ? 'Your marker'
                : 'Reference value, not yet re-checked';
    const wikiHref =
      s.wikiUrl ||
      (s.wiki
        ? 'https://en.wikipedia.org/wiki/' +
          encodeURIComponent(s.wiki).replace(/%2C/g, ',').replace(/%2F/g, '/')
        : null);
    const moved = s.catPt ? GEO.dist(s.catPt[0], s.catPt[1], s.lat, s.lon) : 0;
    el.innerHTML = `<button class="back" id="d-back">← Back</button>
    <div class="detail"><div class="row"><svg viewBox="-9 -9 18 18" width="24" height="24" aria-hidden="true">${iconSvg(s)}</svg><span class="small">${esc(TYPENAME[s.cat] || '')} · ${esc(s.reg || '')}</span></div>
    <h3>${esc(s.n)}</h3>${tag(cls)}
    <div class="wrap" style="margin:12px 0">
      <a class="btn" href="${satUrl(s.lat, s.lon, 18)}" target="_blank" rel="noopener">Google Maps ↗</a>
      ${wikiHref ? `<a class="btn" href="${esc(wikiHref)}" target="_blank" rel="noopener">Wikipedia ↗</a>` : ''}
      ${x && x.q ? `<a class="btn" href="https://www.wikidata.org/wiki/${esc(x.q)}" target="_blank" rel="noopener">Wikidata ↗</a>` : ''}
      <button class="btn ghost" id="d-copy">Copy coords</button>
      ${s.set === 'marker' ? '<button class="btn danger" id="d-del">Delete marker</button>' : ''}
    </div>
    <dl class="kv">
      <dt>Position</dt><dd>${s.lat.toFixed(5)}, ${s.lon.toFixed(5)}</dd>
      <dt>Uncertainty</dt><dd>±${fmtKm((s.unc || 0) / 1000)}</dd>
      <dt>Coordinate</dt><dd class="t">${s.srcUrl ? `<a href="${esc(s.srcUrl)}" target="_blank" rel="noopener">${esc(vtxt)} ↗</a>` : esc(vtxt)}${s.vNote ? '. ' + esc(s.vNote) : ''}${s.fix ? '. ' + esc(s.fix) : ''}${moved > 0.005 ? `. Marker sits on the traced outline’s centre, ${fmtKm(moved)} from the catalogue point.` : ''}</dd>
      ${s.built ? `<dt>Built</dt><dd class="t">${esc(s.built)}</dd>` : ''}
      ${x && x.b ? `<dt>Builder</dt><dd class="t">${esc(x.b)}</dd>` : ''}
      ${x && x.a ? `<dt>Area</dt><dd>${x.a} ha</dd>` : ''}
      ${s.use ? `<dt>Notes</dt><dd class="t">${esc(s.use)}</dd>` : ''}
    </dl>
    ${s.fort ? fortNote(s) : ''}
    ${s.stone ? stoneBlock(s.stone) : ''}
    <div id="d-ug"><h2>What’s underground nearby</h2><p class="small">Looking up deposits…</p></div>
    <h2>Distance to lines</h2>
    <div class="tblwrap"><table class="tbl"><tr><th>Line</th><th style="text-align:right">Distance</th></tr>${dists.map(o => `<tr class="${o.r.d <= S.corridorKm ? 'in' : ''}"><td>${esc(o.l.short || o.l.name)}${o.r.onSpan ? '' : ' <span class="small">(nearest end)</span>'}</td><td class="n">${fmtKm(o.r.d)}</td></tr>`).join('') || '<tr><td colspan="2" class="small">No lines switched on.</td></tr>'}</table></div></div>`;
    $('#d-copy').onclick = () => copyText(`${s.lat.toFixed(6)}, ${s.lon.toFixed(6)}`);
    if ($('#d-del'))
      $('#d-del').onclick = () => {
        S.markers = S.markers.filter(m => m.id !== s.id);
        S.sel = null;
        rebuildPoints();
        closeDetail();
        changed();
      };
    setTimeout(() => {
      const e = $('#d-ug');
      if (!e || !S.sel || S.sel.id !== s.id) return;
      e.innerHTML = ugBlock(s);
      e.querySelectorAll('[data-dep]').forEach(r => {
        if (r.dataset.dep === '') return;
        r.style.cursor = 'pointer';
        r.onclick = () => {
          const k = +r.dataset.dep,
            D = depData();
          S.sel = { type: 'dep', k };
          if (!ugMask()) {
            const g = depPrim(k);
            S.under[g === 'magnetite' ? 'iron' : g] = true;
          }
          flyTo(D.lon[k], D.lat[k], Math.max(S.cam.k, kForKm(30)), 1300);
          showDeposit(k);
          req();
        };
      });
    }, 30);
  } else {
    const x = S.sel.ref,
      A = LINEBY[x.a],
      B = LINEBY[x.b];
    el.innerHTML = `<button class="back" id="d-back">← Back</button><div class="detail"><span class="small">Line crossing</span><h3>${fmtLL(x.lat, x.lon, 4)}</h3>${tag('projection')}
    <dl class="kv" style="margin-top:10px"><dt>Line A</dt><dd class="t">${esc(A ? A.name : x.a)}</dd><dt>Line B</dt><dd class="t">${esc(B ? B.name : x.b)}</dd><dt>Angle</dt><dd>${x.angle.toFixed(2)}°</dd>${x.trivial ? '<dt>Note</dt><dd class="t">Both lines start from the same anchor here, so this crossing is guaranteed by construction.</dd>' : ''}</dl>
    <h2>Sites within ±${fmtKm(Math.max(S.corridorKm, 0.1))}</h2>
    <div class="tblwrap"><table class="tbl">${
      x.near
        .slice(0, 40)
        .map(
          o => `<tr data-site="${esc(o.p.id)}"><td>${esc(o.p.n)}</td><td class="n">${fmtKm(o.d)}</td></tr>`,
        )
        .join('') || '<tr><td class="small">None. Widen the corridor to search further.</td></tr>'
    }</table></div></div>`;
    bindSiteRows('#p-detail');
  }
  $('#d-back').onclick = () => {
    S.sel = null;
    closeDetail();
    req();
  };
  $$('.pane').forEach(p => (p.hidden = p.id !== 'p-detail'));
  el.scrollTop = 0;
  if (!silent && $('#sheet').classList.contains('peek')) setSheet('half');
}
export function closeDetail() {
  if (V2.host === 'detail') {
    v2CloseHost();
    return;
  }
  selectTab(S.tab);
}
function stoneBlock(t) {
  const M = [
    'earthworks / none',
    'rough stones (unshaped)',
    'roughly shaped blocks',
    'fitted or polygonal masonry',
    'precisely cut ashlar',
  ];
  const P = ['none', 'low', 'moderate', 'high', 'very high (tight joints, sharp inside corners)'];
  return `<h2>Stonework</h2><dl class="kv"><dt>Masonry</dt><dd class="t">${M[t.masonry] || t.masonry} (${t.masonry}/4)</dd><dt>Precision</dt><dd class="t">${P[t.precision] || t.precision} (${t.precision}/4)</dd>${t.rock ? '<dt>Rock-cut</dt><dd class="t">Carved out of the living rock</dd>' : ''}${t.tons ? `<dt>Largest block</dt><dd>${nf(t.tons)} t</dd>` : ''}${t.transport ? `<dt>Hauled</dt><dd>about ${t.transport} km from the quarry</dd>` : ''}<dt>Notes</dt><dd class="t">${esc(t.note)}</dd></dl><p class="small">Scores from T. Fralse (2026), a self-published dataset; not peer-reviewed. Block weights are the author’s figures.</p>`;
}
function fortNote(s) {
  const f = s.fort,
    a = AUTO[s.id],
    parts = [];
  if (f.pts) parts.push(`<b>${f.pts} bastions documented.</b>`);
  if (f.salients != null && a && a.t)
    parts.push(
      `Traced outline: <b>${f.salients} salient points</b>${f.pts && f.pts !== f.salients ? ` (differs from the documented ${f.pts}: ravelins add points, merged corners remove them)` : ''}.`,
    );
  parts.push(esc(f.ptsNote || ''));
  return `<p class="note">${parts.join(' ')}</p>`;
}
