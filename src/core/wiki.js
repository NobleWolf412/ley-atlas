// Finding and trimming a Wikipedia article for a site (pure: no DOM, no network)
import { fold } from './text-search.js';

/** { lang, title } from a Wikipedia page address, or null. */
export function wikiRef(url) {
  const m = /^https?:\/\/([a-z-]+)\.wikipedia\.org\/wiki\/([^?#]+)/.exec(String(url || ''));
  if (!m) return null;
  let title = m[2];
  try {
    title = decodeURIComponent(title);
  } catch (e) {
    /* keep as written */
  }
  return { lang: m[1], title: title.replace(/_/g, ' ') };
}

/** A Wikidata id ("Q1476429") found in a string or address, or null. */
export function wikidataId(s) {
  const m = /\bQ\d+\b/.exec(String(s || ''));
  return m ? m[0] : null;
}

const STOP = new Set(['the', 'of', 'de', 'di', 'du', 'la', 'le', 'a', 'at', 'in', 'near', 'and', 'fort']);
const words = s =>
  fold(s)
    .replace(/\(.*?\)/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter(w => w.length > 1 && !STOP.has(w));

/** How alike two place names are, 0 to 1 (share of the shorter name's words found in the other). */
export function nameMatch(a, b) {
  const A = words(a),
    B = new Set(words(b));
  if (!A.length || !B.size) return 0;
  const hit = A.filter(w => B.has(w)).length;
  return hit / Math.min(A.length, B.size);
}

/**
 * Pick the nearby article that is about this site, or null when none clearly is.
 * @param name the site's name  @param nearby [{ title, dist }] articles near its coordinates
 */
export function pickNearby(name, nearby) {
  let best = null;
  for (const r of nearby || []) {
    const score = nameMatch(name, r.title);
    if (score >= 0.99 && (!best || r.dist < best.dist)) best = r;
  }
  return best;
}

/** The first sentences of an article extract, up to about `max` characters. */
export function shortExtract(text, max = 320) {
  const t = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max),
    end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('.) '));
  return end > max * 0.4 ? cut.slice(0, end + 1) : cut.slice(0, cut.lastIndexOf(' ')) + '…';
}
