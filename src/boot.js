// Boot sequence
import { $ } from './core/util.js';
import { S } from './state/state.js';
import { clampCam, kForKm } from './map/canvas.js';
import { v2SyncPick } from './features/create-lines.js';
import { V2 } from './state/preferences.js';
import { v2Discover } from './features/discovery.js';
import { v2Render } from './ui/panels.js';
import { analyse } from './domain/analysis.js';
import { buildLines } from './domain/lines.js';
import { resize } from './map/canvas.js';
import { req } from './map/draw.js';
import { placeAbove, renderChrome } from './ui/map-chrome.js';
import { selectTab, setSheet } from './ui/sheet.js';

// Start-up state of the 2.x interface: no intro, Europe in view, panels closed.
function v2Init() {
  $('.brand h1').textContent = 'LEY ATLAS';
  S.explored = true;
  S.intro = null;
  $('#explore').hidden = true;
  $('#skip').hidden = true;
  S.cam = { lon: 14, lat: 44, k: kForKm(innerWidth < 700 ? 3200 : 2600) };
  clampCam();
  v2SyncPick();
  V2.tab = null;
  V2.sort = 'near';
  v2Discover();
  v2Render();
  renderChrome(); // map first: the panel opens only when something asks for it
}

export function initBoot() {
  // ================= boot =================
  buildLines();
  analyse();
  resize();
  selectTab('data');
  setSheet('peek');
  v2Init();
  renderChrome();
  requestAnimationFrame(() => {
    resize();
    placeAbove();
    req();
  });
  if (document.fonts)
    document.fonts.ready.then(() => {
      placeAbove();
      req();
    });
  addEventListener('resize', placeAbove);
}
