// Analyze screen: everything found along the active line
import { activeLine, lineDist } from '../../domain/lines.js';
import { profileCard } from '../../features/line-profile.js';
import { skyCard } from '../../features/sky-check.js';
import { v2Button, v2ButtonId, v2CorridorChips, v2Find, v2Peek } from '../panel-parts.js';
import { KINDTXT, glowColor, v2Discover } from '../../features/discovery.js';
import { findPoint } from '../../domain/points.js';
import { fmtKm, fmtLL } from '../../core/format.js';
import { UG, depData, depInfo, magWord, plateLabel } from '../../domain/underground.js';
import { esc, nf } from '../../core/util.js';
import { precisionBlock } from '../../panels/lines-pane.js';
import { V2 } from '../../state/preferences.js';
import { siteIcon } from '../../render/icons.js';
import { TYPENAME } from '../../domain/site-types.js';
import { S } from '../../state/state.js';
import { lmRankLine } from '../../features/line-match.js';
import { C } from '../../render/palette.js';

export function v2Analyze() {
  const L = activeLine();
  if (!L)
    return (
      v2Peek('No line yet') +
      `<p class="v2-sub">Draw a line between two sites and what lies along it shows up here. You can also open one of the published case-study lines.</p>` +
      `<div class="v2-actions">${v2Button('new-line', '＋ Draw a line', 'primary')}${v2Button('choose-line', 'Open a case-study line')}</div>`
    );
  const d = v2Discover(),
    sg = L.segs[0],
    ends = L.layer === 'user' && L.v2ends ? L.v2ends : null;
  const A = L.anchors[0] && findPoint(L.anchors[0]),
    B = L.anchors[1] && findPoint(L.anchors[L.style === 'primary' ? 1 : L.anchors.length - 1]); // a case study's extra anchors come after its two defining sites
  const lenTxt =
    L.segs.length > 1
      ? 'A path through several sites'
      : isFinite(sg.len)
        ? fmtKm(sg.len) + ' long'
        : 'All the way round the globe';
  const depRows = d.dep.near
    .slice(0, 12)
    .map(o => {
      const i = depInfo(o.k);
      return v2Find(
        `data-hl-dep="${o.k}" data-off="${o.d}"`,
        esc(i.n),
        `${esc(i.groups.join(', '))}${i.magnetite ? ' (magnetite)' : ''} · ${esc(i.cc)} · ${esc(i.status)}`,
        fmtKm(o.d),
      );
    })
    .join('');
  const fRows = d.fau.list
    .slice(0, 10)
    .map(h =>
      v2Find(
        `data-hl-at="${h.lat},${h.lon}" data-hl-label="${esc(h.r.name || 'Unnamed fault')}" data-hl-kind="fault" data-off="${h.d}"`,
        esc(h.r.name || 'Unnamed fault') +
          (h.d === 0
            ? '<span class="v2-badge ver">CROSSES</span>'
            : '<span class="v2-badge cor">IN CORRIDOR</span>'),
        `${esc((h.r.st || 'movement not recorded').replace(/_/g, ' '))} · ${esc(h.r.cat)}`,
        h.d === 0 ? 'on line' : fmtKm(h.d),
      ),
    )
    .join('');
  const pRows = d.pla.list
    .slice(0, 4)
    .map(h =>
      v2Find(
        `data-hl-at="${h.lat},${h.lon}" data-hl-label="${esc(plateLabel(h.r.name))} boundary" data-hl-kind="plate" data-off="${h.d}"`,
        esc(plateLabel(h.r.name)) +
          (h.d === 0
            ? '<span class="v2-badge ver">CROSSES</span>'
            : '<span class="v2-badge cor">IN CORRIDOR</span>'),
        'Plate boundary · Bird (2003)',
        h.d === 0 ? 'on line' : fmtKm(h.d),
      ),
    )
    .join('');
  const anch = L.anchors.map(findPoint).filter(Boolean);
  const anchorsRows =
    anch.length >= 2
      ? anch
          .map(s => {
            const r = lineDist(L, s.lat, s.lon);
            return `<tr><td>${esc(s.n)}</td><td class="n">${fmtKm(r.d)}${r.d > 0.0005 ? (r.xt > 0 ? ' L' : ' R') : ''}</td></tr>`;
          })
          .join('')
      : '';
  const precise =
    (L.sigma ? precisionBlock(L) : '') +
    (anchorsRows
      ? `<h2>How far each anchor is from the line</h2><div class="tblwrap"><table class="tbl"><tr><th>Anchor</th><th style="text-align:right">Off-line</th></tr>${anchorsRows}</table></div><p class="small">Anchors are not snapped to the line. L / R = left / right of the direction of travel.</p>`
      : '');
  const siteRows = d.sites
    .slice(0, V2.allSites ? 400 : 14)
    .map(m =>
      v2Find(
        `data-hl-site="${esc(m.p.id)}" data-off="${m.d}"`,
        `${siteIcon(m.p).replace('class="ic"', 'class="ic" width="16" height="16" style="vertical-align:-3px;margin-right:5px"')}${esc(m.p.n)}`,
        `${esc(TYPENAME[m.p.cat] || '')}${m.p.reg ? ' · ' + esc(m.p.reg) : ''} · ±${fmtKm((m.p.unc || 0) / 1000)} position`,
        fmtKm(m.d),
      ),
    )
    .join('');
  const forts = d.sites.filter(m => m.p.cat === 'fort').length,
    stone = d.sites.filter(m => m.p.stone || m.p.cat === 'megalith').length;
  const mg = d.mg;
  return (
    v2Peek(`${esc(KINDTXT[d.kind])} · ±${fmtKm(d.w)}`) +
    `<h2 style="margin:0 0 8px">${esc(L.short || L.name)}</h2>` +
    `<div class="v2-card tinted">
      <p class="v2-muted" style="margin:0 0 4px">${lenTxt} · heading ${sg.brg.toFixed(1)}°</p>
      <p class="v2-muted" style="margin:0">${A ? `A: ${esc(A.n)} (${fmtLL(A.lat, A.lon, 3)})` : ends ? `A: ${fmtLL(ends[0][0], ends[0][1], 3)}` : `Starts ${fmtLL(sg.o[0], sg.o[1], 3)}`}${B && B !== A ? `<br>B: ${esc(B.n)} (${fmtLL(B.lat, B.lon, 3)})` : ends ? `<br>B: ${fmtLL(ends[1][0], ends[1][1], 3)}` : ''}</p>
      <p class="v2-sub" style="margin:8px 0 4px"><span class="v2-glowkey" style="background:${glowColor(d.kind) || 'var(--line)'}"></span>${esc(KINDTXT[d.kind])}</p>
      <div class="v2-kicker" style="margin-top:8px">Look this far either side of the line</div>${v2CorridorChips()}
      <label class="v2-feature"><span class="v2-description"><strong>Only show sites inside the corridor</strong><small>Hides every other site on the map</small></span><input type="checkbox" data-corronly ${S.corridorOnly ? 'checked' : ''}></label>
      ${L.note ? `<p class="v2-muted" style="margin:6px 0 0">${esc(L.note)}</p>` : ''}
      ${lmRankLine(L)}
      ${L.layer === 'user' && L.id !== 'work' ? `<div class="v2-actions">${v2ButtonId('edit-saved', L.id, 'Edit')}${v2ButtonId('delete-saved', L.id, 'Delete', 'danger')}</div>` : ''}
      <div class="v2-actions">${v2Button('choose-line', 'Change line')}${v2Button('fly', 'Fly it in 3D')}${v2Button('follow', '▶ Follow the line')}${v2Button('tool-lab', 'Is it unusual? (test)')}</div></div>` +
    profileCard() +
    `<h3 style="margin:16px 0 4px">Geological findings</h3>` +
    `<div class="v2-card"><div class="v2-row"><h3>Mineral deposits</h3><span class="v2-label">${nf(d.dep.total)} within ±${fmtKm(d.w)}</span></div>${
      d.dep.total
        ? `<div class="ugchips" style="margin:4px 0 6px">${UG.filter(([g]) => d.dep.counts[g])
            .map(
              ([g, t]) =>
                `<span class="ugchip" style="cursor:default"><span class="ugsw" style="background:${C.dep[g]}"></span>${esc(t)} <b class="mono">${d.dep.counts[g]}</b></span>`,
            )
            .join('')}</div>${depRows}`
        : '<p class="v2-muted">No deposit records inside the corridor.</p>'
    }<div class="v2-cov">USGS deposit records (MRDS and world catalogues). Positions are map points, often ±1–2 km. ${nf(depData().nApprox)} records that sit on a shared country or county centre point are left out. About 85% of records are in the USA and Canada, so an empty result in Europe or Asia usually means missing records, not missing minerals.</div></div>` +
    `<div class="v2-card"><div class="v2-row"><h3>Active faults</h3><span class="v2-label">${d.fau.crossed} cross · ${d.fau.n - d.fau.crossed} near</span></div>${fRows || '<p class="v2-muted">No mapped active fault crosses the line or comes inside the corridor.</p>'}<div class="v2-cov"><b>Crosses</b> means the mapped fault trace and the line actually intersect. <b>In corridor</b> means the trace comes within ±${fmtKm(d.w)} without crossing. Source: GEM Global Active Faults; old, inactive faults are not mapped.</div></div>` +
    `<div class="v2-card"><div class="v2-row"><h3>Tectonic plates</h3><span class="v2-label">${d.pla.crossed} cross</span></div>${pRows || '<p class="v2-muted">The line stays inside one plate.</p>'}</div>` +
    `<div class="v2-card"><div class="v2-row"><h3>Magnetic field</h3><span class="v2-label">${mg.km ? fmtKm(mg.km) + ' sampled' : 'no data'}</span></div>${mg.max ? `${v2Find(`data-hl-at="${mg.max.lat},${mg.max.lon}" data-hl-label="Strongest magnetic signal" data-hl-kind="mag" data-off="0"`, `Strongest signal: ${mg.max.v > 0 ? '+' : ''}${Math.round(mg.max.v)} nT`, esc(magWord(mg.max.v)), fmtLL(mg.max.lat, mg.max.lon, 2))}<p class="v2-muted">${fmtKm(mg.strong)} of the line is more than 200 nT from the regional average. Sampled every ~2 km; Britain uses its detailed survey, everywhere else (sea included) the world model at about 25 km detail.</p>` : '<p class="v2-muted">No magnetic data along this line (the world model stops at 80° north and south).</p>'}</div>` +
    `<h3 style="margin:16px 0 4px">Historical findings</h3>` +
    `<div class="v2-card"><div class="v2-row"><h3>Structures along the line</h3><span class="v2-label">${nf(d.sites.length)}${forts ? ` · ${forts} forts` : ''}${stone ? ` · ${stone} stonework` : ''}</span></div>${siteRows || '<p class="v2-muted">No switched-on site inside the corridor. Widen it, or switch on more site types under Layers.</p>'}${d.sites.length > 14 ? v2Button('sites-all', V2.allSites ? 'Show fewer' : `Show all ${nf(d.sites.length)}`) : ''}<div class="v2-cov">Counts every site type switched on in Layers, not just the category picked in Explore. Line ends (A and B) are not counted.</div></div>` +
    `<h3 style="margin:16px 0 4px">Sky</h3>` +
    skyCard() +
    (precise
      ? `<details class="v2-card v2-more"><summary>How precise is this line?</summary>${precise}</details>`
      : '') +
    `<p class="v2-note">These are observations: what the maps record near the line. Being close to a fault or a mine is not evidence that the line carries energy or was planned. Use “Is it unusual?” to compare with random control lines.</p>`
  );
}
