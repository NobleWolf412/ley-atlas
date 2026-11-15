// Label placement: keeps site and place names from overlapping
import { W, ctx } from './canvas.js';
import { C } from '../render/palette.js';

export function placeLabels(L) {
  L.sort((a, b) => b.pri - a.pri);
  const boxes = [];
  ctx.textBaseline = 'middle';
  let n = 0;
  for (const l of L) {
    if (n > 140) break;
    ctx.font = l.place
      ? '500 11px "Instrument Sans", system-ui, sans-serif'
      : '600 12px "Instrument Sans", system-ui, sans-serif';
    const w = ctx.measureText(l.t).width + 6,
      b = { x: l.x + (l.place ? 5 : 11), y: l.y - 8, w, h: 16 };
    if (b.x + w > W - 4) b.x = l.x - (l.place ? 5 : 11) - w;
    if (boxes.some(o => b.x < o.x + o.w && b.x + b.w > o.x && b.y < o.y + o.h && b.y + b.h > o.y)) continue;
    boxes.push(b);
    n++;
    ctx.lineWidth = 3.5;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = C.halo;
    ctx.strokeText(l.t, b.x + 3, l.y);
    ctx.fillStyle = l.place ? C.place : l.pri >= 5 ? C.strong : C.text;
    ctx.fillText(l.t, b.x + 3, l.y);
  }
}
