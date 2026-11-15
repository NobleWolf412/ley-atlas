# Ley Atlas

Interactive map for exploring ley lines, ancient monuments and star forts. You draw a line between two sites, and the app checks what lies along it: mineral deposits, faults and plate boundaries, magnetic rock, and historic sites. It then compares the line with nearby directions so you can see whether it is actually unusual.

Built by Matt and Summer. Mainly used in Chrome on Android.

## Current version

**2.1**: a single self-contained `index.html` (about 11 MB, with all data built in). Open it in any browser; no server is needed.

- 12,621 sites: star forts, castles, UNESCO sites, Roman sites (Pleiades), project sites
- Underground layers: mineral deposits, active faults, plate boundaries, world magnetic map (NOAA EMM2017, with a 2 km survey for Britain)
- Line match: ranks every possible point B for a chosen point A against the 30 directions beside it, with a fair p-value that accounts for picking the best one

See [CHANGELOG.md](CHANGELOG.md) for the full history.

## Open items

- [ ] Split `index.html` into app code and separate data files
- [ ] GitHub Pages link for phones (needs the repo to be public, or a paid plan)
- [ ] Global gravity layer (EIGEN-6C4, land and sea): data is available but not built yet
- [ ] Cathedral dataset (the Wikidata import works from a normal browser)
- [ ] Seafloor metal deposits (InterRidge vents CSV)
- [ ] 538 forts are catalogue points without a traced outline
- [ ] Mineral records are thin outside North America
