// Satellite tiles
import { D2R } from '../core/util.js';
import { H, W, ctx } from './canvas.js';
import { req } from './draw.js';
import { S } from '../state/state.js';
import { toast } from '../ui/intro.js';
import { renderTab } from '../ui/sheet.js';

// ================= satellite tiles =================
const tiles = new Map();
function tileImg(z, x, y) {
  const k = `${z}/${x}/${y}`;
  let t = tiles.get(k);
  if (!t) {
    t = { img: new Image(), ok: false };
    t.img.crossOrigin = 'anonymous';
    t.img.onload = () => {
      t.ok = true;
      req();
    };
    t.img.onerror = () => {
      t.err = true;
      if (!S.satFailed) {
        S.satFailed = true;
        S.layers.sat = false;
        renderTab(S.tab);
        toast(
          'Satellite tiles are blocked in this viewer. Use the satellite button on the map, or open the HTML file in a browser.',
          6000,
        );
        req();
      }
    };
    t.img.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
    tiles.set(k, t);
    if (tiles.size > 300) tiles.delete(tiles.keys().next().value);
  }
  return t;
}
export function drawTiles() {
  const c = S.cam,
    m = c.k * Math.cos(c.lat * D2R),
    world = 2 * Math.PI * m;
  const z = Math.max(0, Math.min(19, Math.round(Math.log2(world / 256)))),
    n = 2 ** z,
    T = world / n;
  const mercY = Math.log(Math.tan(Math.PI / 4 + (c.lat * D2R) / 2));
  const ox = W / 2 - m * (c.lon * D2R + Math.PI),
    oy = H / 2 - m * (Math.PI - mercY);
  const x0 = Math.floor(-ox / T),
    x1 = Math.floor((W - ox) / T),
    y0 = Math.max(0, Math.floor(-oy / T)),
    y1 = Math.min(n - 1, Math.floor((H - oy) / T));
  if ((x1 - x0 + 1) * (y1 - y0 + 1) > 80) return false;
  for (let x = x0; x <= x1; x++)
    for (let y = y0; y <= y1; y++) {
      const xx = ((x % n) + n) % n,
        t = tileImg(z, xx, y);
      if (t.ok) {
        ctx.drawImage(t.img, ox + x * T, oy + y * T, T + 0.6, T + 0.6);
        continue;
      }
      for (let up = 1; up <= 5 && z - up >= 0; up++) {
        const pt = tiles.get(`${z - up}/${xx >> up}/${y >> up}`);
        if (pt && pt.ok) {
          const s = 256 / 2 ** up;
          ctx.drawImage(
            pt.img,
            (xx % 2 ** up) * s,
            (y % 2 ** up) * s,
            s,
            s,
            ox + x * T,
            oy + y * T,
            T + 0.6,
            T + 0.6,
          );
          break;
        }
      }
    }
  return true;
}
