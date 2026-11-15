// Intro flight, callouts and toasts
import { on } from '../core/events.js';
import { $ } from '../core/util.js';
import { anim, flyTo, setAnim } from '../map/camera.js';
import { H, W, clampCam, kForKm } from '../map/canvas.js';
import { req } from '../map/draw.js';
import { setView } from '../map/interaction.js';
import { S } from '../state/state.js';
import { renderChrome } from './map-chrome.js';
import { changed } from './sheet.js';

// ================= intro =================
export function endIntro() {
  S.intro = null;
  $('#skip').hidden = true;
  $('#explore').hidden = !!S.explored || !!S.mode;
  hideCallout();
  renderChrome();
  req();
}
function hideCallout() {
  $('#callout').hidden = true;
  renderChrome();
}
let toastT = 0;
export function toastUndo(msg, undo, ms = 6000) {
  // deletes happen at once; this is the safety net
  toast(msg, ms);
  const t = $('#toast'),
    b = document.createElement('button');
  b.className = 'undo';
  b.textContent = 'Undo';
  t.append(' ', b);
  t.classList.add('act');
  b.onclick = () => {
    undo();
    t.hidden = true;
    t.classList.remove('act');
    clearTimeout(toastT);
  };
}
export function toast(msg, ms = 2600) {
  const t = $('#toast');
  t.classList.remove('act');
  t.textContent = msg;
  t.hidden = false;
  t.classList.remove('show');
  void t.offsetWidth;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => {
    t.hidden = true;
  }, ms);
}

export function initIntro() {
  const stopIntro = () => {
    if (S.intro) endIntro();
  };
  on('map:gesture-start', stopIntro);
  on('map:wheel', stopIntro);
  $('#skip').onclick = () => {
    cancelAnimationFrame(anim);
    setAnim(null);
    endIntro();
    S.cam = { lon: 14, lat: 44, k: kForKm(2600) };
    clampCam();
    req();
  };
  $('#explore').onclick = () => {
    for (const k of ['primary', 'sword', 'torsap', 'duff', 'meridian', 'viasacra', 'intersections', 'user'])
      S.layers[k] = true;
    S.focus = false;
    S.explored = true;
    changed();
    setView('globe');
    flyTo(25, 35, Math.min(W, H) * 0.44, 1800);
    $('#explore').hidden = true;
    toast('Showing every line. Tap “Only this” on the line chip to go back to one line.', 4500);
  };
}
