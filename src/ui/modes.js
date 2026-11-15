// Interaction modes and banner
import { $ } from '../core/util.js';
import { cv } from '../map/canvas.js';
import { req } from '../map/draw.js';
import { V2 } from '../state/preferences.js';
import { S } from '../state/state.js';
import { renderChrome } from './map-chrome.js';
import { renderTab, setSheet } from './sheet.js';

// ================= modes =================
export function setMode(m) {
  S.mode = m;
  cv.classList.toggle('tapmode', !!m);
  $('#reticle').hidden = !m;
  $('#addhere').hidden = !m;
  $('#explore').hidden = !!m || !!S.explored || !!S.intro;
  if (m) setSheet('peek');
  setBanner();
  renderChrome();
  renderTab(S.tab);
  req();
}
export function setBanner() {
  const b = $('#banner');
  if (!S.mode) {
    b.hidden = true;
    return;
  }
  b.hidden = false;
  const t = {
    measure: `Measure: crosshair on each point (${S.measure.length}/3), or tap the map.`,
    marker: 'Crosshair on the spot, then Add. Or tap the map.',
    draw: V2.drawPoints.length ? 'Tap point B on the map' : 'Tap point A on the map',
  }[S.mode];
  $('#bannertxt').textContent = t;
  $('#addhere').textContent =
    S.mode === 'draw'
      ? V2.drawPoints.length
        ? 'Set point B here'
        : 'Set point A here'
      : S.mode === 'measure'
        ? '+ Add point'
        : '+ Add marker';
}

export function initModes() {
  $('#bannerdone').onclick = () => setMode(null);
}
