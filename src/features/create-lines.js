// Creating lines: site to site or freehand
import { toastAction } from '../ui/intro.js';
import { registerAction } from '../ui/registry.js';
import { GEO } from '../core/geo.js';
import { $, PIR } from '../core/util.js';
import { activeLine } from '../domain/lines.js';
import { findPoint } from '../domain/points.js';
import { v2Discover, v2LineChanged } from './discovery.js';
import { flyToLine } from '../map/camera.js';
import { req } from '../map/draw.js';
import { revealPoint } from '../panels/lines-pane.js';
import { V2 } from '../state/preferences.js';
import { S, stripF } from '../state/state.js';
import { toast } from '../ui/intro.js';
import { setMode } from '../ui/modes.js';
import { v2Leave, v2Render } from '../ui/panels.js';
import { changed, setSheet } from '../ui/sheet.js';
import { v2OpenBrowser } from '../ui/site-lists.js';

// ---------- creating lines: site to site (default) or freehand ----------
export function v2Ends(u) {
  if (u.v2ends && u.v2ends.length === 2) return u.v2ends.map(p => [...p]);
  if (!u.o) return null;
  const len = u.len == null ? 200 : Math.min(u.len, 15000);
  return [[...u.o], GEO.dest(u.o[0], u.o[1], u.brg, len)];
}
export function v2SyncPick() {
  if (V2.picking) return;
  const w = S.work;
  if (w && w.sites) V2.pick = { a: w.sites[0], b: w.sites[1] };
}
export function v2SetPoint(which, id) {
  v2SyncPick();
  V2.pick[which] = id;
  if (V2.pick.a && V2.pick.a === V2.pick.b) V2.pick[which === 'a' ? 'b' : 'a'] = null;
  if (V2.pick.a && V2.pick.b)
    v2ConnectSites(V2.pick.a, V2.pick.b, S.work && S.work.sites ? S.work.len == null : false);
  else {
    V2.tab = 'draw';
    v2Render();
  }
}
export function v2ConnectSites(aId, bId, global, keepName) {
  const A = findPoint(aId),
    B = findPoint(bId);
  if (!A || !B || A === B) return;
  const dist = GEO.dist(A.lat, A.lon, B.lat, B.lon);
  if (dist < 0.025 || dist > PIR - 0.025) {
    toast('Choose two sites that are not on top of each other or exactly opposite');
    return;
  }
  if (revealPoint(A) | revealPoint(B)) {
    /* switched their types back on */
  }
  const name = keepName && S.work ? S.work.name : `${A.n} → ${B.n}`;
  offerToSave(S.work, name);
  S.work = {
    name,
    o: [A.lat, A.lon],
    brg: GEO.bearing(A.lat, A.lon, B.lat, B.lon),
    len: global ? null : dist,
    anchors: [A.id, B.id],
    sites: [A.id, B.id],
    v2ends: [
      [A.lat, A.lon],
      [B.lat, B.lon],
    ],
  };
  V2.pick = { a: A.id, b: B.id };
  V2.picking = false;
  if (S.sel || V2.hl) {
    S.sel = null;
    V2.hl = null;
    V2.prevCam = null;
    if (V2.hist) {
      V2.hist = false;
      try {
        history.back();
      } catch (e) {}
    }
  } // the new line replaces whatever was being looked at
  S.layers.user = true;
  S.active = 'work';
  S.focus = true;
  V2.tab = 'draw';
  changed();
  flyToLine(activeLine());
  setSheet('half');
  v2LineChanged();
  v2Render();
}
export function v2ApplyEnds(ends, name, global = false) {
  const a = ends[0],
    b = ends[1],
    dist = GEO.dist(...a, ...b);
  if (!Number.isFinite(dist) || dist < 0.025 || dist > PIR - 0.025) {
    toast('Choose two distinct points that are not exactly opposite each other');
    return false;
  }
  if (name) offerToSave(S.work, name); // a named line (from the alignment finder) replacing another
  S.work = {
    name: name || `Line ${S.userLines.length + 1}`,
    o: [...a],
    brg: GEO.bearing(...a, ...b),
    len: global ? null : dist,
    anchors: [],
    v2ends: ends.map(p => [...p]),
  };
  V2.picking = false;
  V2.pick = { a: null, b: null };
  S.layers.user = true;
  S.active = 'work';
  S.focus = true;
  changed();
  v2LineChanged();
  return true;
}
export function v2StartDraw(preserveEdit = false) {
  if (S.mode === 'draw') {
    setMode(null);
    V2.drawPoints = [];
    v2Render();
    return;
  }
  if (!preserveEdit) V2.editId = null;
  V2.drawPoints = [];
  V2.hover = null;
  V2.layersOpen = false;
  V2.tab = 'draw';
  v2Leave();
  setMode('draw');
  setSheet('peek');
  v2Render();
  req();
}
export function v2MapPoint(ll) {
  if (!V2.drawPoints.length) {
    V2.drawPoints.push(ll);
    v2Render();
    req();
    return;
  }
  const A = V2.drawPoints[0];
  if (GEO.dist(...A, ...ll) < 0.025) {
    toast('Move the second point at least 25 metres away');
    return;
  }
  const nm = V2.editId ? S.work?.name || 'Untitled alignment' : `My alignment ${S.userLines.length + 1}`;
  if (v2ApplyEnds([A, ll], nm, false)) {
    V2.drawPoints = [];
    V2.hover = null;
    setMode(null);
    V2.tab = 'draw';
    setSheet('half');
    v2Render();
  }
}
export function v2SetGlobal(on) {
  if (!S.work) return;
  const e = v2Ends(S.work);
  S.work.len = on ? null : GEO.dist(...e[0], ...e[1]);
  changed();
  v2LineChanged();
  v2Render();
}
export function v2DrawBearing() {
  const F = findPoint(V2.bear.from),
    b = parseFloat(V2.bear.brg);
  if (!F) {
    v2OpenBrowser('from');
    return;
  }
  if (!isFinite(b)) {
    toast('Enter a bearing in degrees, 0 = north, 90 = east');
    return;
  }
  const brg = ((b % 360) + 360) % 360;
  V2.bear.brg = String(+brg.toFixed(2));
  if (revealPoint(F)) {
    /* switched its type back on */
  }
  if (S.work && !S.work.name.startsWith(`${F.n} @ `)) offerToSave(S.work, '');
  S.work = {
    name: `${F.n} @ ${+brg.toFixed(2)}°`,
    o: [F.lat, F.lon],
    brg,
    len: V2.bear.len === 'g' ? null : +V2.bear.len,
    anchors: [F.id],
  };
  V2.pick = { a: null, b: null };
  V2.editId = null;
  V2.picking = false;
  if (S.sel || V2.hl) {
    S.sel = null;
    V2.hl = null;
    V2.prevCam = null;
    if (V2.hist) {
      V2.hist = false;
      try {
        history.back();
      } catch (e) {}
    }
  }
  S.layers.user = true;
  S.active = 'work';
  S.focus = true;
  V2.tab = 'draw';
  changed();
  flyToLine(activeLine());
  setSheet('half');
  v2LineChanged();
  v2Render();
}
/**
 * A new site-to-site line has just replaced one that was never saved:
 * offer to save the old one, without getting in the way.
 */
