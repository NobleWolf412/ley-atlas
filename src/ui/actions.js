// What each button does: every data-v2 action in the panels
import { runAction } from './registry.js';
import { v2OpenHost } from './panels.js';
import { v2Download } from './downloads.js';
import { v2Back, v2ChangeTab, v2Done, v2Render } from './panels.js';
import { v2OpenBrowser } from './site-lists.js';
import { V2, v2Persist } from '../state/preferences.js';
import {
  v2ApplyEnds,
  v2ConnectSites,
  v2DrawBearing,
  v2Ends,
  v2SaveWork,
  v2SetPoint,
  v2StartDraw,
  v2SyncPick,
} from '../features/create-lines.js';
import { S, persistImports, stripF } from '../state/state.js';
import { lmMarkPicked } from '../features/line-match.js';
import { req } from '../map/draw.js';
import { toast, toastUndo } from './intro.js';
import { setMode } from './modes.js';
import { renderKey, setFocus } from './map-chrome.js';
import { setView } from '../map/interaction.js';
import { openLinePicker } from './picker.js';
import { activeLine } from '../domain/lines.js';
import { startFollow } from '../features/follow-line.js';
import { confirmBox, csv, geojson, stateCode } from '../panels/data-pane.js';
import { changed, keepScroll, setSheet } from './sheet.js';
import { renderLayers } from '../panels/layers-pane.js';
import { $ } from '../core/util.js';
import { setActive } from '../panels/lines-pane.js';
import { v2LineChanged } from '../features/discovery.js';
import { flyToLine } from '../map/camera.js';
import { rebuildPoints } from '../domain/points.js';
import { v2RestoreBackup, v2SaveMapPicture } from './downloads.js';

