# Ley Atlas 2.9 UX redesign

## Scope and inventory

The atlas remains a static, map-first research app. The initial map has search, projection, zoom/reset, and line creation. No persistent workspace tabs are added. Existing storage keys, backup versions 1–3, the 18 bundled JSON datasets, and calculation algorithms are retained.

| Capability                                                                   | Destination                            |
| ---------------------------------------------------------------------------- | -------------------------------------- |
| Search, category/country filters, site records, Wikipedia stories            | Search / selected site                 |
| Site A/B, freehand or bearing, swap, global lines, line match                | Draw a line                            |
| Working line, saved lines, edit, save, delete/undo                           | My lines / selected line               |
| Site type visibility, geology visibility, user and published line visibility | Layers                                 |
| Corridor findings, minerals, faults, plates, magnetism, precision            | Line details                           |
| Strip view, sun/moon by era, 3D flight, follow, share                        | Selected line                          |
| Random-line and underground site tests, fair-p adjustment, crossings         | Analyze → Comparisons                  |
| Alignment search and chance comparison, open result as a line                | Analyze → Find alignments              |
| Distance/angle measurement, map markers and coordinate entry                 | Analyze → Map tools                    |
| Built-in dataset switches, imported collection switches/removal              | Resources → Datasets                   |
| CSV/TSV/GeoJSON import, Wikidata query links                                 | Resources → Import                     |
| Backup/restore, lines GeoJSON, corridor sites CSV, map PNG                   | Resources → Export                     |
| Dataset attribution, licences, methodology, research notes                   | Resources → Reference                  |
| Theme, zoom display, point/density style, opacity                            | Appearance                             |
| Corridor/crossing overlays, outlines, labels, stonework, basemap             | Appearance → Overlays / Background map |
| Discovery glow and line colour                                               | Appearance → Line style                |

## Vocabulary

Use **Layers** for visibility, **Resources** for datasets/files/provenance, **Appearance** for rendering, **Analyze** for research tools, and **Line details** for the active line's findings. **Comparisons** replaces the previous “Is it unusual?” destination. Use short nouns for section labels; explanatory source and method details remain available where relevant.

## Implementation

`src/ui/navigation.js` defines the menu vocabulary and destinations. Existing panel hosts now include Layers, Appearance, and Map tools. `renderLayers(view, target)` shares the existing control wiring while rendering only the relevant visibility, dataset, or appearance controls. Resources uses four local sections and retains its selected section during updates. No geodesy, ranking, sampling, statistical corrections, dataset contents, or storage keys were changed.

The visual system uses existing font families, semantic colour tokens, evergreen accents, outlined icons, a desktop side panel, and a phone bottom sheet. The menu expands enough to expose its destinations on phones. Controls include visible keyboard focus, named delete buttons, 44 px primary touch targets, safe-area padding, and reduced-motion styling.

## Verification

- Existing 90 unit tests establish the pre-change baseline.
- Added DOM integration tests verify section ownership, dataset switches, Appearance event wiring and selected states, menu routes/back behavior, and file/style removal from My lines.
- A real-data regression preserves Stonehenge → Bourtange at a ±5 km corridor: 648 km, one mineral deposit, and 13 non-anchor historic sites.
- A backup/restore test checks saved lines, markers, and all 3,001 rows in a large imported dataset.
- Required gate: `npm run check` (lint, formatting, all tests, production/PWA build).

## Release boundary

This branch prepares the redesign for review. Merging to `main` triggers the existing GitHub Pages deployment. Gravity, cathedral/seafloor datasets, additional fort outlines, and broader mineral coverage remain the existing data backlog; they are not UX redesign requirements. Network services still govern Wikipedia stories, Wikidata downloads, satellite tiles, and terrain.
