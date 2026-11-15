// Boot sequence
import { analyse } from './domain/analysis.js';
import { buildLines } from './domain/lines.js';
import { resize } from './map/canvas.js';
import { req } from './map/draw.js';
import { v2Init } from './map/endpoint-drag.js';
import { placeAbove, renderChrome } from './ui/map-chrome.js';
import { selectTab, setSheet } from './ui/sheet.js';

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
