// Site icons as SVG markup (used in lists, chips and the map key)
import { DISPBY } from '../domain/categories.js';
import { C } from './palette.js';

export function iconSvg(p) {
  const k =
    p.set === 'roman'
      ? 'roman'
      : p.set === 'pleiades'
        ? 'pleiades'
        : p.set === 'unesco'
          ? 'heritage'
          : p.set === 'marker'
            ? 'marker'
            : p.cat;
  return sw(k)
    .replace(/^<svg[^>]*>/, '')
    .replace(/<\/svg>$/, '');
}

export function dispIcon(k) {
  if (k === 'all')
    return `<svg viewBox="-9 -9 18 18" aria-hidden="true"><circle cx="-3.5" cy="-3" r="3" fill="${C.church}"/><circle cx="3.5" cy="-3" r="3" fill="${C.star}"/><circle cx="0" cy="3.5" r="3" fill="${C.temple}"/></svg>`;
  if (k === 'roman')
    return `<svg viewBox="-9 -9 18 18" aria-hidden="true">${iconSvg({ set: 'roman' })}</svg>`;
  if (k === 'pyramid')
    return `<svg viewBox="-9 -9 18 18" aria-hidden="true"><path d="M-9 7L0 -8L9 7Z" fill="${C.amber}" stroke="${C.iconEdge}" stroke-width=".8"/><path d="M-4.5 -0.5H4.5M-7 3.5H7" stroke="${C.iconEdge}" stroke-width=".7"/></svg>`;
  return `<svg viewBox="-9 -9 18 18" aria-hidden="true">${iconSvg({ cat: DISPBY[k][3] })}</svg>`;
}
export const siteIcon = p => `<svg class="ic" viewBox="-9 -9 18 18" aria-hidden="true">${iconSvg(p)}</svg>`;

