// Sun and moon: does the line point at a solstice, equinox or lunar standstill rise or set?
//
// Checked at each end of the line, looking along it (the direction changes along a long line),
// for an era the user picks, and always shown next to the chance of matching by luck.
import { buildFlightPath, flightPosition } from '../core/flight.js';
import { GEO } from '../core/geo.js';
import { ERAS, chanceOfMatch, lineMatches, skyEvents } from '../core/sky.js';
import { esc } from '../core/util.js';
import { activeLine } from '../domain/lines.js';
import { findPoint } from '../domain/points.js';
import { VIEW, ctx } from '../map/canvas.js';
import { req } from '../map/draw.js';
import { addDrawLayer } from '../map/hooks.js';
import { V2, v2Persist } from '../state/preferences.js';
import { v2Button, v2ButtonId } from '../ui/panel-parts.js';
import { v2Render } from '../ui/panels.js';
import { registerAction } from '../ui/registry.js';

const TOLS = [0.5, 1, 2];
const COLOR = { sun: '#e3a21a', moon: '#7d9fd1' };
const pct = p => (p < 0.01 ? '<1' : Math.round(p * 100)) + '%';

/** The places to look from: A looking towards B, and B looking back towards A. */
function viewpoints(L) {
  const path = buildFlightPath(L.segs);
  const a = flightPosition(path, 0);
  const nameOf = id => (id && findPoint(id)?.n) || null;
  const out = [
    { end: 'A', other: 'B', name: nameOf(L.anchors[0]), lat: a.lat, lon: a.lon, bearing: a.bearing },
  ];
  if (isFinite(L.segs.at(-1).len)) {
    const b = flightPosition(path, path.length);
    out.push({
      end: 'B',
      other: 'A',
      name: nameOf(L.anchors.at(-1)),
      lat: b.lat,
      lon: b.lon,
      bearing: (b.bearing + 180) % 360,
    });
  }
  return out;
}

function endBlock(v, year, tol) {
  const events = skyEvents(v.lat, year);
  const hits = lineMatches(v.bearing, events, tol);
  const nearest = lineMatches(v.bearing, events, 180)[0];
  const luck = chanceOfMatch(events, tol);
  const other = v.other || 'the line';
  const head = `<b>${v.end}${v.name ? ': ' + esc(v.name) : ''}</b> · towards ${other} ${v.bearing.toFixed(1)}°, away from ${other} ${((v.bearing + 180) % 360).toFixed(1)}°`;
  const body = hits.length
    ? hits
        .map(
          h =>
            `<div class="sky-hit ${h.body}"><span class="sky-dot"></span><span><strong>${esc(h.label)}</strong><small>${h.az.toFixed(1)}° · ${h.off.toFixed(2)}° off · looking ${h.back ? 'away from' : 'towards'} ${other}</small></span></div>`,
        )
        .join('')
    : `<p class="v2-muted" style="margin:4px 0">Nothing within ±${tol}°. Closest: ${esc(nearest.label)}, ${nearest.off.toFixed(1)}° off.</p>`;
  return {
    html: `<div class="sky-end"><p class="v2-sub" style="margin:0 0 4px">${head}</p>${body}</div>`,
    luck,
    hit: hits.length > 0,
  };
}

/** The "Sun and moon" card for the Analyze screen. */
export function skyCard() {
  const L = activeLine();
  if (!L) return '';
  const year = V2.skyYear,
    tol = V2.skyTol;
  const ends = viewpoints(L).map(v => endBlock(v, year, tol));
  const luck = 1 - ends.reduce((p, e) => p * (1 - e.luck), 1);
  const anyHit = ends.some(e => e.hit);
  return (
    `<div class="v2-card"><div class="v2-row"><h3>Sun and moon</h3><span class="v2-label">${anyHit ? 'points at one' : 'no match'}</span></div>` +
    `<p class="v2-muted" style="margin:0 0 6px">Does the line point at where the sun or moon rises or sets on the key days of the year? Checked from each end, looking along the line.</p>` +
    `<div class="v2-kicker">In the year</div><div class="v2-actions sky-chips">${ERAS.map(([y, t]) => v2ButtonId('sky-era', y, t, y === year ? 'primary' : '')).join('')}</div>` +
    `<div class="v2-kicker">Count it as a match within</div><div class="v2-actions sky-chips">${TOLS.map(t => v2ButtonId('sky-tol', t, `±${t}°`, t === tol ? 'primary' : '')).join('')}</div>` +
    ends.map(e => e.html).join('') +
    `<p class="v2-note" style="margin:8px 0 0"><b>Luck check:</b> there are up to 14 such directions at each end, so a line drawn in a random direction matches at least one of them within ±${tol}° about <b>${pct(luck)}</b> of the time. A match is only interesting if it is much closer than that, or was planned for.</p>` +
    `<p class="v2-muted" style="margin:6px 0 0">Assumes a flat horizon; hills move a sunrise point by about 1–2° for each degree of horizon height. Lunar standstills repeat every 18.6 years.</p>` +
    `<div class="v2-actions">${v2Button('sky-rays', V2.skyRays ? 'Hide directions on the map' : 'Show directions on the map', V2.skyRays ? '' : 'primary')}</div>` +
    `</div>`
  );
}

// rays on the map from each end of the line
function drawSkyRays(P) {
  if (!V2.skyRays) return;
  const L = activeLine();
  if (!L) return;
  const px = Math.min(260, Math.max(90, Math.min(innerWidth, innerHeight) * 0.28)),
    km = px / VIEW.ppk;
  ctx.save();
  ctx.lineCap = 'round';
  for (const v of viewpoints(L)) {
    const events = skyEvents(v.lat, V2.skyYear),
      hits = new Set(lineMatches(v.bearing, events, V2.skyTol).map(h => h.id));
    const o = P([v.lon, v.lat]);
    if (!o) continue;
    for (const ev of events) {
      const [la, lo] = GEO.dest(v.lat, v.lon, ev.az, km),
        t = P([lo, la]);
      if (!t) continue;
      const hit = hits.has(ev.id);
      ctx.globalAlpha = hit ? 1 : 0.75;
      ctx.strokeStyle = COLOR[ev.body];
      ctx.lineWidth = hit ? 3.5 : 1.6;
      ctx.setLineDash(ev.id.endsWith('-set') ? [6, 4] : []);
      ctx.beginPath();
      ctx.moveTo(o[0], o[1]);
      ctx.lineTo(t[0], t[1]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = COLOR[ev.body];
      ctx.beginPath();
      ctx.arc(t[0], t[1], hit ? 5 : 3.5, 0, 7);
      ctx.fill();
    }
  }
  ctx.restore();
}

export function initSkyCheck() {
  addDrawLayer('top', drawSkyRays);
  const refresh = () => {
    v2Persist();
    v2Render();
    req();
  };
  registerAction('sky-era', id => {
    V2.skyYear = +id;
    refresh();
  });
  registerAction('sky-tol', id => {
    V2.skyTol = +id;
    refresh();
  });
  registerAction('sky-rays', () => {
    V2.skyRays = !V2.skyRays;
    refresh();
  });
}
