// Pure import parsing shared by file mapping and the guided paste workflow.
import { parseCoords } from './coordinates.js';
export function splitCSV(text) {
  const first = text.split(/\r?\n/).find(l => l.trim()) || '';
  const cnt = ch => {
    let n = 0,
      q = false;
    for (const c of first) {
      if (c === '"') q = !q;
      else if (!q && c === ch) n++;
    }
    return n;
  };
  const delim = [',', ';', '\t', '|'].sort((a, b) => cnt(b) - cnt(a))[0];
  const rows = [];
  let row = [],
    f = '',
    q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          f += '"';
          i++;
        } else q = false;
      } else f += c;
      continue;
    }
    if (c === '"') q = true;
    else if (c === delim) {
      row.push(f);
      f = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(f);
      f = '';
      if (row.some(x => x.trim() !== '')) rows.push(row);
      row = [];
    } else f += c;
  }
  row.push(f);
  if (row.some(x => x.trim() !== '')) rows.push(row);
  return { rows, delim };
}

const COLS = {
  name: /^(name|title|site|label|n|place|monument|fort|nombre|nom|itemlabel|item_label)$/i,
  lat: /^(lat|latitude|y|lat_dd|lat_y|breite)$/i,
  lon: /^(lon|lng|long|longitude|x|lon_dd|long_x|laenge|länge)$/i,
  coords: /^(coords?|coordinates|location|position|latlon|lat_lon|wkt|geometry|point)$/i,
  cat: /^(category|type|kind|class|cat|tipo|site_type|network_category)$/i,
  note: /^(notes?|description|desc|comment|details|descripcion)$/i,
  unc: /^(uncertainty_m|uncertainty|unc|accuracy|accuracy_m)$/i,
  url: /^(url|source|source_url|link|wikipedia|href|item|wikidata)$/i,
  reg: /^(region|country|reg|area|pais|state)$/i,
};

export function guessCat(s) {
  s = (s || '').toLowerCase();
  if (/star.?fort|bastion|sconce|redoubt|schanze|ravelin|vauban|trace italienne/.test(s)) return 'fort';
  if (
    /castle|citadel|fortress|festung|kastell|palace|château|chateau|castell|castillo|burg\b|keep\b|\bfort\b/.test(
      s,
    )
  )
    return 'castle';
  if (/dolmen|megalith|monolith|trilithon|rock.?cut|rock.?hewn|passage tomb|cromlech|quoit|polygonal/.test(s))
    return 'megalith';
  if (/obelisk|menhir|standing stone|stone|circle|stele|henge|moai/.test(s)) return 'obelisk';
  if (/church|cathedral|abbey|monaster|basilica|chapel|minster|priory|convent/.test(s)) return 'church';
  if (/temple|shrine|sanctuar|sacred|mosque|pagoda|stupa|oracle|holy|ziggurat|ley|node/.test(s))
    return 'temple';
  if (/mount|mountain|hill|peak|volcano|rock|cave|spring|tor\b|tepui|natural/.test(s)) return 'mountain';
  if (/ruin|tomb|pyramid|mound|barrow|archaeo|necropolis|site|city|tumulus/.test(s)) return 'ruin';
  return 'landmark';
}