// ================= LAYERS pane =================
export function sw(kind) {
  const L = (c, d = '', w = 2.4) =>
    `<svg class="sw" viewBox="0 0 30 18" aria-hidden="true"><line x1="2" y1="9" x2="28" y2="9" stroke="${c}" stroke-width="${w}" stroke-dasharray="${d}" stroke-linecap="round"/></svg>`;
  const I = inner => `<svg class="sw" viewBox="-15 -9 30 18" aria-hidden="true">${inner}</svg>`;
  const star = (r1, r2, f) =>
    `<polygon points="${Array.from({ length: 10 }, (_, i) => {
      const r = i % 2 ? r2 : r1,
        a = -Math.PI / 2 + (i * Math.PI) / 5;
      return (Math.cos(a) * r).toFixed(1) + ',' + (Math.sin(a) * r).toFixed(1);
    }).join(' ')}" fill="${f}" stroke="${C.iconEdge}" stroke-width="0.8"/>`;
  return (
    {
      primary: L(C.gold, '', 3),
      bestfit: L(C.gold, '6 4'),
      sword: L(C.purple, '8 3 2 3'),
      torsap: L(C.purple, '8 3 2 3'),
      swordfit: L(C.purple, '5 5', 1.6),
      torsapfit: L(C.purple, '5 5', 1.6),
      meridian: L(C.green),
      viasacra: L(C.green, '', 3),
      user: L(C.cyan, '6 3'),
      corridor: L(C.corridor, '2 3', 1.4),
      border: L(C.border, '4 3', 1.2),
      river: L(C.river, '', 2),
      intersections: I(
        `<circle r="6" fill="none" stroke="${C.red}" stroke-width="2"/><circle r="2" fill="${C.red}"/>`,
      ),
      duff: I(`<circle r="6.5" fill="none" stroke="${C.purple}" stroke-width="1.6" stroke-dasharray="2 2"/>`),
      outline: I(
        `<polygon points="0,-8 3,-3 8,-3 4,1 6,7 0,3 -6,7 -4,1 -8,-3 -3,-3" fill="${C.olFill}" stroke="${C.olEdge}" stroke-width="1.2"/>`,
      ),
      places: I(
        `<circle cx="-9" r="2" fill="${C.place}"/><text x="-5" y="3.5" font-size="8" fill="${C.place}" font-family="sans-serif">Roma</text>`,
      ),
      label: I(
        `<text x="-11" y="4" font-size="10" fill="${C.text}" font-family="sans-serif" font-weight="700">Abc</text>`,
      ),
      sat: I(
        `<rect x="-9" y="-6" width="18" height="12" rx="2" fill="#3d4a3a"/><path d="M-9 3 L-2 -2 L3 2 L9 -3 V6 H-9Z" fill="#5a6b4f"/>`,
      ),
      fort: I(star(7.5, 3, C.star)),
      obelisk: I(
        `<polygon points="0,-8 2.4,-5 2.8,6 -2.8,6 -2.4,-5" fill="${C.obelisk}" stroke="${C.iconEdge}" stroke-width="0.9"/>`,
      ),
      temple: I(
        `<polygon points="-7,-2 0,-7 7,-2" fill="${C.temple}"/><rect x="-6" y="-1" width="12" height="6" fill="${C.temple}"/>`,
      ),
      church: I(
        `<rect x="-1.7" y="-8" width="3.4" height="15" fill="${C.church}"/><rect x="-6" y="-4" width="12" height="3.4" fill="${C.church}"/>`,
      ),
      ruin: I(
        `<rect x="-5" y="-5" width="10" height="10" fill="${C.ruin}" stroke="${C.iconEdge}" stroke-width="0.8"/>`,
      ),
      mountain: I(`<polygon points="-8,6 0,-7 8,6" fill="${C.mountain}"/>`),
      landmark: I(`<circle r="5" fill="${C.landmark}" stroke="${C.iconEdge}" stroke-width="0.8"/>`),
      heritage: I(
        `<circle r="2.6" fill="${C.dotUn}"/><circle cx="-7" cy="2" r="2" fill="${C.dotUn}"/><circle cx="7" cy="-2" r="2" fill="${C.dotUn}"/>`,
      ),
      pleiades: I(
        `<circle r="2.6" fill="${C.dotPle}"/><circle cx="-7" cy="2" r="2" fill="${C.dotPle}"/><circle cx="7" cy="-2" r="2" fill="${C.dotPle}"/>`,
      ),
      castle: I(
        `<polygon points="-6,7 -6,-8 -3.6,-8 -3.6,-5.2 -1.2,-5.2 -1.2,-8 1.2,-8 1.2,-5.2 3.6,-5.2 3.6,-8 6,-8 6,7" fill="${C.castle}" stroke="${C.iconEdge}" stroke-width="0.8"/>`,
      ),
      castlesrc: I(
        `<polygon points="-6,7 -6,-8 -3.6,-8 -3.6,-5.2 -1.2,-5.2 -1.2,-8 1.2,-8 1.2,-5.2 3.6,-5.2 3.6,-8 6,-8 6,7" fill="${C.castle}"/>`,
      ),
      megalith: I(
        `<rect x="-6.5" y="-3" width="3.6" height="10" fill="${C.megalith}"/><rect x="2.9" y="-3" width="3.6" height="10" fill="${C.megalith}"/><rect x="-8" y="-7.5" width="16" height="3.6" fill="${C.megalith}"/>`,
      ),
      roman: I(
        `<path d="M-7.5 -4L0 -8L7.5 -4Z" fill="${C.roman}"/><rect x="-6" y="-3" width="2.4" height="8" fill="${C.roman}"/><rect x="-1.2" y="-3" width="2.4" height="8" fill="${C.roman}"/><rect x="3.6" y="-3" width="2.4" height="8" fill="${C.roman}"/><rect x="-7.5" y="5" width="15" height="2" fill="${C.roman}"/>`,
      ),
      stonework: I(
        `<polygon points="0,-8 8,0 0,8 -8,0" fill="none" stroke="${C.stoneRing}" stroke-width="2"/>`,
      ),
      ...Object.fromEntries(
        ['iron', 'copper', 'silver', 'gold', 'leadzinc', 'crystal', 'other'].map(g => [
          'ug-' + g,
          I(
            `<polygon points="0,-5 5,0 0,5 -5,0" fill="${C.dep[g]}"/><polygon points="-8,-2 -5,1 -8,4 -11,1" fill="${C.dep[g]}" opacity=".6"/><polygon points="8,-4 11,-1 8,2 5,-1" fill="${C.dep[g]}" opacity=".6"/>`,
          ),
        ]),
      ),
      faults: L(C.fault, '', 1.8),
      plates: L(C.plate, '7 4', 2.2),
      mag: I(
        `<rect x="-12" y="-6" width="8" height="12" fill="#3d6fd8" opacity=".8"/><rect x="-4" y="-6" width="8" height="12" fill="#e8e8e8"/><rect x="4" y="-6" width="8" height="12" fill="#d8433d" opacity=".8"/>`,
      ),
      marker: I(`<circle r="5" fill="${C.marker}" stroke="${C.iconEdge}" stroke-width="0.8"/>`),
      import: I(
        `<circle r="5" fill="${C.marker}"/><path d="M-2 0h4M0-2v4" stroke="#fff" stroke-width="1.4"/>`,
      ),
      core: I(
        `<rect x="-1.4" y="-7" width="2.8" height="13" fill="${C.church}"/><rect x="-5" y="-3.5" width="10" height="2.8" fill="${C.church}"/>`,
      ),
      wonder: I(
        `<polygon points="-9,6 -4,-2 1,6" fill="${C.ruin}"/><polygon points="-1,6 4,-4 9,6" fill="${C.temple}"/>`,
      ),
      fortsrc: I(
        star(5, 2, C.star) +
          `<g transform="translate(-8 3)">${star(3.5, 1.5, C.star)}</g><g transform="translate(8 -2)">${star(3.5, 1.5, C.star)}</g>`,
      ),
      unesco: I(
        `<circle r="2.6" fill="${C.dotUn}"/><circle cx="-7" cy="2" r="2" fill="${C.dotUn}"/><circle cx="7" cy="-2" r="2" fill="${C.dotUn}"/>`,
      ),
    }[kind] || ''
  );
}
