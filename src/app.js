// Starts the app: runs each module's set-up in the same order as the original single-file build.
import { initUtil } from './core/util.js';
import { initPalette } from './render/palette.js';
import { initBasemap } from './map/basemap.js';
import { initSiteTypes } from './domain/site-types.js';
import { initState } from './state/state.js';
import { initPoints } from './domain/points.js';
import { initLines } from './domain/lines.js';
import { initCanvas } from './map/canvas.js';
import { initUnderground } from './domain/underground.js';
import { initInteraction } from './map/interaction.js';
import { initIntro } from './ui/intro.js';
import { initMapChrome } from './ui/map-chrome.js';
import { initFollowLine } from './features/follow-line.js';
import { initModes } from './ui/modes.js';
import { initSheet } from './ui/sheet.js';
import { initPicker } from './ui/picker.js';
import { initDataPane } from './panels/data-pane.js';
import { initTheme } from './ui/theme.js';
import { initPreferences } from './state/preferences.js';
import { initCategories } from './domain/categories.js';
import { initCreateLines } from './features/create-lines.js';
import { initSiteLists } from './ui/site-lists.js';
import { initLineMatch } from './features/line-match.js';
import { initPanels } from './ui/panels.js';
import { initEvents } from './ui/events.js';
import { initSwipeDelete } from './ui/swipe-delete.js';
import { initEndpointDrag } from './features/endpoint-drag.js';
import { initDiscovery } from './features/discovery.js';
import { initLineOverlay } from './features/line-overlay.js';
import { initBoot } from './boot.js';
import { resetUndergroundData } from './domain/underground.js';
import { resetLayerCounts } from './panels/layers-pane.js';
import { resetLineUnderground } from './panels/lines-pane.js';
import { resetDepPools } from './features/random-test.js';
import { v2LineChanged } from './features/discovery.js';
import { req, setBC } from './map/draw.js';
import { V2 } from './state/preferences.js';
import { v2Render } from './ui/panels.js';
import { changed } from './ui/sheet.js';
import { initShareLink, openSharedLink } from './features/share-link.js';
import { initMapTaps } from './ui/map-taps.js';

export function startApp() {
  initUtil();
  initPalette();
  initBasemap();
  initSiteTypes();
  initState();
  initPoints();
  initLines();
  initCanvas();
  initUnderground();
  initInteraction();
  initMapTaps();
  initIntro();
  initMapChrome();
  initFollowLine();
  initModes();
  initSheet();
  initPicker();
  initDataPane();
  initTheme();
  initPreferences();
  initCategories();
  initCreateLines();
  initSiteLists();
  initDiscovery(); // registers its draw layers before line match, so glows sit under the match fan
  initLineMatch();
  initLineOverlay();
  initShareLink();
  initPanels();
  initEvents();
  initSwipeDelete();
  initEndpointDrag();
  initBoot();
  // not in requestAnimationFrame: that never fires while the tab is in the background
  openSharedLink();
}

/**
 * Called once the deferred datasets (coastline detail, deposits, faults, plates,
 * magnetic grids) have arrived: forget anything computed without them and redraw.
 */
export function deferredDataReady() {
  // the magnetic grids decode a moment later: refresh what the active line shows when each lands
  resetUndergroundData(() => {
    v2LineChanged();
    v2Render();
  });
  resetLayerCounts();
  resetLineUnderground();
  resetDepPools();
  V2.magCache = null;
  setBC(null);
  v2LineChanged();
  changed();
  // draw once more after the base-map cache has been rebuilt (60 ms after a full draw)
  setTimeout(req, 150);
}
