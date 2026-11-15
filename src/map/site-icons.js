// Site icons drawn on the canvas
import { ctx } from './canvas.js';
import { C } from '../render/palette.js';

export function drawIcon(cat, x, y, sc = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sc, sc);
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = C.iconEdge;
  ctx.beginPath();
  if (cat === 'fort') {
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 3.4 : 8,
        a = -Math.PI / 2 + (i * Math.PI) / 5;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fillStyle = C.star;
  } else if (cat === 'obelisk') {
    ctx.moveTo(0, -9);
    ctx.lineTo(2.6, -5.5);
    ctx.lineTo(3, 6);
    ctx.lineTo(-3, 6);
    ctx.lineTo(-2.6, -5.5);
    ctx.closePath();
    ctx.fillStyle = C.obelisk;
  } else if (cat === 'temple') {
    ctx.moveTo(-7, -2);
    ctx.lineTo(0, -7);
    ctx.lineTo(7, -2);
    ctx.closePath();
    ctx.rect(-6, -1, 12, 6.5);
    ctx.fillStyle = C.temple;
  } else if (cat === 'church') {
    ctx.rect(-1.8, -8, 3.6, 15);
    ctx.rect(-6, -4, 12, 3.6);
    ctx.fillStyle = C.church;
  } else if (cat === 'ruin') {
    ctx.rect(-5.5, -5.5, 11, 11);
    ctx.fillStyle = C.ruin;
  } else if (cat === 'mountain') {
    ctx.moveTo(-8, 6);
    ctx.lineTo(0, -7);
    ctx.lineTo(8, 6);
    ctx.closePath();
    ctx.fillStyle = C.mountain;
  } else if (cat === 'landmark') {
    ctx.arc(0, 0, 5.5, 0, 7);
    ctx.fillStyle = C.landmark;
  } else if (cat === 'heritage') {
    ctx.arc(0, 0, 4.5, 0, 7);
    ctx.fillStyle = C.dotUn;
  } else if (cat === 'castle') {
    const P2 = [
      -6, 7, -6, -8, -3.6, -8, -3.6, -5.2, -1.2, -5.2, -1.2, -8, 1.2, -8, 1.2, -5.2, 3.6, -5.2, 3.6, -8, 6,
      -8, 6, 7,
    ];
    ctx.moveTo(P2[0], P2[1]);
    for (let i = 2; i < P2.length; i += 2) ctx.lineTo(P2[i], P2[i + 1]);
    ctx.closePath();
    ctx.fillStyle = C.castle;
  } else if (cat === 'roman') {
    ctx.moveTo(-7.5, -4);
    ctx.lineTo(0, -8);
    ctx.lineTo(7.5, -4);
    ctx.closePath();
    ctx.rect(-6, -3, 2.4, 8);
    ctx.rect(-1.2, -3, 2.4, 8);
    ctx.rect(3.6, -3, 2.4, 8);
    ctx.rect(-7.5, 5, 15, 2);
    ctx.fillStyle = C.roman;
  } else if (cat === 'megalith') {
    ctx.rect(-6.5, -3, 3.6, 10);
    ctx.rect(2.9, -3, 3.6, 10);
    ctx.rect(-8, -7.5, 16, 3.6);
    ctx.fillStyle = C.megalith;
  } else {
    ctx.arc(0, 0, 5.5, 0, 7);
    ctx.fillStyle = C.marker;
  }
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
