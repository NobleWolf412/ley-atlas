# Ley Atlas

**Live: https://noblewolf412.github.io/ley-atlas/**

Interactive map for exploring ley lines, ancient monuments and star forts. Draw a line between two sites and the app checks what lies along it: mineral deposits, faults and plate boundaries, magnetic rock, and historic sites. It then compares the line with nearby directions so you can see whether it is actually unusual.

Built by Matt and Summer. Mainly used in Chrome on Android.

**Mission:** a calm research map of ancient, sacred and fortified sites. Find them easily, see what is above and below the ground, draw lines between them, spot patterns and learn about each place, without clutter.

## What's in it

- 12,621 sites: star forts, castles, UNESCO sites, Roman sites (Pleiades), megaliths, project sites
- Underground layers: mineral deposits, active faults, plate boundaries, world magnetic map (NOAA EMM2017, with a 2 km survey for Britain)
- Fly the line: a 3D flight along any line over satellite imagery and terrain, ending on "is it unusual?"
- Sun and moon: does a line point at a solstice, equinox or lunar standstill, for any era back to 3000 BC, with the odds of that happening by chance
- About this place: a short Wikipedia introduction on each site's card (needs a connection)
- Along the line: a strip view of ground height, magnetic signal and every finding from A to B
- Line match: ranks every possible point B for a chosen point A against the 30 directions beside it, with a fair p-value that allows for picking the best one

See [CHANGELOG.md](CHANGELOG.md) for the history.

## Run it locally

Needs Node 20 or newer.

```bash
npm install
npm run dev        # http://localhost:5173/ley-atlas/
npm run check      # lint + format check + tests + build (same as CI)
```

| Command           | What it does                  |
| ----------------- | ----------------------------- |
| `npm run dev`     | Dev server with live reload   |
| `npm run build`   | Production build into `dist/` |
| `npm run preview` | Serves `dist/` locally        |
| `npm test`        | Unit tests                    |
| `npm run lint`    | ESLint                        |
| `npm run format`  | Prettier, rewrites files      |

Every push to `main` runs the checks and deploys to GitHub Pages ([workflow](.github/workflows/ci.yml)).

## Project layout

```
index.html            page markup
src/main.js           entry: loads styles and data, then starts the app
src/app.js            start-up order (one init call per module)
src/core/             pure helpers: geodesy, formatting, stats
src/data/             dataset loader + curated site catalog
src/state/            app state and saved preferences
src/domain/           sites, lines, analysis, categories
src/render/           palettes and icons
src/map/              canvas, drawing, gestures, camera
src/layers/           underground layers
src/features/         line match, discovery, tests, import
src/ui/ src/panels/   screens and event wiring
src/styles/           CSS, split by area
public/data/          18 datasets as JSON
tests/                unit tests
```

[ARCHITECTURE.md](ARCHITECTURE.md) explains the rules, start-up sequence and how to add or remove features and datasets.

## Open items

- [ ] Finish untangling features, screens and panels (see ARCHITECTURE.md → Known debts)
- [ ] Global gravity layer (EIGEN-6C4, land and sea): data is available but not built yet
- [ ] Cathedral dataset (the Wikidata import works from a normal browser)
- [ ] Seafloor metal deposits (InterRidge vents CSV)
- [ ] 538 forts are catalogue points without a traced outline
- [ ] Mineral records are thin outside North America

## Data sources

Natural Earth (basemap), UNESCO World Heritage List (2014), Hotham (2026) star-fort catalogue, Pleiades (CC BY), Castlemap (CC0), Fralse (2026) megaliths (self-published, not peer-reviewed), GeoNames (nearest towns, CC BY), USGS mineral deposit records (MRDS and Major Mineral Deposits of the World), GEM Global Active Faults, Bird (2003) PB2002 plate boundaries, NOAA EMM2017 world magnetic anomaly, and a 2 km magnetic survey of Britain. The app shows the source for each record. The 3D flight uses Esri World Imagery and the Mapzen terrain tiles hosted by AWS Open Data.
