import { RESEARCH_RECORDS, RESEARCH_SOURCES } from '../data/research.js';
import { normalizeResearch } from '../core/research.js';
import { ALLP } from './points.js';
import { GEO } from '../core/geo.js';

let library;
import { RESEARCH_SOURCE_ENTRIES } from '../data/research-entries.js';

export function researchLibrary() {
  if (!library) library = normalizeResearch(RESEARCH_RECORDS, RESEARCH_SOURCES, RESEARCH_SOURCE_ENTRIES);
  return library;
}
export function researchRecord(id) {
  return researchLibrary().collections.find(r => r.id === id);
}
export function linkedAtlasSite(member) {
  // Never merge solely by proximity: preserve the original source position.
  const fold = s =>
    s
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  return (
    ALLP.find(
      p =>
        (p.id === member.siteId || fold(p.n) === fold(member.name)) &&
        GEO.dist(p.lat, p.lon, member.lat, member.lon) < 5,
    ) || null
  );
}
export function siteResearchRecords(site) {
  if (!site) return [];
  return researchLibrary().collections.filter(r => r.members.some(m => linkedAtlasSite(m)?.id === site.id));
}
