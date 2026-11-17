// Builds the site list from all datasets
import { GEO } from '../core/geo.js';
import { SITES } from '../data/catalog.js';
import {
  CASTLES,
  FORTS_EXT,
  FORT_OUTLINES,
  MEGALITHS,
  NEAR,
  PLEIADES,
  ROMAN,
  UNESCO,
  WONDERS,
} from '../data/datasets.js';
import { S } from '../state/state.js';

// ================= points =================
export const AUTO = {};
export const BASE = [];
let PLROMAN;
export let ALLP = [],
  PT = new Map(),
  FORTS = [];
export function rebuildPoints() {
  ALLP = BASE.slice();
  const positions = new Map(ALLP.map((p, index) => [p.id, index]));
  for (const im of S.imports)
    for (const r of im.rows) {
      const existingIndex = r.matchedSiteId ? positions.get(r.matchedSiteId) : undefined;
      if (
        existingIndex !== undefined &&
        r.coordinateSource === 'Atlas match' &&
        GEO.dist(ALLP[existingIndex].lat, ALLP[existingIndex].lon, r.lat, r.lon) < 0.01
      ) {
        const existing = ALLP[existingIndex];
        ALLP[existingIndex] = {
          ...existing,
          importIds: [...new Set([...(existing.importIds || []), im.id])],
        };
        continue;
      }
      positions.set(r.id, ALLP.length);
      ALLP.push({
        id: r.id,
        n: r.n,
        lat: r.lat,
        lon: r.lon,
        cat: r.cat,
        set: 'import',
        imp: im.id,
        unc: r.unc || 0,
        cls: 'import',
        reg: r.reg || im.name,
        use: r.note || '',
        srcLabel: 'Imported from ' + im.name,
        srcUrl: r.url || null,
        coordinateSource: r.coordinateSource || null,
      });
    }
  for (const m of S.markers) ALLP.push({ ...m, cat: 'marker', set: 'marker', cls: 'user', unc: m.unc || 0 });
  for (const p of ALLP) if (!Array.isArray(p.v)) p.v = GEO.vec(p.lat, p.lon);
  PT = new Map(ALLP.map(p => [p.id, p]));
  FORTS = ALLP.filter(p => p.cat === 'fort');
  for (const p of FORTS)
    if (!p.fort)
      p.fort = {
        pts: null,
        salients: null,
        ptsNote: 'Imported fort: no traced outline.',
        center: 'Imported point',
      };
}
export const findPoint = id => PT.get(id);
export function srcOn(p) {
  if (p.importIds?.some(id => S.imports.some(im => im.id === id && im.on))) return true;
  if (p.set === 'import') {
    const im = S.imports.find(i => i.id === p.imp);
    return !!(im && im.on);
  }
  if (p.set === 'marker') return true;
  return S.src[p.set] !== false;
}
export const catOn = p => S.layers.cat[p.cat] !== false;
export const shownP = p => srcOn(p) && catOn(p);
export const enabledPoints = () => ALLP.filter(shownP);

