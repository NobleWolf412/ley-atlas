// Swipe left to delete
import { v2HandleAction } from './actions.js';

export function initSwipeDelete() {
  // ---------- swipe left to delete ----------
  (() => {
    const OPEN = 88;
    let g = null,
      opened = null,
      eatClick = false;
    const setX = (row, x, anim) => {
      row.style.transition = anim ? '' : 'none';
      row.style.transform = x ? `translateX(${x}px)` : '';
      row.dataset.x = x;
    };
    const close = row => {
      if (row) setX(row, 0, true);
      if (opened === row) opened = null;
    };
    document.addEventListener(
      'pointerdown',
      e => {
        const row = e.target.closest('.v2-swipe-row');
        if (opened && opened !== row && !e.target.closest('.v2-swipe-del')) close(opened);
        if (!row || e.button > 0) return;
        g = { row, x0: e.clientX, y0: e.clientY, base: +row.dataset.x || 0, dir: null, id: e.pointerId };
      },
      true,
    );
    document.addEventListener(
      'pointermove',
      e => {
        if (!g || e.pointerId !== g.id) return;
        const dx = e.clientX - g.x0,
          dy = e.clientY - g.y0;
        if (!g.dir) {
          if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2) {
            g.dir = 'x';
            try {
              g.row.setPointerCapture(e.pointerId);
            } catch (er) {}
          } else if (Math.abs(dy) > 8) {
            g = null;
            return;
          } else return;
        }
        setX(g.row, Math.min(0, g.base + dx), false);
        e.preventDefault();
      },
      { passive: false },
    );
    const end = e => {
      if (!g || e.pointerId !== g.id) return;
      const r = g;
      g = null;
      if (!r.dir) return;
      eatClick = true;
      setTimeout(() => (eatClick = false), 50);
      const x = +r.row.dataset.x || 0,
        w = r.row.offsetWidth;
      if (x < -w * 0.55) {
        setX(r.row, -w, true);
        setTimeout(() => v2HandleAction(r.row.dataset.swipe, r.row.dataset.id), 160);
        opened = null;
      } // swiped all the way
      else if (x < -OPEN / 2) {
        setX(r.row, -OPEN, true);
        opened = r.row;
      } else close(r.row);
    };
    document.addEventListener('pointerup', end, true);
    document.addEventListener('pointercancel', end, true);
    document.addEventListener(
      'click',
      e => {
        if (eatClick && e.target.closest('.v2-swipe-row')) {
          e.stopPropagation();
          e.preventDefault();
        }
      },
      true,
    );
  })();
}
