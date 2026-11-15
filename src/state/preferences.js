// 2.x preferences (V2 state)
import { S } from './state.js';

// ================= Ley Atlas 2.1: connect sites, discover what lies along the line =================
const V2KEY = 'leyatlas.v2.preferences';
export const V2 = {
  tab: null,
  host: null,
  msig: { dep: true, fau: true, mag: true, site: true },
  bear: { from: null, brg: '0', len: '1000' },
  allSites: false,
  overlayOpacity: 75,
  layersOpen: false,
  drawPoints: [],
  hover: null,
  drag: null,
  editId: null,
  query: '',
  cat: 'all',
  sort: 'az',
  inView: false,
  limit: 60,
  pick: { a: null, b: null },
  glow: true,
  lineColor: null,
  zoomMode: 'key',
  ugDep: 'points',
  ugFault: 'lines',
  alertOff: false,
  hl: null,
  disc: null,
  alertKey: null,
  faultCache: null,
  plateCache: null,
  magCache: null,
  country: '', // Explore's country filter ('' = all countries)
  browser: null,
};
export function v2Persist() {
  try {
    localStorage.setItem(
      V2KEY,
      JSON.stringify({
        opacity: V2.overlayOpacity,
        under: S.under,
        cat: S.layers.cat,
        active: S.active,
        corridor: S.corridorKm,
        glow: V2.glow,
        zoomMode: V2.zoomMode,
        ugDep: V2.ugDep,
        ugFault: V2.ugFault,
        lineColor: V2.lineColor,
        dcat: V2.cat,
      }),
    );
  } catch (e) {}
}
export const v2IsAdvanced = () => !!V2.host;
// a full-detail page (record, test, data) is open in the panel
export const CORRIDORS = [1, 5, 10, 25, 50];

export function initPreferences() {
  try {
    const p = JSON.parse(localStorage.getItem(V2KEY) || 'null');
    if (p) {
      V2.overlayOpacity = Number.isFinite(p.opacity) ? Math.max(15, Math.min(100, p.opacity)) : 75;
      if (p.under)
        for (const k of Object.keys(S.under)) if (typeof p.under[k] === 'boolean') S.under[k] = p.under[k];
      if (p.cat)
        for (const k of Object.keys(S.layers.cat))
          if (typeof p.cat[k] === 'boolean') S.layers.cat[k] = p.cat[k];
      if (p.active && ((p.active === 'work' && S.work) || S.userLines.some(x => x.id === p.active)))
        S.active = p.active;
      if (Number.isFinite(p.corridor)) S.corridorKm = Math.max(0.05, Math.min(200, p.corridor));
      if (typeof p.glow === 'boolean') V2.glow = p.glow;
      if (p.ugDep === 'heat' || p.ugDep === 'points') V2.ugDep = p.ugDep;
      if (p.ugFault === 'heat' || p.ugFault === 'lines') V2.ugFault = p.ugFault;
      if (typeof p.zoomMode === 'string' && ['key', 'heat', 'groups', 'all'].includes(p.zoomMode))
        V2.zoomMode = p.zoomMode;
      else if (p.cluster === false) V2.zoomMode = 'all';
      if (typeof p.lineColor === 'string' || p.lineColor === null) V2.lineColor = p.lineColor || null;
      if (typeof p.dcat === 'string') V2.cat = p.dcat;
    } else {
      S.layers.sword = false;
      S.layers.torsap = false;
      S.layers.meridian = false;
      S.corridorKm = 5;
      S.active = S.work ? 'work' : S.userLines.length ? S.userLines[S.userLines.length - 1].id : null;
    }
  } catch (e) {
    /* storage unavailable */
  }
}
