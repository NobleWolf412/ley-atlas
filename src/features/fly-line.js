// Fly the line: a full-screen 3D flight along the active line, over satellite imagery and real terrain
import { findingsAlong } from './discovery.js';
//
// The 3D engine (MapLibre GL) is only downloaded the first time someone flies.
// Tiles: Esri World Imagery (satellite) and the open Terrain Tiles on AWS (elevation). No key needed.
import {
  buildFlightPath,
  flightCoords,
  flightPosition,
  flightSeconds,
  flightZoom,
  stopsNear,
  turn,
} from '../core/flight.js';
import { fmtKm } from '../core/format.js';
import { esc, nf } from '../core/util.js';
import { activeLine } from '../domain/lines.js';
import { siteIcon } from '../render/icons.js';
import { S } from '../state/state.js';
import { v2HandleAction } from '../ui/actions.js';
import { registerAction } from '../ui/registry.js';

const SATELLITE =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const TERRAIN = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const PITCH = 66;
const SPEEDS = [1, 2, 4, 0.5];
const MAX_SITE_PINS = 80;
const COLORS = { line: '#ffd166', deposit: '#f2a93b', fault: '#ff5a4d', plate: '#c77dff' };

let F = null; // the open flight, or null

// ---------- the screen ----------
function buildScreen(L) {
  const el = document.createElement('div');
  el.id = 'fly';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', `Flying along ${L.name}`);
  el.innerHTML = `
    <div id="fly-map"></div>
    <div class="fly-top">
      <div class="fly-title"><b>${esc(L.name)}</b><span id="fly-progress"></span><span class="fly-note">What lies within ±${fmtKm(S.corridorKm)} · a guide, not proof</span></div>
      <button class="fly-btn" id="fly-close" aria-label="Close the 3D flight">✕</button>
    </div>
    <div class="fly-status" id="fly-status" role="status">Loading the 3D view…</div>
    <div class="fly-passing" id="fly-passing" aria-live="polite"></div>
    <div class="fly-end" id="fly-end" hidden></div>
    <div class="fly-bar">
      <button class="fly-btn" id="fly-play" aria-label="Pause">❚❚</button>
      <input type="range" id="fly-scrub" min="0" max="1000" value="0" aria-label="Position along the line">
      <button class="fly-btn fly-speed" id="fly-speed" aria-label="Flight speed">1×</button>
    </div>
    <div class="fly-credit">Imagery © Esri, Maxar, Earthstar Geographics · Terrain: Mapzen, AWS Open Data</div>`;
  document.body.appendChild(el);
  return el;
}

function pinElement(stop) {
  const el = document.createElement('div');
  el.className = 'fly-pin' + (stop.item.anchor ? ' anchor' : '');
  el.innerHTML = `${siteIcon(stop.item.p)}<span>${esc(stop.item.name)}</span>`;
  return el;
}

function addLineAndFindings(gl, map, coords, stops) {
  map.addSource('fly-line', {
    type: 'geojson',
    data: { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } },
  });
  map.addLayer({
    id: 'fly-line-glow',
    type: 'line',
    source: 'fly-line',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': COLORS.line, 'line-width': 14, 'line-opacity': 0.22, 'line-blur': 6 },
  });
  map.addLayer({
    id: 'fly-line',
    type: 'line',
    source: 'fly-line',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': COLORS.line, 'line-width': 3.5 },
  });
  for (const kind of ['deposit', 'fault', 'plate']) {
    const features = stops
      .filter(s => s.item.kind === kind)
      .map(s => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [s.item.lon, s.item.lat] },
        properties: {},
      }));
    if (!features.length) continue;
    map.addSource('fly-' + kind, { type: 'geojson', data: { type: 'FeatureCollection', features } });
    map.addLayer({
      id: 'fly-' + kind,
      type: 'circle',
      source: 'fly-' + kind,
      paint: {
        'circle-radius': kind === 'deposit' ? 5 : 8,
        'circle-color': COLORS[kind],
        'circle-stroke-color': '#10141a',
        'circle-stroke-width': 1.5,
        'circle-opacity': 0.92,
      },
    });
  }
  // sites: HTML pins (no font files needed), nearest to the line first
  const sites = stops.filter(s => s.item.kind === 'site');
  const chosen = [...sites]
    .sort((a, b) => (b.item.anchor ? 1 : 0) - (a.item.anchor ? 1 : 0) || Math.abs(a.off) - Math.abs(b.off))
    .slice(0, MAX_SITE_PINS);
  for (const s of chosen) {
    s.pin = pinElement(s);
    new gl.Marker({ element: s.pin, anchor: 'bottom' }).setLngLat([s.item.lon, s.item.lat]).addTo(map);
  }
}