function offerToSave(old, newName) {
  if (!old || V2.editId || old.name === newName) return;
  // shown after the pickers have closed, so the button can be reached
  setTimeout(
    () =>
      toastAction(
        `“${old.name}” was not saved`,
        'Save it',
        () => {
          const id = 'u' + Date.now(),
            name = (old.name || 'Untitled alignment').slice(0, 100);
          S.userLines.push({ ...stripF(old), id, name, short: name });
          changed();
          toast(`Saved “${name}” to My lines`);
        },
        8000,
      ),
    500,
  );
}
export function v2SaveWork() {
  if (!S.work) return;
  const name =
    ($('#v2name')?.value || S.work.name || 'Untitled alignment').trim().slice(0, 100) || 'Untitled alignment';
  const id = V2.editId || 'u' + Date.now(),
    u = { ...stripF(S.work), id, name, short: name };
  const i = S.userLines.findIndex(x => x.id === id);
  if (i >= 0) S.userLines[i] = u;
  else S.userLines.push(u);
  S.work = null;
  V2.editId = null;
  S.active = id;
  V2.pick = { a: null, b: null };
  changed();
  V2.disc = null;
  v2Discover();
  V2.tab = 'saved';
  v2Render();
  toast('Line saved');
}

/** Brings the unsaved line back onto the map (from My lines). */
function openWorkLine() {
  if (!S.work) return;
  S.active = 'work';
  S.focus = true;
  V2.tab = 'draw';
  changed();
  v2LineChanged();
  v2Render();
  flyToLine(activeLine());
}

export function initCreateLines() {
  registerAction('open-work', openWorkLine);
}