export function v2HandleAction(action, id) {
  if (runAction(action, id)) return; // actions that features registered themselves
  switch (action) {
    case 'done':
      v2Done();
      break;
    case 'pick-a':
      v2OpenBrowser('a', !V2.pick.b);
      break;
    case 'pick-b':
      v2OpenBrowser('b');
      break;
    case 'swap': {
      v2SyncPick();
      const { a, b } = V2.pick;
      V2.pick = { a: b, b: a };
      if (a && b) v2ConnectSites(b, a, S.work?.len == null && !!S.work?.sites);
      else if (S.work && !S.work.sites) {
        const e = v2Ends(S.work);
        v2ApplyEnds([e[1], e[0]], S.work.name, S.work.len == null);
      }
      v2Render();
      break;
    }
    case 'site-a':
      if (S.sel?.type === 'site') v2SetPoint('a', S.sel.id);
      break;
    case 'site-b':
      if (S.sel?.type === 'site') v2SetPoint('b', S.sel.id);
      break;
    case 'site-full':
      v2OpenHost('detail');
      break;
    case 'menu-lines':
      v2ChangeTab('saved');
      break;
    case 'menu-layers':
      v2OpenHost('layers');
      break;
    case 'site-line': {
      const id = S.sel?.id;
      if (id && V2.pick.a && V2.pick.a !== id) {
        v2SetPoint('b', id);
        lmMarkPicked();
      }
      break;
    }
    case 'pick-best':
      v2OpenBrowser('b');
      break;
    case 'site-restart': {
      const id = S.sel?.id;
      if (!id) break;
      V2.picking = true;
      V2.pick = { a: id, b: null };
      S.sel = null;
      V2.hl = null;
      V2.prevCam = null;
      V2.tab = 'draw';
      v2Render();
      req();
      toast('Now choose where the line goes');
      setTimeout(() => v2OpenBrowser('b'), 60);
      break;
    }
    case 'sites-all':
      V2.allSites = !V2.allSites;
      v2Render();
      break;
    case 'pick-from':
      v2OpenBrowser('from');
      break;
    case 'bearing-go':
      v2DrawBearing();
      break;
    case 'more':
      V2.limit += 60;
      v2Render();
      break;
    case 'draw-start':
      v2StartDraw();
      break;
    case 'cancel-draw':
      setMode(null);
      V2.drawPoints = [];
      V2.hover = null;
      v2Render();
      req();
      break;
    case 'redraw':
      v2StartDraw(true);
      break;
    case 'new-line':
      V2.editId = null;
      V2.picking = true;
      V2.pick = { a: null, b: null };
      V2.disc = null;
      v2ChangeTab('draw');
      v2OpenBrowser('a', true);
      break;
    case 'tab-draw':
      v2ChangeTab('draw');
      break;
    case 'layers':
      v2OpenHost('layers');
      break;
    case 'layers-close':
      v2Back();
      break;
    case 'layers-clear':
      for (const k of Object.keys(S.under)) S.under[k] = false;
      v2Persist();
      v2Render();
      // Hosted panes bypass v2Render's panel refresh: update their switches and counts explicitly.
      keepScroll('#p-layers', () => renderLayers());
      renderKey();
      req();
      break;
    case 'focus':
      setFocus(!S.focus);
      v2Render();
      break;
    case 'satellite':
      if (S.satFailed) {
        toast('Satellite tiles are blocked here. Open the HTML file in Chrome to use them.');
        break;
      }
      S.layers.sat = !S.layers.sat;
      if (S.layers.sat) setView('map');
      v2Render();
      req();
      break;
    case 'analyze':
      v2ChangeTab('analyze');
      break;
    case 'choose-line':
      openLinePicker();
      break;
    case 'follow':
      if (!activeLine()) break;
      startFollow();
      break;
    case 'tool-lab':
      v2OpenHost('lab');
      break;
    case 'tool-data':
      v2OpenHost('data');
      break;
    case 'save-work':
      v2SaveWork();
      break;
    case 'discard':
      confirmBox('Remove the working line from the map?', 'Remove', () => {
        S.work = null;
        V2.editId = null;
        V2.pick = { a: null, b: null };
        S.active = S.userLines[S.userLines.length - 1]?.id || null;
        changed();
        V2.disc = null;
        $('#v2alert').hidden = true;
        if (V2.tab !== 'saved') V2.tab = 'draw'; // removed from My lines: stay there
        v2Render();
      });
      break;
    case 'open-saved':
      setActive(id);
      V2.disc = null;
      v2LineChanged();
      V2.tab = 'analyze';
      v2Render();
      flyToLine(activeLine());
      break;
    case 'edit-saved': {
      const u = S.userLines.find(l => l.id === id);
      if (!u) return;
      S.work = { ...stripF(u) };
      S.work.v2ends = v2Ends(u);
      V2.editId = id;
      S.active = 'work';
      S.focus = true;
      changed();
      v2LineChanged();
      V2.tab = 'draw';
      v2Render();
      setSheet('half');
      flyToLine(activeLine());
      break;
    }
    case 'delete-saved': {
      const i = S.userLines.findIndex(l => l.id === id);
      if (i < 0) return;
      const u = S.userLines[i],
        wasActive = S.active === id,
        tab = V2.tab;
      S.userLines.splice(i, 1);
      if (wasActive) S.active = null;
      changed();
      V2.disc = null;
      if (V2.tab === 'analyze' && wasActive) V2.tab = 'saved';
      v2Render();
      toastUndo(`Deleted “${u.name || 'line'}”`, () => {
        S.userLines.splice(Math.min(i, S.userLines.length), 0, u);
        if (wasActive) S.active = id;
        changed();
        V2.disc = null;
        V2.tab = tab;
        v2Render();
        req();
      });
      break;
    }
    case 'delete-import': {
      const i = S.imports.findIndex(x => x.id === id);
      if (i < 0) return;
      const im = S.imports[i];
      S.imports.splice(i, 1);
      persistImports();
      rebuildPoints();
      changed();
      toastUndo(`Removed “${im.name}”`, () => {
        S.imports.splice(Math.min(i, S.imports.length), 0, im);
        persistImports();
        rebuildPoints();
        changed();
      });
      break;
    }
    case 'export-backup':
      v2Download(
        'ley-atlas-backup.json',
        JSON.stringify(
          { format: 'ley-atlas-v2', exported: new Date().toISOString(), state: stateCode() },
          null,
          2,
        ),
      );
      break;
    case 'import-backup':
      v2RestoreBackup();
      break;
    case 'export-geo':
      v2Download('ley-atlas-lines-geojson.json', JSON.stringify(geojson(), null, 2), 'application/geo+json');
      break;
    case 'export-csv':
      if (!activeLine()) {
        toast('Open or draw a line first: the table lists every site with its distance from the line');
        break;
      }
      v2Download('ley-atlas-sites-along-line.csv', csv(), 'text/csv');
      break;
    case 'export-png':
      v2SaveMapPicture();
      break;
  }
}