// ---------- flying ----------
function apply() {
  const pos = flightPosition(F.path, F.km);
  F.bearing = F.bearing == null ? pos.bearing : F.bearing + turn(F.bearing, pos.bearing) * 0.15;
  // the point being passed sits in the lower part of the screen, leaving the view ahead open
  F.map.jumpTo({
    center: [pos.lon, pos.lat],
    bearing: F.bearing,
    pitch: PITCH,
    zoom: F.zoom,
    padding: { top: F.el.clientHeight * 0.3, bottom: 0, left: 0, right: 0 },
  });
  updateHud(pos);
}

function updateHud(pos) {
  const $ = id => F.el.querySelector(id);
  const ground = F.map.queryTerrainElevation([pos.lon, pos.lat]);
  $('#fly-progress').textContent =
    `${fmtKm(F.km)} of ${fmtKm(F.path.length)}` +
    (ground != null ? ` · ground ${nf(Math.round(ground / (F.exaggeration || 1)))} m` : '');
  if (!F.scrubbing) $('#fly-scrub').value = Math.round((F.km / F.path.length) * 1000);
  const near = stopsNear(F.stops, F.km, F.window);
  for (const s of F.stops) if (s.pin) s.pin.classList.toggle('near', near.includes(s));
  const key = near
    .slice(0, 3)
    .map(s => F.stops.indexOf(s))
    .join();
  if (key === F.passingKey) return;
  F.passingKey = key;
  $('#fly-passing').innerHTML = near
    .slice(0, 3)
    .map(
      s =>
        `<div class="fly-stop ${s.item.kind}"><i></i><div><b>${esc(s.item.name)}</b><span>${esc(s.item.sub)}${
          Math.abs(s.off) >= 0.05 ? ` · ${fmtKm(Math.abs(s.off))} to the ${s.off > 0 ? 'left' : 'right'}` : ''
        }</span></div></div>`,
    )
    .join('');
}

function setPlaying(on) {
  F.playing = on;
  F.last = performance.now();
  const b = F.el.querySelector('#fly-play');
  b.textContent = on ? '❚❚' : '▶';
  b.setAttribute('aria-label', on ? 'Pause' : 'Play');
  if (on) F.el.querySelector('#fly-end').hidden = true;
}

function tick(now) {
  if (!F) return;
  F.raf = requestAnimationFrame(tick);
  if (!F.playing) return;
  const dt = Math.min(0.1, (now - F.last) / 1000);
  F.last = now;
  F.km = Math.min(F.path.length, F.km + F.kmPerSecond * SPEEDS[F.speed] * dt);
  apply();
  if (F.km >= F.path.length) finish();
}

// The flight ends on the honest question, not on a flourish.
function finish() {
  setPlaying(false);
  const counts = { site: 0, deposit: 0, fault: 0, plate: 0 };
  for (const s of F.stops) counts[s.item.kind]++;
  const end = F.el.querySelector('#fly-end');
  end.innerHTML = `
    <h2>End of the line</h2>
    <p class="fly-sum">${esc(F.summary)}</p>
    <p>That is what lies within ±${fmtKm(S.corridorKm)} of it. A line this long through country this busy will always pass things, so the count alone proves nothing. The test compares this line with hundreds of others like it.</p>
    <div class="fly-actions">
      <button class="fly-cta" data-fly="test">Compare with chance</button>
      <button class="fly-ghost" data-fly="again">Fly again</button>
      <button class="fly-ghost" data-fly="close">Close</button>
    </div>`;
  end.hidden = false;
}

function close() {
  if (!F) return;
  cancelAnimationFrame(F.raf);
  removeEventListener('keydown', F.onKey, true);
  F.map?.remove();
  F.el.remove();
  F = null;
}

