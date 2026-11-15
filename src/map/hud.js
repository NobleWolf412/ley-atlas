// Heads-up display: scale bar, coordinate readout, map links
import { VIEW } from './canvas.js';
import { $ } from '../core/util.js';
import { fmtKm, fmtLL, satUrl } from '../core/format.js';
import { S } from '../state/state.js';

export function updateHud() {
  const ppk = VIEW.ppk,
    km = 100 / ppk,
    p10 = 10 ** Math.floor(Math.log10(km)),
    nice =
      [1, 2, 5, 10]
        .map(m => m * p10)
        .filter(v => v <= km)
        .pop() || p10;
  $('#scalebar').style.width = Math.round(nice * ppk) + 'px';
  $('#scaletxt').textContent = fmtKm(nice);
  $('#readout').textContent = fmtLL(S.cam.lat, S.cam.lon, 4);
  const z = Math.max(2, Math.min(20, Math.round(Math.log2((ppk * 40075) / 256)) + 1));
  $('#satlink').href = satUrl(S.cam.lat, S.cam.lon, z);
  const satOn = S.layers.sat && !S.satFailed && S.view === 'map';
  $('#attrib').textContent =
    (satOn ? 'Imagery © Esri, Maxar, Earthstar Geographics · ' : '') +
    'Natural Earth' +
    (VIEW.rv < 40 && S.layers.outlines ? ' · Fort outlines © OpenStreetMap contributors (ODbL)' : '');
  const ex = $('#explore');
  if (!S.explored && !S.intro && !S.mode) ex.hidden = VIEW.rv < 30;
  const street = VIEW.rv < 4 && !satOn && !S.intro && !S.mode;
  $('#street').hidden = !street;
  if (street) $('#street').href = satUrl(S.cam.lat, S.cam.lon, z);
}