export function parseImport(text) {
  text = text.replace(/^\uFEFF/, '');
  const t = text.trim();
  if (t.startsWith('{') || t.startsWith('[')) {
    let g;
    try {
      g = JSON.parse(t);
    } catch (e) {
      return { err: 'That looks like JSON but could not be read.' };
    }
    if (!g || typeof g !== 'object') return { err: 'Choose a GeoJSON feature or feature collection.' };
    const feats =
      g.type === 'FeatureCollection' ? g.features : Array.isArray(g) ? g : g.type === 'Feature' ? [g] : [];
    if (!Array.isArray(feats)) return { err: 'This GeoJSON needs a list of features.' };
    const rows = [],
      skipped = [];
    feats.forEach((f, i) => {
      const gm = f && f.geometry;
      let c = null;
      if (gm && gm.type === 'Point') c = gm.coordinates;
      else if (gm && gm.type === 'MultiPoint' && Array.isArray(gm.coordinates) && gm.coordinates.length)
        c = gm.coordinates[0];
      else if (gm && (gm.type === 'Polygon' || gm.type === 'MultiPolygon')) {
        const ring = gm.type === 'Polygon' ? gm.coordinates?.[0] : gm.coordinates?.[0]?.[0];
        if (
          Array.isArray(ring) &&
          ring.length &&
          ring.every(p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]))
        ) {
          c = [
            ring.reduce((a, p) => a + p[0], 0) / ring.length,
            ring.reduce((a, p) => a + p[1], 0) / ring.length,
          ];
        }
      }
      const pr = (f && f.properties) || {};
      if (!c || !isFinite(c[0]) || !isFinite(c[1]) || Math.abs(c[1]) > 90 || Math.abs(c[0]) > 180) {
        skipped.push(i + 1);
        return;
      }
      const nm = pr.name || pr.title || pr.n || pr.label || `Feature ${i + 1}`;
      rows.push({
        n: String(nm),
        lat: +c[1],
        lon: +c[0],
        raw: String(pr.category || pr.type || pr.kind || '').trim(),
        note: pr.description || pr.notes || '',
        url: pr.url || pr.source || pr.wikipedia || '',
        reg: pr.country || pr.region || '',
      });
    });
    return { kind: 'GeoJSON', fixed: { rows, skipped }, total: feats.length };
  }
  const { rows: raw, delim } = splitCSV(text);
  if (!raw.length) return { err: 'No rows found.' };
  const head = raw[0].map(h => h.trim().replace(/^"|"$/g, ''));
  const numericCells = head.filter(h => /^[-+]?\d+(?:[.,]\d+)?$/.test(h)).length;
  const hasHeader =
    numericCells < 2 &&
    (head.some(h => Object.values(COLS).some(re => re.test(h))) ||
      !head.some(h => parseCoords(h).length || /POINT\s*\(/i.test(h)));

  const headers = hasHeader ? head : head.map((_, i) => `Column ${i + 1}`);
  const body = hasHeader ? raw.slice(1) : raw;
  const find = key => headers.findIndex(h => COLS[key].test(h));
  const map = {
    name: find('name'),
    lat: find('lat'),
    lon: find('lon'),
    coords: find('coords'),
    cat: find('cat'),
    note: find('note'),
    unc: find('unc'),
    url: find('url'),
    reg: find('reg'),
  };
  if (map.lat < 0 && map.coords < 0) {
    const numeric = headers.map((_, i) =>
      body.slice(0, 20).every(r => r[i] !== undefined && r[i].trim() !== '' && isFinite(+r[i])),
    );
    const ni = numeric.map((v, i) => (v ? i : -1)).filter(i => i >= 0);
    if (ni.length >= 2) {
      map.lat = ni[0];
      map.lon = ni[1];
    }
  }
  if (map.name < 0)
    map.name = headers.findIndex((_, i) => i !== map.lat && i !== map.lon && i !== map.coords);
  return { kind: 'CSV', headers, body, map, delim, hasHeader };
}

export function rowsFromMap(p) {
  if (p.fixed) return p.fixed;
  const rows = [],
    skipped = [],
    m = p.map;
  const num = v => {
    const s = String(v ?? '')
      .trim()
      .replace(/^(-?\d+),(\d+)$/, '$1.$2');
    return /^[-+]?\d+(\.\d+)?$/.test(s) ? +s : NaN;
  };
  p.body.forEach((r, i) => {
    let lat = NaN,
      lon = NaN;
    if (m.lat >= 0 && m.lon >= 0) {
      lat = num(r[m.lat]);
      lon = num(r[m.lon]);
    }
    if ((!isFinite(lat) || !isFinite(lon)) && m.coords >= 0) {
      const s = String(r[m.coords] || '');
      const wkt = /POINT\s*\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)/i.exec(s);
      if (wkt) {
        lon = +wkt[1];
        lat = +wkt[2];
      } else {
        const c = parseCoords(s)[0];
        if (c) [lat, lon] = c;
      }
    }
    if ((!isFinite(lat) || !isFinite(lon)) && m.lat >= 0 && m.lon >= 0) {
      const c = parseCoords(`${r[m.lat]} ${r[m.lon]}`)[0];
      if (c) [lat, lon] = c;
    }
    if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      skipped.push(i + (p.hasHeader ? 2 : 1));
      return;
    }
    const n = (m.name >= 0 ? r[m.name] : '') || `Row ${i + 1}`;
    rows.push({
      n: String(n).trim(),
      lat,
      lon,
      raw: m.cat >= 0 ? String(r[m.cat] || '').trim() : '',
      note: m.note >= 0 ? r[m.note] : '',
      url: m.url >= 0 && /^https?:/i.test(r[m.url] || '') ? r[m.url] : '',
      unc: m.unc >= 0 ? +r[m.unc] || 0 : 0,
      reg: m.reg >= 0 ? r[m.reg] : '',
    });
  });
  return { rows, skipped };
}
