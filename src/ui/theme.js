// Light and dark theme
import { $ } from '../core/util.js';
import { req, setBC } from '../map/draw.js';
import { PAL, buildSTY, setC } from '../render/palette.js';
import { KEYT, S } from '../state/state.js';
import { renderChrome } from './map-chrome.js';
import { renderTab } from './sheet.js';

// ================= theme =================
export let THEME = 'light';
export function applyTheme(t, save) {
  THEME = t;
  document.documentElement.dataset.theme = t;
  setC(PAL[t]);
  buildSTY();
  setBC(null);
  if (save)
    try {
      localStorage.setItem(KEYT, t);
    } catch (e) {}
  renderChrome();
  if (S.tab && !$('#p-' + S.tab).hidden) renderTab(S.tab);
  req();
}

export function initTheme() {
  $('#themebtn').onclick = () => applyTheme(THEME === 'light' ? 'dark' : 'light', true);
  (() => {
    let t = null;
    try {
      t = localStorage.getItem(KEYT);
    } catch (e) {}
    if (t !== 'light' && t !== 'dark')
      t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    THEME = t;
    document.documentElement.dataset.theme = t;
    setC(PAL[t]);
    buildSTY();
  })();
}
