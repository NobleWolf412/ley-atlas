import assert from 'node:assert/strict';
import { stdout } from 'node:process';
import { RESEARCH_RECORDS, RESEARCH_SOURCES } from '../src/data/research.js';
import { RESEARCH_INTAKE_MANIFEST as manifest } from '../src/data/research-manifest.js';
import { normalizeResearch, researchGeometry } from '../src/core/research.js';

import { RESEARCH_SOURCE_ENTRIES } from '../src/data/research-entries.js';
const library = normalizeResearch(RESEARCH_RECORDS, RESEARCH_SOURCES, RESEARCH_SOURCE_ENTRIES);
assert.equal(manifest.sourceTableCounts.length, 15);
assert.equal(
  manifest.sourceTableCounts.reduce((a, b) => a + b, 0),
  86,
);
for (const [index, count] of manifest.sourceTableCounts.entries()) {
  const record = RESEARCH_RECORDS.find(r => r.tableIndex === index + 1);
  if (manifest.heldTables.includes(index + 1))
    assert.equal(record, undefined, 'Held table must not be bundled');
  else assert.equal(record?.rows.length, count, `Source row count: table ${index + 1}`);
}
const entries = new Set();
for (const r of library.collections) {
  assert.equal(r.editorial.status, 'needs_source_review');
  for (const m of r.members) {
    assert(!entries.has(m.sourceEntryId), 'Duplicate source-entry ID');
    entries.add(m.sourceEntryId);
  }
  for (const f of researchGeometry(r).features) {
    const coords = f.geometry.type === 'Point' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const [lon, lat] of coords)
      assert(Number.isFinite(lon) && Number.isFinite(lat) && Math.abs(lon) <= 180 && Math.abs(lat) <= 90);
  }
}
assert(
  !JSON.stringify(RESEARCH_RECORDS).match(
    /docs\.google\.com|drive\.google\.com|Jyeshtha|Aries Lagna|your chart/,
  ),
  'Private content must not ship',
);
stdout.write(
  `Validated ${library.collections.length} research drafts; 15/86 intake manifest reconciled, 2 cultural tables held.`,
);