function wireControls() {
  const $ = id => F.el.querySelector(id);
  $('#fly-close').onclick = close;
  $('#fly-play').onclick = () => {
    if (!F.ready) return;
    if (!F.playing && F.km >= F.path.length) F.km = 0;
    setPlaying(!F.playing);
  };
  $('#fly-speed').onclick = () => {
    F.speed = (F.speed + 1) % SPEEDS.length;
    $('#fly-speed').textContent = SPEEDS[F.speed] + '×';
  };
  const scrub = $('#fly-scrub');
  scrub.oninput = () => {
    if (!F.ready) return;
    F.scrubbing = true;
    F.km = (scrub.value / 1000) * F.path.length;
    F.el.querySelector('#fly-end').hidden = true;
    apply();
  };
  scrub.onchange = () => (F.scrubbing = false);
  $('#fly-end').onclick = e => {
    const what = e.target.dataset.fly;
    if (what === 'again') {
      F.km = 0;
      setPlaying(true);
    } else if (what === 'close') close();
    else if (what === 'test') {
      close();
      v2HandleAction('tool-lab'); // the "Is it unusual?" test for this line
    }
  };
  F.onKey = e => {
    if (e.key === 'Escape') close();
    else if (e.key === ' ' && e.target === document.body) $('#fly-play').click();
    else return;
    e.preventDefault();
    e.stopPropagation();
  };
  addEventListener('keydown', F.onKey, true);
}

/** Opens the 3D view on the active line and starts flying. */
export async function flyActiveLine() {
  const L = activeLine();
  if (!L || F) return;
  const path = buildFlightPath(L.segs);
  const { stops, summary } = findingsAlong(L, path);
  F = {
    el: buildScreen(L),
    path,
    stops,
    summary,
    km: 0,
    speed: 0,
    playing: false,
    ready: false,
    zoom: flightZoom(path.length),
    kmPerSecond: path.length / flightSeconds(path.length),
    window: Math.max(2, Math.min(60, path.length / 60)),
    exaggeration: 1.3,
  };
  wireControls();
  const status = F.el.querySelector('#fly-status');
  let gl;
  try {
    let worker;
    [gl, worker] = await Promise.all([
      import('maplibre-gl'),
      // the engine's worker script, as a file the build copies next to the app
      import('maplibre-gl/dist/maplibre-gl-worker.mjs?url'),
      import('maplibre-gl/dist/maplibre-gl.css'),
    ]);
    gl.setWorkerUrl(worker.default);
  } catch (e) {
    status.textContent = 'The 3D view could not be downloaded. Check your connection and try again.';
    return;
  }
  if (!F) return; // closed while loading
  const start = flightPosition(path, 0);
  try {
    F.map = new gl.Map({
      container: F.el.querySelector('#fly-map'),
      style: {
        version: 8,
        sources: {
          satellite: { type: 'raster', tiles: [SATELLITE], tileSize: 256, maxzoom: 18 },
          terrain: {
            type: 'raster-dem',
            tiles: [TERRAIN],
            tileSize: 256,
            maxzoom: 14,
            encoding: 'terrarium',
          },
        },
        layers: [
          { id: 'space', type: 'background', paint: { 'background-color': '#0b0f14' } },
          { id: 'satellite', type: 'raster', source: 'satellite' },
        ],
        sky: {
          'sky-color': '#5b9bd8',
          'horizon-color': '#f3d9b1',
          'fog-color': '#d8dde2',
          'sky-horizon-blend': 0.6,
          'horizon-fog-blend': 0.7,
          'fog-ground-blend': 0.35,
        },
      },
      center: [start.lon, start.lat],
      zoom: Math.max(2, F.zoom - 3.5),
      bearing: start.bearing,
      pitch: 0,
      maxPitch: 80,
      attributionControl: false,
    });
  } catch (e) {
    status.textContent = 'This device or browser cannot show the 3D view (WebGL is not available).';
    return;
  }
  const map = F.map;
  map.on('error', e => {
    // a missing tile is not fatal; say so once, and keep flying over what did load
    if (F && !F.tileNote && /tile|fetch|load/i.test(String(e?.error?.message || ''))) {
      F.tileNote = true;
      status.hidden = false;
      status.textContent = 'Some satellite or terrain tiles did not load. They need a connection.';
      setTimeout(() => F && F.ready && (status.hidden = true), 5000);
    }
  });
  map.on('load', () => {
    if (!F) return;
    map.setTerrain({ source: 'terrain', exaggeration: F.exaggeration });
    addLineAndFindings(gl, map, flightCoords(path), stops);
    status.hidden = true;
    // swoop down from above the start, then set off
    map.easeTo({
      zoom: F.zoom,
      pitch: PITCH,
      bearing: start.bearing,
      padding: { top: F.el.clientHeight * 0.3, bottom: 0, left: 0, right: 0 },
      duration: 2600,
    });
    map.once('moveend', () => {
      if (!F) return;
      F.ready = true;
      F.bearing = start.bearing;
      setPlaying(true);
      F.raf = requestAnimationFrame(tick);
    });
  });
}

export function initFlyLine() {
  registerAction('fly', flyActiveLine);
}
