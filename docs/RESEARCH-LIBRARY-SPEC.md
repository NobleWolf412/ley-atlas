# Research Library: implemented scope and release gates

Based on the supplied Ley Atlas Research Library Implementation Specification v1.0, dated November 2026. This file documents the implemented behavior and remaining gates; it does not reproduce the private research documents.

## Product and navigation

Research Collections is a secondary view within Explore. Existing My lines, Layers, Analyze, Resources and Appearance destinations keep their responsibilities. Search defaults to sites. Collection cards open five consistent subtabs: Overview, Sites, Geometry, Analysis and Sources. Featured pilots are Michael, Eastern Seaboard, Paris and Becker–Hagens.

All shipped collections are **Unverified research drafts**. The document filename “Official” is not an evidence grade. Hypotheses, source coordinates, editorial observations and calculations have different labels. No claim of physical energy, medical effects, secret technology or political intent is a verified site attribute.

## Data and provenance

- `src/data/research.js`: editorial summaries, source bibliography, 17 drafts and timeline. 13 geographic dossier tables, 3 contextual geographic variants and a history/methods collection.
- `src/data/research-entries.js`: 78 permitted original location entries, preserving names, source regions, hemispheres and decimal coordinates. These are not independently verified positions.
- `src/data/research-manifest.js`: all 15 source table counts and 86-row reconciliation. Tables 13–14 are held for cultural-source and stewardship review; no location or route content from them ships.
- Full private intake, original document text and personal amendment remain outside the repository. The amendment is not a geographic source.
- `src/core/research.js`: versioned normalizer, coordinate validation, source membership IDs, alias retention, coordinate variants, geometry adapters and notebook validation.
- `src/domain/research.js`: research entity lookup and conservative atlas candidate matching by explicit ID/name **and** distance under 5 km. Candidate match never overwrites an atlas point or source coordinate.
- Source precision is explicitly unknown; WGS84 is assumed for display. Decimal precision is not positional accuracy. Broad/conceptual node labels require review.

The 15 dossier table counts are 8, 8, 5, 9, 11, 5, 4, 5, 5, 3, 6, 5, 4, 4, 4. Public dossier entries total 78; held entries total 8. Dresden and Denver add 2 contextual entries. There are no additions to the original 18 datasets.

## Geometry and analysis

Map previews are transient overlays. Source points and schematic joining paths remain separate from endpoint and least-squares great-circle models. Exact constant-longitude meridians and constant-latitude small circles retain their geometry. Clusters have no fabricated edges. The two world-grid variants remain separate. Mary is points-only because no meandering trace is supplied. Star-site correspondence remains unavailable without an epoch, projection, transform and valid null model.

Preview does not modify work, saved lines, active line, selection, layer toggles, corridor or previous analysis. Exit restores its camera snapshot. The same overlay supports source-point inspection and a return to the selected collection subtab. Screens register history capture/restore with the existing panel coordinator; no new hash routes are introduced.

Research comparisons use the same pure engine as existing Comparisons (`src/core/line-comparison.js`): 2,000 controls, seed 20261108, rotation about start or uniform random Earth origins. Research results live separately. Source anchors within 300 m are excluded. Reported p-values are exploratory and **not adjusted for selecting a proposal from many candidates**. Nonlinear/underdefined models cannot invoke the generic test. Existing selection-adjusted line matching is unchanged.

Saving a computed model is an explicit opt-in that creates a new personal line with source positions and a provenance fingerprint. The working line is retained. Analyze provides a return link to its source collection.

## Notebook, backups and offline behavior

Notebook data remains local at `ley-atlas-notebook-v1`. Bookmarks, notes, collection/source versions, geometry model, source site IDs, map camera/layers, corridor, control parameters, full result distribution and fingerprints can be exported. Unknown or malformed imports fail before mutation. Import merges new collection entries and preserves conflicting existing entries. Writes update memory only after local storage succeeds.

Full app backups use version 4 and include the notebook. Versions 1–3 still restore and leave a current notebook intact. Source-change fingerprints flag saved investigations. Dataset fingerprints describe the exact candidate pool used in a run; the current release does not offer automatic historical dataset reconstruction.

All research assets are compact bundled JS, included in the existing generated PWA precache. Card graphics are original SVG schematics with no remote media or licensing dependency. A build-time validator checks counts, coordinates, held publication gates and private-content exclusions.

## Validation and limitations

Run `npm run check`. Tests cover geometry types, source variants, source-row reconciliation, unsupported methods, preview isolation, keyboard tabs, history, real-data calculations, notebook storage failures and backup versions. Browser QA checks 360×800, 390×844, 768×1024, 1440×900 and landscape, plus production service-worker/offline reload.

Remaining release gates from the supplied specification: editorial/rights sign-off on factual content, reviewer approval, a physical Android installed-PWA/update smoke test, and comprehension tests with five people. Browser emulation does not establish those gates. Public drafts must retain their unverified labels until reviewed.

Advanced sky fitting, restricted cultural routes, community/editorial publishing, sourced date-range filters and material-comparison algorithms remain separately scoped. The timeline supplies only attributed historical accounts from the compilations, not a verified archaeological chronology.
