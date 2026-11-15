// Record pages for a mineral deposit or a fault, and the "what is under this site" block
import { UGNAME, depInfo, magSrc, magWord, plateLabel, undergroundAt } from '../domain/underground.js';
import { C } from '../render/palette.js';
import { $, $$, esc } from '../core/util.js';
import { fmtKm, satUrl } from '../core/format.js';
import { enabledPoints } from '../domain/points.js';
import { GEO } from '../core/geo.js';
import { S } from '../state/state.js';
import { closeDetail } from './detail.js';
import { req } from '../map/draw.js';
import { copyText } from './data-pane.js';
import { bindSiteRows } from './lines-pane.js';
import { setSheet } from '../ui/sheet.js';

export function ugBlock(s) {
  const u = undergroundAt(s.lat, s.lon);
  const rows = u.groups
    .map(
      ({ g, near, d }) =>
        `<tr data-dep="${near ? near.k : ''}"><td><span class="ugsw" style="background:${C.dep[g]}"></span>${esc(UGNAME[g])}</td><td>${near ? esc(near.n) + `<div class="small">${esc(near.status)}${near.magnetite ? ' · magnetite' : ''}</div>` : '<span class="small">none within 300 km in the data</span>'}</td><td class="n">${d != null ? fmtKm(d) : '—'}</td></tr>`,
    )
    .join('');
  const thin = u.n100 < 5;
  return `<h2>What’s underground nearby</h2>
  <p class="small" style="margin:-2px 0 8px">Nearest recorded deposit of each kind. Distances are to the deposit’s map point, not to the ore body itself.</p>
  <div class="tblwrap"><table class="tbl"><tr><th>Kind</th><th>Nearest recorded</th><th style="text-align:right">Distance</th></tr>${rows}</table></div>
  <div class="statgrid"><div><span>Within 10 km</span><b>${u.n10}</b></div><div><span>Within 50 km</span><b>${u.n50}</b></div><div><span>Within 100 km</span><b>${u.n100}</b></div></div>
  ${thin ? `<p class="note warn">Very few deposits are recorded around here. That can mean poor data coverage for this country, not empty ground: the deposit lists are most complete for the USA and Canada.</p>` : ''}
  <dl class="kv" style="margin-top:10px">
    <dt>Active fault</dt><dd class="t">${u.fault ? `${fmtKm(u.fault.d)} · ${esc(u.fault.r.name || 'unnamed')}${u.fault.r.st ? ' (' + esc(u.fault.r.st.replace(/_/g, ' ').toLowerCase()) + ')' : ''}` : 'none mapped within ~300 km'}</dd>
    <dt>Plate boundary</dt><dd class="t">${u.plate ? `${fmtKm(u.plate.d)} · ${esc(plateLabel(u.plate.r.name))}` : '—'}</dd>
    ${u.mag != null ? `<dt>Magnetic field</dt><dd class="t">${u.mag > 0 ? '+' : ''}${Math.round(u.mag)} nT vs the regional average: ${magWord(u.mag)}. ${magSrc(s.lat, s.lon) === 'uk' ? 'From the Britain survey (2 km detail). Most of Britain lies between −170 and +300 nT.' : 'From the world magnetic model (about 25 km detail, so it shows the regional rock, not one building).'}</dd>` : ''}
  </dl>`;
}
export function showDeposit(k) {
  const d = depInfo(k),
    el = $('#p-detail');
  const nearSites = enabledPoints()
    .map(p => ({ p, d: GEO.dist(d.lat, d.lon, p.lat, p.lon) }))
    .filter(o => o.d < 25)
    .sort((a, b) => a.d - b.d)
    .slice(0, 8);
  el.innerHTML = `<button class="back" id="d-back">← Back</button><div class="detail"><div class="row"><span class="ugsw lg" style="background:${C.dep[d.prim === 'magnetite' ? 'iron' : d.prim]}"></span><span class="small">Mineral deposit · ${esc(d.cc)}</span></div>
  <h3>${esc(d.n)}</h3>
  <dl class="kv" style="margin-top:10px"><dt>Minerals</dt><dd class="t">${esc(d.groups.join(', '))}${d.magnetite ? ' (magnetite recorded)' : ''}</dd><dt>Status</dt><dd class="t">${esc(d.status)}</dd>${d.type ? `<dt>Deposit type</dt><dd class="t">${esc(d.type)}</dd>` : ''}<dt>Position</dt><dd>${d.lat.toFixed(4)}, ${d.lon.toFixed(4)}</dd><dt>Source</dt><dd class="t">${esc(d.src)}</dd></dl>
  <div class="wrap" style="margin:12px 0"><a class="btn" href="${satUrl(d.lat, d.lon, 15)}" target="_blank" rel="noopener">Google Maps ↗</a><button class="btn ghost" id="d-copy">Copy coords</button></div>
  <h2>Sites within 25 km</h2>${nearSites.length ? `<div class="tblwrap"><table class="tbl">${nearSites.map(o => `<tr data-site="${esc(o.p.id)}"><td>${esc(o.p.n)}</td><td class="n">${fmtKm(o.d)}</td></tr>`).join('')}</table></div>` : '<p class="empty">No switched-on sites within 25 km.</p>'}</div>`;
  $('#d-back').onclick = () => {
    S.sel = null;
    closeDetail();
    req();
  };
  $('#d-copy').onclick = () => copyText(`${d.lat.toFixed(5)}, ${d.lon.toFixed(5)}`);
  bindSiteRows('#p-detail');
  $$('.pane').forEach(p => (p.hidden = p.id !== 'p-detail'));
  el.scrollTop = 0;
  if ($('#sheet').classList.contains('peek')) setSheet('half');
}
export function showFault(r) {
  const el = $('#p-detail');
  el.innerHTML = `<button class="back" id="d-back">← Back</button><div class="detail"><span class="small">Active fault</span><h3>${esc(r.name || 'Unnamed fault')}</h3><dl class="kv" style="margin-top:10px"><dt>Movement</dt><dd class="t">${esc((r.st || 'not recorded').replace(/_/g, ' '))}</dd><dt>Catalogue</dt><dd class="t">${esc(r.cat)}</dd><dt>Source</dt><dd class="t">GEM Global Active Faults Database (CC BY-SA 4.0)</dd></dl><p class="note">“Active” means it has moved in the recent geological past and can produce earthquakes. Old, inactive faults are not in this map.</p></div>`;
  $('#d-back').onclick = () => {
    closeDetail();
    req();
  };
  $$('.pane').forEach(p => (p.hidden = p.id !== 'p-detail'));
  el.scrollTop = 0;
  if ($('#sheet').classList.contains('peek')) setSheet('half');
}
