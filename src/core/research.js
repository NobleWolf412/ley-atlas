import { GEO } from './geo.js';

export const GEOMETRY_LABELS = {
  path: 'Site sequence',
  'great-circle': 'Great circle',
  meridian: 'Meridian',
  parallel: 'Latitude parallel',
  network: 'Network',
  cluster: 'Site cluster',
  conceptual: 'Context only',
};

export function validCoordinate(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

export function normalizeResearch(records, sources, sourceEntries = []) {
  const sourceIds = new Set(sources.map(s => s.id)),
    sites = new Map(),
    ids = new Set();
  const collections = records.map(raw => {
    if (!raw.id || ids.has(raw.id) || !GEOMETRY_LABELS[raw.type]) throw new Error('Invalid research record');
    ids.add(raw.id);
    if (!raw.sourceIds.length || raw.sourceIds.some(id => !sourceIds.has(id)))
      throw new Error('Missing research source');
    if (raw.type === 'meridian' && (!Number.isFinite(raw.longitude) || Math.abs(raw.longitude) > 180))
      throw new Error('Invalid meridian');
    if (raw.type === 'parallel' && (!Number.isFinite(raw.latitude) || Math.abs(raw.latitude) >= 90))
      throw new Error('Invalid parallel');
    const members = raw.rows.map(([id, name, lat, lon], index) => {
      if (!id || !name || !validCoordinate(lat, lon)) throw new Error('Invalid research coordinate');
      const position = {
        sourceEntryId: raw.tableIndex
          ? `dossier:table-${String(raw.tableIndex).padStart(2, '0')}:row-${String(index + 1).padStart(2, '0')}`
          : `${raw.sourceIds[0]}:${raw.id}:row-${index + 1}`,
        tableIndex: raw.tableIndex || null,
        rowIndex: index + 1,
        originalName: name,
        locationPrecision: /node|mount |mesa|grid|phoenix|corfu|rhodes|cusco/i.test(name)
          ? 'Broad location / review required'
          : 'Candidate location / accuracy unknown',
        uncertaintyM: null,
        datum: 'WGS84 assumed; source datum unspecified',
        lat,
        lon,
        sourceId: raw.sourceIds[0],
        section: raw.section,
        recordId: raw.id,
        index,
        status: 'Source coordinate · unverified',
      };
      const original = sourceEntries.find(e => e.id === position.sourceEntryId);
      if (original) {
        if (original.lat !== lat || original.lon !== lon) throw new Error('Source coordinate mismatch');
        Object.assign(position, {
          originalName: original.originalName,
          originalRegion: original.originalRegion,
          originalLatitude: original.originalLatitude,
          originalLongitude: original.originalLongitude,
        });
      }
      if (!sites.has(id)) sites.set(id, { id, name, aliases: [], positions: [], recordIds: [] });
      const site = sites.get(id);
      if (!site.aliases.includes(name)) site.aliases.push(name);
      site.positions.push(position);
      if (!site.recordIds.includes(raw.id)) site.recordIds.push(raw.id);
      return { siteId: id, name, ...position };
    });
    const record = { ...raw };
    delete record.rows;
    return {
      ...record,
      schemaVersion: 1,
      version: 1,
      slug: raw.id,
      editorial: { kind: 'hypothesis', status: 'needs_source_review' },
      status: 'Unverified research draft',
      members,
      claims: [
        {
          id: `${raw.id}:claim`,
          type: 'speculation',
          text: raw.claim,
          sourceIds: raw.sourceIds,
          section: raw.section,
          reviewStatus: 'unverified',
        },
        {
          id: `${raw.id}:editorial`,
          type: 'editorial_note',
          text: raw.caveat,
          sourceIds: raw.sourceIds,
          section: raw.section,
          reviewStatus: 'editorial',
        },
      ],
    };
  });
  return { collections, sites: [...sites.values()], sources: sources.map(s => ({ ...s })) };
}

export function researchSegments(record) {
  if (!record || !['path', 'great-circle', 'network'].includes(record.type)) return [];
  const pairs =
    record.type === 'network' ? record.edges || [] : record.members.slice(1).map((_, i) => [i, i + 1]);
  return pairs.flatMap(([a, b]) => {
    const A = record.members[a],
      B = record.members[b];
    if (!A || !B) return [];
    const km = GEO.dist(A.lat, A.lon, B.lat, B.lon);
    if (km < 0.025 || km > Math.PI * GEO.R - 0.025) return [];
    return [{ a, b, A, B, o: [A.lat, A.lon], brg: GEO.bearing(A.lat, A.lon, B.lat, B.lon), len: km }];
  });
}

export function referenceLine(record, model = 'endpoints') {
  const A = record?.members[0],
    B = record?.members.at(-1);
  if (!A || !B) return null;
  const km = GEO.dist(A.lat, A.lon, B.lat, B.lon);
  if (km < 0.025 || km > Math.PI * GEO.R - 0.025) return null;
  if (model === 'fit' && record.members.length > 2) {
    const fit = GEO.bestFit(record.members.map(m => [m.lat, m.lon]));
    if (!validCoordinate(...fit.o) || !Number.isFinite(fit.brg)) return null;
    return { o: fit.o, brg: fit.brg, len: Infinity, rmsKm: fit.rmsKm };
  }
  return { o: [A.lat, A.lon], brg: GEO.bearing(A.lat, A.lon, B.lat, B.lon), len: Infinity };
}

// GeoJSON uses [longitude, latitude]; the app's geodesy helpers use [latitude, longitude].
export function researchGeometry(record, reference = false, model = 'endpoints') {
  if (!record) return { type: 'FeatureCollection', features: [] };
  const features = record.members.map(m => ({
    type: 'Feature',
    properties: { kind: 'source-point', name: m.name, sourceId: m.sourceId },
    geometry: { type: 'Point', coordinates: [m.lon, m.lat] },
  }));
  const add = (coordinates, kind) =>
    features.push({ type: 'Feature', properties: { kind }, geometry: { type: 'LineString', coordinates } });
  if (reference && ['path', 'great-circle'].includes(record.type)) {
    const axis = referenceLine(record, model);
    if (axis) add(GEO.sample(axis), 'Computed reference circle');
  } else if (record.type === 'meridian') {
    add(
      Array.from({ length: 179 }, (_, i) => [record.longitude, i - 89]),
      'Reference meridian',
    );
  } else if (record.type === 'parallel') {
    // Densify the small circle; do not replace it with a great-circle chord.
    add(
      Array.from({ length: 361 }, (_, i) => [i - 180, record.latitude]),
      'Reference latitude',
    );
  } else if (record.type === 'great-circle') {
    const axis = referenceLine(record, model);
    if (axis) add(GEO.sample(axis), 'Claimed great circle');
  } else {
    for (const segment of researchSegments(record)) add(GEO.sample(segment), 'Illustrative source sequence');
  }
  return { type: 'FeatureCollection', features };
}

export function researchMetrics(record, model = 'endpoints') {
  const segments = researchSegments(record),
    axis = referenceLine(record, model);
  const offsets = record.members.map(m => {
    if (record.type === 'parallel') return GEO.dist(m.lat, m.lon, record.latitude, m.lon);
    if (record.type === 'meridian')
      return GEO.distToLine({ o: [0, record.longitude], brg: 0, len: Infinity }, m.lat, m.lon).d;
    return axis && ['path', 'great-circle'].includes(record.type)
      ? GEO.distToLine(axis, m.lat, m.lon).d
      : null;
  });
  return {
    segments,
    lengthKm: segments.length ? segments.reduce((sum, s) => sum + s.len, 0) : null,
    offsets,
    maxOffsetKm: offsets.some(v => v != null) ? Math.max(...offsets.filter(v => v != null)) : null,
  };
}

export function filterResearch(collections, query = '', category = 'all', region = 'all') {
  const fold = s =>
    s
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();
  const terms = fold(query).trim().split(/\s+/).filter(Boolean);
  return collections.filter(
    r =>
      (category === 'all' || r.category === category) &&
      (region === 'all' || r.region === region) &&
      terms.every(t =>
        fold([r.title, ...r.aliases, r.region, r.summary, ...r.members.map(m => m.name)].join(' ')).includes(
          t,
        ),
      ),
  );
}

export function coordinateSpread(site) {
  const first = site.positions[0];
  return Math.max(0, ...site.positions.map(p => GEO.dist(first.lat, first.lon, p.lat, p.lon)));
}

export function notebookEntry(value, recordIds) {
  if (
    !value ||
    typeof value !== 'object' ||
    !recordIds.has(value.recordId) ||
    typeof value.text !== 'string' ||
    value.text.length > 20000
  )
    throw new Error('Invalid notebook entry');
  if (
    value.investigation &&
    (typeof value.investigation !== 'object' ||
      typeof value.investigation.fingerprint !== 'string' ||
      !value.investigation.result ||
      !Array.isArray(value.investigation.result.hist) ||
      value.investigation.result.hist.length !== 2000 ||
      !value.investigation.result.hist.every(Number.isFinite) ||
      !['obs', 'N', 'p', 'mean', 'w', 'pool', 'seed'].every(k =>
        Number.isFinite(value.investigation.result[k]),
      ) ||
      !['rotate', 'random'].includes(value.investigation.result.mode))
  )
    throw new Error('Invalid investigation');
  return {
    ...(value.investigation ? { investigation: structuredClone(value.investigation) } : {}),
    recordId: value.recordId,
    text: value.text,
    saved: value.saved === true,
    updatedAt:
      typeof value.updatedAt === 'string' && Number.isFinite(Date.parse(value.updatedAt))
        ? value.updatedAt
        : '',
  };
}

export function parseNotebook(value, recordIds) {
  if (
    !value ||
    value.format !== 'ley-atlas-notebook' ||
    value.version !== 1 ||
    !Array.isArray(value.entries) ||
    value.entries.length > 1000
  )
    throw new Error('Invalid notebook');
  const entries = value.entries.map(e => notebookEntry(e, recordIds));
  if (new Set(entries.map(e => e.recordId)).size !== entries.length)
    throw new Error('Duplicate notebook entries');
  return { format: 'ley-atlas-notebook', version: 1, entries };
}
