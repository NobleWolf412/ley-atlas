import { fold } from './text-search.js';
import { GEO } from './geo.js';

export const IMPORT_LIST_LIMIT = 500;
const valid = (lat, lon) =>
  Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
export const importName = text =>
  fold(text)
    .replace(/[’']/g, '')
    .replace(/\bst\.?\s/g, 'saint ')
    .replace(/\bmt\.?\s/g, 'mount ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/^the /, '');

// Returns source spans too, so the place label can be separated without retyping.
export function pastedCoordinates(text) {
  const wkt = /POINT\s*\(\s*([-+]?\d+(?:\.\d+)?)\s+([-+]?\d+(?:\.\d+)?)\s*\)/i.exec(text);
  if (wkt)
    return valid(+wkt[2], +wkt[1])
      ? { lat: +wkt[2], lon: +wkt[1], start: wkt.index, end: wkt.index + wkt[0].length }
      : { invalid: true };
  const dms =
    /(\d+(?:\.\d+)?)\s*°\s*(\d+(?:\.\d+)?)?\s*['′]?\s*(\d+(?:\.\d+)?)?\s*["″]?\s*([NS])\s*[,;\s]+(\d+(?:\.\d+)?)\s*°\s*(\d+(?:\.\d+)?)?\s*['′]?\s*(\d+(?:\.\d+)?)?\s*["″]?\s*([EW])/i.exec(
      text,
    );
  if (dms) {
    const lat = (+dms[1] + (+dms[2] || 0) / 60 + (+dms[3] || 0) / 3600) * (/s/i.test(dms[4]) ? -1 : 1),
      lon = (+dms[5] + (+dms[6] || 0) / 60 + (+dms[7] || 0) / 3600) * (/w/i.test(dms[8]) ? -1 : 1);
    if (
      (+dms[2] || 0) >= 60 ||
      (+dms[3] || 0) >= 60 ||
      (+dms[6] || 0) >= 60 ||
      (+dms[7] || 0) >= 60 ||
      !valid(lat, lon)
    )
      return { invalid: true };
    return { lat, lon, start: dms.index, end: dms.index + dms[0].length };
  }
  const decimal = /([-+]?\d+(?:\.\d+)?)\s*°?\s*([NS])\s*[,;\s]+([-+]?\d+(?:\.\d+)?)\s*°?\s*([EW])/i.exec(
    text,
  );
  if (decimal) {
    const lat = Math.abs(+decimal[1]) * (/s/i.test(decimal[2]) ? -1 : 1),
      lon = Math.abs(+decimal[3]) * (/w/i.test(decimal[4]) ? -1 : 1);
    return valid(lat, lon)
      ? { lat, lon, start: decimal.index, end: decimal.index + decimal[0].length }
      : { invalid: true };
  }
  const pair =
    /(?:latitude\s*[:=]?\s*|lat\s*[:=]?\s*)?([-+]?\d+(?:\.\d+)?)\s*[,;\t ]+\s*(?:(?:longitude|lon|lng)\s*[:=]?\s*)?([-+]?\d+(?:\.\d+)?)/i.exec(
      text,
    );
  if (
    pair &&
    (pair[1].includes('.') ||
      pair[2].includes('.') ||
      /lat(?:itude)?\s*[:=]/i.test(pair[0]) ||
      (pair[0].trim() === text.trim() && /[,;]/.test(pair[0])))
  ) {
    // Maps /@latitude,longitude and ?q=latitude,longitude retain the explicit order.
    if (!valid(+pair[1], +pair[2])) return { invalid: true };
    return { lat: +pair[1], lon: +pair[2], start: pair.index, end: pair.index + pair[0].length };
  }
  return null;
}

export function readPastedSites(text) {
  if (text.length > 1000000)
    return { error: 'This paste is too large. Upload a CSV or GeoJSON file for a larger collection.' };
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean);
  if (lines.length > IMPORT_LIST_LIMIT)
    return { error: `Paste up to ${IMPORT_LIST_LIMIT} lines at a time, or upload a file.` };
  const entries = [];
  for (const [index, original] of lines.entries()) {
    const clean = original.replace(/^(?:[-*•▪–—]\s+|\d+[.)]\s+)/, '').trim();
    if (!clean) continue;
    const location = pastedCoordinates(clean);
    const label =
      location && !location.invalid
        ? (clean.slice(0, location.start) + clean.slice(location.end))
            .replace(/https?:\/\/\S+/g, '')
            .replace(/^[\s,;:|(@]+|[\s,;:|()]+$/g, '')
            .trim()
        : clean;
    const previous = entries.at(-1);
    if (location && !location.invalid && !label && previous && !previous.location && !previous.invalid) {
      previous.location = { lat: location.lat, lon: location.lon };
      previous.original += '\n' + original;
      continue;
    }
    entries.push({
      id: index,
      label: label || `Pasted location ${entries.length + 1}`,
      original,
      location: location && !location.invalid ? { lat: location.lat, lon: location.lon } : null,
      invalid: location?.invalid === true,
    });
  }
  return entries.length ? { entries } : { error: 'Paste a place name, list or coordinates to begin.' };
}

export function importSearchIndex(points) {
  return points
    .filter(p => valid(p.lat, p.lon))
    .map(p => ({
      id: p.id,
      n: p.n,
      lat: p.lat,
      lon: p.lon,
      cat: p.cat,
      reg: p.reg || p.country || '',
      unc: p.unc || 0,
      url: p.srcUrl || p.wikiUrl || '',
      sourceLabel:
        p.srcLabel ||
        {
          core: 'Project catalogue',
          wonder: 'World wonders',
          unesco: 'UNESCO World Heritage',
          fort: 'Star fort catalogue',
          pleiades: 'Pleiades',
          castle: 'Castle catalogue',
          megalith: 'Megalith catalogue',
          roman: 'Roman-era catalogue',
          import: 'Imported collection',
          marker: 'Your marker',
        }[p.set] ||
        'Atlas record',
      name: importName(p.n),
      context: importName(`${p.n} ${p.reg || ''} ${p.country || ''}`),
    }));
}

export function findImportMatches(query, index, limit = 8) {
  const name = importName(query),
    words = name.split(' ').filter(Boolean);
  if (!words.length) return [];
  const scored = [];
  for (const site of index) {
    const tokens = site.context.split(' ');
    if (!words.every(w => tokens.includes(w) || (w.length >= 3 && tokens.some(t => t.startsWith(w)))))
      continue;
    const score =
      site.name === name
        ? 100
        : site.name.startsWith(name)
          ? 90
          : words.every(w => site.name.split(' ').includes(w))
            ? 85
            : 70;
    scored.push({ ...site, score });
  }
  scored.sort(
    (a, b) => b.score - a.score || a.n.localeCompare(b.n) || String(a.id).localeCompare(String(b.id)),
  );
  const unique = [];
  for (const site of scored) {
    if (unique.some(p => p.name === site.name && GEO.dist(p.lat, p.lon, site.lat, site.lon) < 0.3)) continue;
    unique.push(site);
    if (unique.length >= limit) break;
  }
  return unique;
}

export function prepareImportReview(entries, index) {
  return entries.map(entry => {
    const candidates = entry.invalid ? [] : findImportMatches(entry.label, index);
    const exact = candidates.filter(c => c.score === 100);
    const choice = !entry.location && exact.length === 1 ? exact[0] : null;
    return {
      ...entry,
      candidates,
      choice,
      selected: !!entry.location || !!choice,
      coordinateSource: entry.location ? 'Pasted coordinates' : choice ? 'Atlas match' : null,
    };
  });
}

export function reviewedImportRows(entries) {
  const rows = [],
    seen = new Set();
  for (const e of entries) {
    if (!e.selected) continue;
    const position = e.location || e.choice;
    if (!position || !valid(position.lat, position.lon)) continue;
    const key = e.choice
      ? `atlas:${e.choice.id}`
      : `point:${importName(e.label)}:${position.lat.toFixed(6)},${position.lon.toFixed(6)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      n: e.choice?.n || e.label,
      lat: position.lat,
      lon: position.lon,
      raw: e.choice?.cat || '',
      cat: e.choice?.cat,
      reg: e.choice?.reg || '',
      unc: e.choice?.unc || 0,
      url: e.choice?.url || '',
      note: 'Imported from a reviewed pasted list.',
      matchedSiteId: e.choice?.id || null,
      coordinateSource: e.coordinateSource,
      originalText: e.original,
    });
  }
  return rows;
}
