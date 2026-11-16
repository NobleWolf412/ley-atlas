// "Along the line": a strip diagram of the active line from A to B
//
//   ground height  (open terrain tiles, the same ones the 3D flight uses; needs a connection)
//   magnetic field (the app's own grids)
//   fault and plate crossings, mineral deposits and sites, each placed by distance along the line
//
// It is not a geological section: nothing here says what lies below the surface.
import { buildFlightPath, flightPosition } from '../core/flight.js';
import { fmtKm } from '../core/format.js';
import { esc, nf } from '../core/util.js';
import { activeLine } from '../domain/lines.js';
import { magAt } from '../domain/underground.js';
import { findingsAlong, v2LineKey } from './discovery.js';

const SAMPLES = 240;
const TERRAIN = (z, x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
const MAX_TILES = 16;

// ---------- ground height ----------
const tileCache = new Map(); // "z/x/y" -> Promise<ImageData | null>
const heightCache = new Map(); // line key -> Float32Array | 'failed'

function tileXY(lat, lon, z) {
  const n = 2 ** z,
    x = ((lon + 180) / 360) * n,
    s = Math.sin((Math.max(-85, Math.min(85, lat)) * Math.PI) / 180),
    y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n;
  return [x, y];
}

function loadTile(z, x, y) {
  const key = `${z}/${x}/${y}`;
  if (!tileCache.has(key))
    tileCache.set(
      key,
      fetch(TERRAIN(z, x, y))
        .then(r => (r.ok ? r.blob() : Promise.reject(new Error(r.status))))
        .then(createImageBitmap)
        .then(bmp => {
          const c = document.createElement('canvas');
          c.width = bmp.width;
          c.height = bmp.height;
          const g = c.getContext('2d', { willReadFrequently: true });
          g.drawImage(bmp, 0, 0);
          return g.getImageData(0, 0, c.width, c.height);
        })
        .catch(() => null),
    );
  return tileCache.get(key);
}

/** Heights (m) at the sample points, from the coarsest zoom that keeps the download small. */
async function loadHeights(points) {
  let z = 10,
    tiles;
  for (; z >= 2; z--) {
    tiles = new Set(points.map(p => tileXY(p.lat, p.lon, z).map(Math.floor).join('/')));
    if (tiles.size <= MAX_TILES) break;
  }
  const imgs = new Map();
  await Promise.all(
    [...tiles].map(async t => {
      const [x, y] = t.split('/').map(Number);
      imgs.set(t, await loadTile(z, x, y));
    }),
  );
  if ([...imgs.values()].every(v => !v)) throw new Error('no terrain tiles');
  return Float32Array.from(points, p => {
    const [fx, fy] = tileXY(p.lat, p.lon, z),
      img = imgs.get(`${Math.floor(fx)}/${Math.floor(fy)}`);
    if (!img) return NaN;
    const px = Math.min(255, Math.floor((fx % 1) * 256)),
      py = Math.min(255, Math.floor((fy % 1) * 256)),
      o = (py * 256 + px) * 4,
      d = img.data;
    return d[o] * 256 + d[o + 1] + d[o + 2] / 256 - 32768; // Terrarium encoding
  });
}

// ---------- the diagram ----------
const VW = 600,
  X0 = 74,
  X1 = 588,
  ROWS = { hTop: 14, hBot: 92, mag: 102, magH: 14, fault: 132, dep: 150, site: 168, axis: 190 },
  VH = 200;

function magColour(v) {
  if (v == null) return 'none';
  const t = Math.max(-1, Math.min(1, v / 400)),
    a = Math.abs(t);
  const w = Math.round(255 * (1 - a * 0.8));
  return t > 0 ? `rgb(230,${w},${w})` : `rgb(${w},${w},230)`;
}

function svg(prof, heights) {
  const { length, points, stops } = prof;
  const x = km => X0 + ((X1 - X0) * km) / (length || 1);
  const parts = [];
  // row labels
  const label = (y, t) => `<text x="${X0 - 8}" y="${y}" text-anchor="end" class="pl-lab">${t}</text>`;
  parts.push(
    label((ROWS.hTop + ROWS.hBot) / 2 + 4, 'Ground'),
    label(ROWS.mag + 11, 'Magnetic'),
    label(ROWS.fault + 4, 'Faults'),
    label(ROWS.dep + 4, 'Deposits'),
    label(ROWS.site + 4, 'Sites'),
  );
  // ground height
  if (heights && heights !== 'loading' && heights !== 'failed') {
    const land = [...heights].map(h => (Number.isFinite(h) ? Math.max(0, h) : 0));
    const top = Math.max(50, ...land);
    const y = h => ROWS.hBot - ((ROWS.hBot - ROWS.hTop) * h) / top;
    let area = `M${x(0)},${ROWS.hBot}`;
    points.forEach((p, i) => (area += `L${x(p.km).toFixed(1)},${y(land[i]).toFixed(1)}`));
    area += `L${x(length)},${ROWS.hBot}Z`;
    // sea: stretches below sea level, drawn as water
    let sea = '';
    points.forEach((p, i) => {
      if (heights[i] < 0) {
        const w = (X1 - X0) / points.length + 0.6;
        sea += `<rect x="${(x(p.km) - w / 2).toFixed(1)}" y="${ROWS.hBot - 5}" width="${w.toFixed(1)}" height="5" class="pl-sea"/>`;
      }
    });
    const hi = land.indexOf(Math.max(...land));
    parts.push(
      `<path d="${area}" class="pl-land"/>`,
      sea,
      `<text x="${X1}" y="${ROWS.hTop - 3}" text-anchor="end" class="pl-small">highest ${nf(Math.round(top))} m (heights stretched)</text>`,
      `<circle cx="${x(points[hi].km)}" cy="${y(land[hi])}" r="2.5" class="pl-peak"/>`,
    );
  } else {
    parts.push(
      `<rect x="${X0}" y="${ROWS.hTop}" width="${X1 - X0}" height="${ROWS.hBot - ROWS.hTop}" class="pl-wait"/>`,
      `<text x="${(X0 + X1) / 2}" y="${(ROWS.hTop + ROWS.hBot) / 2 + 4}" text-anchor="middle" class="pl-small">${
        heights === 'failed' ? 'Ground heights need a connection' : 'Loading ground heights…'
      }</text>`,
    );
  }
  parts.push(`<line x1="${X0}" x2="${X1}" y1="${ROWS.hBot}" y2="${ROWS.hBot}" class="pl-base"/>`);
  // magnetic strip
  const w = (X1 - X0) / points.length + 0.6;
  points.forEach(p => {
    const c = magColour(p.mag);
    if (c !== 'none')
      parts.push(
        `<rect x="${(x(p.km) - w / 2).toFixed(1)}" y="${ROWS.mag}" width="${w.toFixed(1)}" height="${ROWS.magH}" fill="${c}"/>`,
      );
  });
  parts.push(`<rect x="${X0}" y="${ROWS.mag}" width="${X1 - X0}" height="${ROWS.magH}" class="pl-frame"/>`);
  // findings, each one tappable (highlights it on the map)
  for (const s of stops) {
    const it = s.item,
      cx = x(s.km).toFixed(1),
      title = `<title>${esc(it.name)} · ${fmtKm(s.km)} from A</title>`;
    if (it.kind === 'fault' || it.kind === 'plate')
      parts.push(
        `<g class="pl-hit" data-hl-at="${it.lat},${it.lon}" data-hl-label="${esc(it.name)}" data-hl-kind="${it.kind}" data-off="0">${title}<line x1="${cx}" x2="${cx}" y1="${ROWS.hTop}" y2="${ROWS.fault + 6}" class="pl-${it.kind}"/><rect x="${cx - 5}" y="${ROWS.fault - 7}" width="10" height="14" fill="transparent"/></g>`,
      );
    else if (it.kind === 'deposit')
      parts.push(
        `<g class="pl-hit" data-hl-dep="${it.k}" data-off="${it.d}">${title}<rect x="${cx - 3}" y="${ROWS.dep - 3}" width="6" height="6" transform="rotate(45 ${cx} ${ROWS.dep})" class="pl-dep"/></g>`,
      );
    else if (it.kind === 'site')
      parts.push(
        `<g class="pl-hit" data-hl-site="${esc(it.p.id)}" data-off="${it.d}">${title}<circle cx="${cx}" cy="${ROWS.site}" r="${it.anchor ? 4.5 : 3}" class="pl-site${it.anchor ? ' anchor' : ''}"/></g>`,
      );
  }
  // axis
  parts.push(
    `<line x1="${X0}" x2="${X1}" y1="${ROWS.axis - 10}" y2="${ROWS.axis - 10}" class="pl-base"/>`,
    `<text x="${X0}" y="${ROWS.axis + 4}" class="pl-small">A</text>`,
    `<text x="${(X0 + X1) / 2}" y="${ROWS.axis + 4}" text-anchor="middle" class="pl-small">${fmtKm(length / 2)}</text>`,
    `<text x="${X1}" y="${ROWS.axis + 4}" text-anchor="end" class="pl-small">${prof.closed ? 'back to A' : 'B'} · ${fmtKm(length)}</text>`,
  );
  return `<svg class="pl" viewBox="0 0 ${VW} ${VH}" role="img" aria-label="Diagram of what lies along the line">${parts.join('')}</svg>`;
}

// ---------- data for the active line ----------
let PROF = null; // { key, length, points, stops, closed }

function profileOf(L) {
  const key = v2LineKey(L) + '|' + L.segs.length;
  if (PROF && PROF.key === key) return PROF;
  const path = buildFlightPath(L.segs);
  const points = [];
  for (let i = 0; i < SAMPLES; i++) {
    const km = (path.length * (i + 0.5)) / SAMPLES,
      p = flightPosition(path, km);
    points.push({ km, lat: p.lat, lon: p.lon, mag: magAt(p.lat, p.lon) });
  }
  const { stops } = findingsAlong(L, path);
  return (PROF = { key, length: path.length, points, stops, closed: !isFinite(L.segs[0].len) });
}

/** The diagram for the active line, as HTML. Ground heights fill in when they arrive. */
export function profileCard() {
  const L = activeLine();
  if (!L) return '';
  const prof = profileOf(L);
  const hk = prof.key;
  let heights = heightCache.get(hk);
  if (!heights) {
    heightCache.set(hk, 'loading');
    heights = 'loading';
    loadHeights(prof.points)
      .then(h => heightCache.set(hk, h))
      .catch(() => heightCache.set(hk, 'failed'))
      .finally(() => {
        const el = document.getElementById('v2profile');
        if (el && el.dataset.key === hk) el.innerHTML = svg(prof, heightCache.get(hk));
      });
  }
  return (
    `<div class="v2-card"><div class="v2-row"><h3>Along the line</h3><span class="v2-label">A → ${prof.closed ? 'round the globe' : 'B'}</span></div>` +
    `<div id="v2profile" data-key="${esc(hk)}">${svg(prof, heights)}</div>` +
    `<p class="v2-muted" style="margin:6px 0 0"><span class="pl-key fault"></span>fault crossing <span class="pl-key plate"></span>plate boundary <span class="pl-key dep"></span>deposit <span class="pl-key site"></span>site · magnetic: <span class="magkey"></span>weaker to stronger. Tap a mark to find it on the map.</p>` +
    `<p class="v2-muted" style="margin:6px 0 0">A strip map of the surface, not a dig: it shows what the maps record along the line, not what lies underneath. Ground heights from the open Terrain Tiles (Mapzen, AWS).</p>` +
    `</div>`
  );
}
