// Display categories
import { V2 } from '../state/preferences.js';

// ---------- display categories (built from the existing site types) ----------
const ROMAN_RE =
  /\b(roman|romano|romana|romani|romain|römisch|forum|amphithe|aqueduct|aquedotto|colosseum|coliseum|thermae|terme|baths of|via appia|castrum|castra|limes|pantheon|hadrian|trajan|augustus|diocletian|ara pacis|circus|pompeii|herculaneum|ostia|leptis|timgad|djemila|jerash|palmyra|pont du gard|mithr|capitolium|praetorium|marcellus|arch of (constantine|titus|septimius))/i;
export const DISP = [
  ['all', 'All sites', p => true, 'all'],
  ['fort', 'Star forts', p => p.cat === 'fort', 'fort'],
  ['castle', 'Castles', p => p.cat === 'castle', 'castle'],
  ['megalith', 'Megaliths', p => p.cat === 'megalith' || p.cat === 'obelisk' || !!p.stone, 'megalith'],
  [
    'temple',
    'Ancient temples',
    p => p.cat === 'temple' || (p.cat === 'heritage' && /temple|shrine|sanctuar|pagoda|stupa/i.test(p.n)),
    'temple',
  ],
  [
    'roman',
    'Roman sites',
    p =>
      !!p.roman ||
      (p.set === 'unesco' ? /\broman|romain|römisch/i.test(p.n) : ROMAN_RE.test(p.n)) ||
      /\bRome\b|\bRoma\b/.test(p.reg || ''),
    'roman',
  ],
  [
    'pyramid',
    'Pyramids',
    p => /pyramid|piramide|ziggurat|mastaba/i.test(p.n) || /pyramid/i.test(p.reg || ''),
    'pyramid',
  ],
  [
    'church',
    'Churches & religious',
    p =>
      p.cat === 'church' ||
      (p.cat === 'heritage' && /cathedral|church|abbey|monaster|basilica|chapel|mosque/i.test(p.n)),
    'church',
  ],
  [
    'natural',
    'Natural landmarks',
    p => p.cat === 'mountain' || (p.cls === 'feature' && p.set !== 'marker'),
    'mountain',
  ],
  ['ruin', 'Ruins & tombs', p => p.cat === 'ruin', 'ruin'],
];
export let DISPBY;
export const DISP_CATS = {
  fort: ['fort'],
  castle: ['castle'],
  megalith: ['megalith', 'obelisk'],
  temple: ['temple'],
  church: ['church'],
  natural: ['mountain'],
  ruin: ['ruin'],
};
export const dispMatch = (k, p) => (DISPBY[k] || DISP[0])[2](p);
export const v2SiteVisible = s => V2.cat === 'all' || dispMatch(V2.cat, s);

export function initCategories() {
  DISPBY = Object.fromEntries(DISP.map(d => [d[0], d]));
}