export function initPoints() {
  for (const s of SITES) {
    const o = { ...s, set: 'core', v2: s.v };
    delete o.v;
    BASE.push(o);
  }
  for (const f of FORTS_EXT) {
    const sid = f.proj || 'sf-' + f.id;
    AUTO[sid] = { c: f.c, t: f.t, salients: f.pts, ol: FORT_OUTLINES[f.id] ? f.id : null, ext: f };
    if (f.proj) {
      const s = BASE.find(b => b.id === f.proj);
      s.ext = f;
      s.fort = { ...s.fort, salients: f.pts };
      if (f.c) {
        s.catPt = [s.lat, s.lon];
        s.lat = f.c[0];
        s.lon = f.c[1];
      }
      continue;
    }
    const c = f.c || [f.lat, f.lon];
    BASE.push({
      id: sid,
      n: f.n,
      lat: c[0],
      lon: c[1],
      catPt: f.c ? [f.lat, f.lon] : null,
      cat: 'fort',
      set: 'fort',
      reg: f.cc,
      unc: f.c ? 30 : 150,
      ext: f,
      cls: 'structure',
      built: f.y ? `${f.y}${f.ys ? ' (date from ' + f.ys + ')' : ''}` : null,
      fort: {
        pts: null,
        salients: f.pts,
        ptsNote: f.c
          ? `The traced outline has ${f.pts} salient point${f.pts === 1 ? '' : 's'} (bastions plus any ravelins or outworks). No documented bastion count in this dataset.`
          : 'Catalogue point only: no traced outline, so no bastion geometry yet.',
        center: f.c ? 'Centroid of the traced outline' : 'Catalogue point',
      },
      srcLabel: f.srcl || 'Hotham (2026) star-fort catalogue',
      srcUrl: f.srcu || 'https://github.com/Tristan-Hotham/star-forts',
      wikiUrl: f.w || null,
      use: [f.note, f.st ? 'Status: ' + f.st : ''].filter(Boolean).join(' '),
    });
  }
  for (const w of WONDERS)
    BASE.push({
      id: w.id,
      n: w.n,
      lat: w.lat,
      lon: w.lon,
      cat: w.cat,
      reg: w.reg,
      built: w.built,
      unc: w.unc,
      set: 'wonder',
      cls: w.cat === 'mountain' ? 'feature' : 'structure',
      srcLabel: `${w.src}: ${w.srcname}`,
      srcUrl: w.ref,
      wiki: w.wiki,
      use: w.note,
    });
  PLROMAN = new Set(ROMAN.plRoman);
  for (const p of PLEIADES)
    BASE.push({
      id: 'pl-' + p[3],
      roman: PLROMAN.has(p[3]) || undefined,
      n: p[0],
      lat: p[1],
      lon: p[2],
      cat: p[4].includes('pyramid') ? 'ruin' : 'temple',
      set: 'pleiades',
      unc: p[5],
      cls: 'structure',
      reg: 'Pleiades · ' + p[4].replace(/\//g, ', '),
      srcLabel: 'Pleiades gazetteer of ancient places',
      srcUrl: 'https://pleiades.stoa.org/places/' + p[3],
    });
  for (const u of UNESCO)
    BASE.push({
      id: 'un-' + u[4],
      n: u[0],
      lat: u[1],
      lon: u[2],
      cat: 'heritage',
      set: 'unesco',
      unc: 1000,
      cls: u[3] === 'n' ? 'feature' : 'structure',
      reg: `UNESCO · ${u[3] === 'c' ? 'cultural' : u[3] === 'n' ? 'natural' : 'mixed'} · ${u[5]}`,
      srcLabel: 'UNESCO World Heritage list (property point)',
      srcUrl: 'https://whc.unesco.org/en/list/' + u[4],
      use: 'UNESCO gives one point for the whole property, which can be large.',
    });
  {
    // Roman-era monuments (Pleiades, CC BY): precise locations only, attested 50 BC – AD 450, de-duplicated against the sites above
    const RW = {
      'fort-2': 'fort',
      'military-installation-or-camp-temporary': 'temporary camp',
      'temple-2': 'temple',
      'city-gate': 'city gate',
    };
    for (const [n, lat, lon, pid, ty, acc] of ROMAN.rows) {
      const kinds = [...new Set(ty.split('/').map(t => RW[t] || t))],
        k0 = kinds[0];
      const nm =
        /^untitled$/i.test(n) || !/\p{L}{2}/u.test(n)
          ? `Unnamed Roman ${k0}${/^\d+$/.test(n) ? ' (no. ' + n + ')' : ''}`
          : n;
      BASE.push({
        id: 'rm-' + pid,
        n: nm,
        lat,
        lon,
        cat: kinds.includes('temple') ? 'temple' : 'ruin',
        set: 'roman',
        roman: true,
        unc: acc,
        cls: 'structure',
        kind: 'Roman ' + k0,
        reg: 'Roman ' + kinds.join(', ') + ' · Pleiades',
        srcLabel: 'Pleiades gazetteer of ancient places (Roman period)',
        srcUrl: 'https://pleiades.stoa.org/places/' + pid,
      });
    }
  }
  {
    // castles (Castlemap, CC0)
    const CC = CASTLES.cat,
      CN = CASTLES.cc,
      CL = { castle: 'Castle', fortress: 'Fortress', palace: 'Palace', ruin: 'Castle ruin' };
    for (const r of CASTLES.rows) {
      const [n, lat, lon, ci, cc, yr, ap, rank, q, wt] = r,
        k = CC[ci];
      const wl = wt ? wt.split(':') : null;
      BASE.push({
        id: 'cs-' + q,
        n,
        lat,
        lon,
        cat: 'castle',
        set: 'castle',
        unc: 100,
        cls: 'structure',
        rank,
        kind: CL[k],
        reg: `${CL[k]} · ${CN[cc]}`,
        built: yr != null ? `${ap ? 'c. ' : ''}${yr < 0 ? -yr + ' BC' : yr}` : null,
        srcLabel: 'Castles of the World (Castlemap, CC0)',
        srcUrl: 'https://www.wikidata.org/wiki/' + q,
        wikiUrl: wl
          ? `https://${wl[0]}.wikipedia.org/wiki/${encodeURIComponent(wl.slice(1).join(':').replace(/ /g, '_'))}`
          : null,
        qid: q,
      });
    }
  }
  {
    // megaliths & precision stonework (Fralse 2026)
    const MC = { 'Nabta Playa': 1, 'Mausoleum of Theodoric': 1, Newgrange: 1, 'San Agustin': 1 },
      NOTM = { Kuelap: 1 };
    for (const x of MEGALITHS) {
      const stone = {
        masonry: x.masonry,
        precision: x.precision,
        tons: x.max_tons,
        rock: x.rock_cut,
        mohs: x.mohs,
        transport: x.transport_km,
        note: x.notes,
        name: x.name,
      };
      if (x.match) {
        const b = BASE.find(p => p.id === x.match);
        if (b) {
          b.stone = stone;
          continue;
        }
      }
      const mega =
        !NOTM[x.name] &&
        (x.rock_cut ||
          MC[x.name] ||
          (x.max_tons >= 10 && x.masonry <= 2) ||
          /dolmen|stone|menhir|trilithon|olmec/i.test(x.name));
      BASE.push({
        id: 'mg-' + x.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        n: x.name.replace(
          /\b(Gobekli|Nemrut Dag)\b/,
          m => ({ Gobekli: 'Göbekli', 'Nemrut Dag': 'Nemrut Dağ' })[m],
        ),
        lat: x.lat,
        lon: x.lon,
        cat: mega ? 'megalith' : 'ruin',
        set: 'megalith',
        unc: x.unc,
        cls: 'structure',
        reg: x.region,
        stone,
        srcLabel: 'Fralse (2026) megaliths dataset (approximate coordinates)',
        srcUrl: 'https://github.com/torbjorn-fralse/megaliths',
        use: x.notes,
      });
    }
  }
  {
    // Pleiades Roman records that sit on a site already in the atlas (within 300 m): flag that site as Roman instead of adding a duplicate
    const tok = s =>
      new Set(
        s
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .split(/[^a-z]+/)
          .filter(
            w =>
              w.length >= 4 &&
              !/^(roman|castle|villa|fort|temple|church|bridge|tower|gate|baths?|saint|santa|santo|chiesa|basilica)$/.test(
                w,
              ),
          ),
      );
    ROMAN.flagged = [];
    for (const [rn, la, lo] of ROMAN.dup) {
      const rt = tok(rn);
      for (const b of BASE) {
        if (b.roman || b.set === 'pleiades' || Math.abs(b.lat - la) > 0.004 || Math.abs(b.lon - lo) > 0.006)
          continue;
        const d = GEO.dist(b.lat, b.lon, la, lo);
        if (d > 0.3) continue;
        // same place only if very close, or close and the names share a word (avoids tagging St Peter's because a Roman circus lay beside it)
        if (d < 0.06 || [...tok(b.n)].some(w => rt.has(w))) {
          b.roman = true;
          b.reg = (b.reg ? b.reg + ' · ' : '') + 'Roman-period site here (Pleiades: ' + rn + ')';
          ROMAN.flagged.push(b.n + ' ⇐ ' + rn + ' ' + d.toFixed(2));
        }
      }
    }
  }
  // nearest town (GeoNames, places of 1,000+ people, CC BY) so look-alike names can be told apart, e.g. the two forts called De Schans
  for (const s of BASE) {
    const t = NEAR[s.id];
    if (!t) continue;
    s.near = t;
    s.reg = (s.reg ? s.reg + ' · ' : '') + t;
    // unnamed catalogue forts were labelled with the nearest *large* city (often 30–100 km off, e.g. Den Helder forts called "near Haarlem"); relabel with the actual nearest town
    if (
      s.set === 'fort' &&
      s.ext &&
      s.ext.nf === 'nearest town (Natural Earth)' &&
      /^Star fort (near|at) /.test(s.n)
    ) {
      const town = t.replace(/^(in |.* of )/, '').split(',')[0],
        was = s.n;
      s.n = (t.startsWith('in ') ? 'Star fort at ' : 'Star fort near ') + town;
      if (s.n !== was)
        s.use = [
          s.use,
          `Unnamed in the source; its catalogue label was “${was}”, after the nearest large city.`,
        ]
          .filter(Boolean)
          .join(' ');
    }
  }
  {
    // several different sites share one name (7 forts are just "Schans" = Dutch for a small earthwork fort): add the town so each label is unique
    const groups = new Map();
    for (const s of BASE)
      if (s.near && (s.set === 'fort' || s.set === 'castle')) {
        const k = s.set + '|' + s.n;
        (groups.get(k) || groups.set(k, []).get(k)).push(s);
      }
    const town = t => t.replace(/^(in |.* of )/, '').split(',')[0],
      rel = t => (t.startsWith('in ') ? 'in ' + town(t) : t.replace(/^[\d.]+ km /, '').split(',')[0]);
    for (const g of groups.values()) {
      if (g.length < 2) continue;
      const byTown = new Map();
      for (const s of g) {
        const k = town(s.near);
        byTown.set(k, (byTown.get(k) || 0) + 1);
      }
      for (const s of g) {
        s.baseName = s.n;
        s.n = `${s.n} (${byTown.get(town(s.near)) > 1 ? rel(s.near) : town(s.near)})`;
      }
      const seen = new Map();
      for (const s of g) {
        const n = seen.get(s.n) || 0;
        seen.set(s.n, n + 1);
        if (n) s.n = s.n.replace(/\)$/, `, ${n + 1})`);
      }
    }
  }
  rebuildPoints();
}
