// Draw screen: pick point A and B (or draw freehand), name and save the line
import { v2Ends, v2SyncPick } from '../../features/create-lines.js';
import { V2 } from '../../state/preferences.js';
import { S } from '../../state/state.js';
import { glowColor, v2DiscFor, v2Summary } from '../../features/discovery.js';
import { activeLine } from '../../domain/lines.js';
import { v2Button, v2Peek, v2PointBtn } from '../panel-parts.js';
import { esc } from '../../core/util.js';
import { fmtKm, fmtLL } from '../../core/format.js';
import { GEO } from '../../core/geo.js';
import { LM } from '../../features/line-match.js';
import { findPoint } from '../../domain/points.js';

export function v2Draw() {
  v2SyncPick();
  const w = V2.picking ? null : S.work,
    ends = w ? v2Ends(w) : null,
    global = w && w.len == null;
  const d = w ? v2DiscFor(activeLine()) : null;
  if (S.mode === 'draw')
    return (
      v2Peek(V2.drawPoints.length ? 'Tap the second spot on the map' : 'Tap the first spot on the map') +
      `<div class="v2-guide"><strong>${V2.drawPoints.length ? 'First spot placed' : 'Drawing freehand'}</strong><p class="v2-sub" style="margin:5px 0 0">${V2.drawPoints.length ? 'Tap a second spot on the map.' : 'Tap any two spots on the map.'}</p>${v2Button('cancel-draw', 'Cancel')}</div>`
    );
  if (w)
    return (
      v2Peek(esc(v2Summary(d))) +
      `<div class="v2-card tinted"><h3 style="margin:0 0 4px">${esc(w.name || 'Your line')}</h3>
      <p class="v2-muted" style="margin:0">${global ? 'All the way round the globe' : fmtKm(GEO.dist(...ends[0], ...ends[1]))} · heading ${(w.brg || 0).toFixed(0)}°</p>
      <p class="v2-sum"><span class="v2-glowkey" style="background:${(d && glowColor(d.kind)) || 'var(--line)'}"></span>${esc(v2Summary(d))}</p>
      <div class="v2-actions">${v2Button('analyze', 'See what’s along it', 'primary')}${v2Button('follow', '▶ Follow it')}${v2Button('share', 'Share')}</div></div>` +
      `<div class="v2-card"><label class="v2-field" style="margin-top:0">Name<input id="v2name" type="text" maxlength="100" value="${esc(w.name || 'Untitled line')}"></label>
      <div class="v2-actions">${v2Button('save-work', V2.editId ? 'Save changes' : 'Save line', 'primary')}${v2Button('new-line', '＋ New line')}${v2Button('discard', 'Remove', 'danger')}</div>
      <details class="v2-more"><summary>More options</summary><label class="v2-feature"><span class="v2-description"><strong>Extend around the globe</strong><small>Draw the full circle, not just between the two points</small></span><input type="checkbox" id="v2global" ${global ? 'checked' : ''}></label><p class="v2-muted v2-mono" style="margin:6px 0 0">A ${fmtLL(ends[0][0], ends[0][1], 4)}<br>B ${fmtLL(ends[1][0], ends[1][1], 4)}</p></details></div>`
    );
  const guide =
    V2.pick.a && !V2.pick.b && LM && LM.A.id === V2.pick.a
      ? `<div class="v2-card soft lm-guide"><strong>Not sure where to go?</strong><p class="v2-sub" style="margin:4px 0 8px">Gold wedges on the map are directions from ${esc(findPoint(V2.pick.a)?.n || 'A')} where more minerals, faults, magnetic rock or sites line up than usual. Ringed sites are the best matches. A guide, not proof.</p>${v2Button('pick-best', 'See best matches', 'primary')}</div>`
      : '';
  return (
    v2Peek(V2.pick.a ? 'Now choose where the line goes' : 'Choose two sites') +
    `<p class="v2-sub" style="margin:0 0 10px">Pick two sites. The line appears on the map with what lies along it.</p>` +
    guide +
    `<div class="v2-card">${v2PointBtn('a', V2.pick.a)}<div class="v2-swap">${v2Button('swap', '⇅ Swap', 'ghost')}</div>${v2PointBtn('b', V2.pick.b)}</div>` +
    `<details class="v2-more v2-card soft"><summary>Other ways to draw</summary><div class="v2-actions">${v2Button('draw-start', '✎ Tap two spots on the map')}</div>
      <div class="v2-divide"></div><div class="v2-kicker">From a site at a set heading</div>${v2PointBtn('from', V2.bear.from)}
      <div class="v2-bear"><label class="v2-field">Heading (° from north)<input id="v2brg" type="number" step="0.01" min="0" max="360" inputmode="decimal" value="${esc(V2.bear.brg)}"></label><label class="v2-field">Length<select id="v2blen">${[
        ['100', '100 km'],
        ['1000', '1,000 km'],
        ['5000', '5,000 km'],
        ['g', 'Around the globe'],
      ]
        .map(([v, t]) => `<option value="${v}" ${V2.bear.len === v ? 'selected' : ''}>${t}</option>`)
        .join('')}</select></label></div>
      <div class="v2-actions">${v2Button('bearing-go', 'Draw it', V2.bear.from ? 'primary' : '')}</div></details>`
  );
}
