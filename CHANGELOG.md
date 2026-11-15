# Ley Atlas changelog

## 2.1.1 (14 Nov 2026): rebuilt as a proper project, now on GitHub Pages

Nothing changes in how the app looks or works. It is now a real code project instead of one 11 MB file.

- **New permanent link:** https://noblewolf412.github.io/ley-atlas/. Every change pushed to GitHub is tested and published there automatically.
- **Data split from code:** the 18 datasets are separate files in `public/data/`, so a code change no longer re-downloads 11 MB, and the browser caches data and code separately.
- **Code split into 46 modules** by job (geodesy, sites, lines, map drawing, underground layers, line match, panels…), with explicit imports. See ARCHITECTURE.md.
- **Dead code removed:** 28 leftover functions and settings from the 1.x/2.0 screens that nothing used.
- **Safety nets:** unit tests (geodesy, Google Maps links, fair p, coordinate and CSV/GeoJSON parsing, dataset checks), a linter that catches missing or unused code, and automatic formatting. All run on every push.
- **Checked against 2.1:** the same map pixel for pixel on phone and desktop, and the same results for drawing Stonehenge → Bourtange, line match, the menus, layers and both statistical tests.

## 2.1 update (12 Nov 2026, night): line match — help choosing B

Request: "when it has me choose B, the list could have indicators of good potential, taking into account underground and other things — otherwise it's a shot in the dark."

- **What it scores:** once A is picked, every switched-on site (12,621) is scored as a possible B, using what lies within the corridor of A→B:
  - mineral deposits
  - fault and plate-boundary crossings
  - km over strong magnetic rock (|anomaly| ≥ 200 nT)
  - historic sites. A site with neighbours within 3 km counts for less, so one cluster can't carry a line.
  - 10 km (or 2 corridors) at each end is left out, so a B inside a busy town doesn't score its own neighbours.
- **How it's ranked:** each count is compared with the **30 directions beside it** (±15°, same length) from A, not the whole compass. A line isn't rewarded just for running over land instead of sea, or through a busy region. "28/30" means it beats 28 of them. The match score (0–100) is the average over the switched-on signals.
- **Where you see it:**
  - The B picker sorts by **Best match**, with a score bar, one coloured dot per signal that stands out (≥ 24/30), and a short reason, e.g. "4 deposits 30/30 · 10 km magnetic rock 30/30".
  - Signal switches: Minerals / Faults / Magnetic / Sites.
  - **Show on map** draws gold wedges around A for directions that rank high (smoothed over 3°) and rings the 25 best matches. A is marked on the map.
  - Tapping a site shows a dashed preview from A and the match on its card.
  - The line details show "Match from A: this direction vs the 30 beside it".
- **Honesty built in:**
  - It is labelled "a guide, not proof".
  - A line whose B was chosen after seeing scores is flagged. **Is it unusual?** then also gives a **fair p**, allowing for picking the best of about π·length/corridor different directions: p_fair = 1 − (1 − p)^K. Example: p = 0.001 with 689 directions on offer becomes a fair p ≈ 0.50.
- **Speed:** about 0.8 s on a laptop, and about 4.5 s with the CPU slowed 4× to mimic a phone. It runs in slices with a progress percentage, and the screen stays responsive (≈ 50 ms). The result is cached per A and corridor.
- **Checked against the line check:** deposit and crossing counts match the discovery check for the same lines (e.g. Stonehenge → Bourtange: 1 deposit, 0 crossings in both). The site count differs on purpose because of cluster weighting.

## 2.1 update (12 Nov 2026, evening): Google Maps link goes to the exact spot

- Every map link uses Google's cross-platform search link (`maps/search/?api=1&query=lat,lon`), with a pin on the exact coordinates in the phone app and on the web. Satellite is one tap away there.
- Relabelled **Google Maps ↗**; it is on the site card, the full record and the mineral record.
- Test: link coordinates equal the site's coordinates exactly for every site type.

## 2.1 update (12 Nov 2026, later): site card fixes from the phone

- Same-named sites get their town added, e.g. the 7 forts called "Schans" become "Schans (Gennep)", "Schans (SE of Maasbree)" and so on.
- A tapped site that ends up hidden slides into view.
- Shorter distances.

## 2.1 update (12 Nov 2026): telling same-named sites apart

- The atlas's "De Schans" is the Ouddorp fort. Added Fort De Schans (Texel) at 53.0313, 4.8281 (Wikidata Q12012847 and burgenwelt.org agree within 35 m).
- Nearest-town labels from GeoNames.
- 603 forts mislabelled after distant cities are relabelled.

## 2.1 update (11 Nov 2026, night): swipe to delete, world magnetic map, real file saving

- Swipe to delete with Undo.
- World magnetic map, land and sea (NOAA EMM2017; Britain 2 km survey on top).
- Real downloads inside claude.ai.

## 2.1 update (11 Nov 2026, late evening): map first, no tabs

Prompted by Summer: "cool with the map… the tabs are overwhelming."

- The map opens on its own with ☰ Menu, "Search sites" and "＋ Draw a line". Panels open only when asked for.

## Earlier 2.1 updates (11 Nov 2026)

- No default line.
- No Tools tab.
- One way into each control.
- Roman sites (Pleiades).
- Density shading.
- Zoomed-out modes.
- Clear close/back.
- Two-site lines with a discovery check.

## Known limitations

- **Mineral deposits are land only** (mines and prospects). Seafloor metal is not included; the InterRidge vents database is not reachable from the build environment.
- Mineral records are thin outside North America. An empty result is not proof of empty ground, and the line match will lean on faults, magnetic rock and sites there.
- Line match: the magnetic part uses a 1° polar grid around A. The score compares directions from A only; it does not test whether alignments in general are real.
- The world magnetic map is regional (about 25 km detail), stops at ±80°, and is drawn on the flat map only.
- No cathedral dataset yet; the Wikidata import works from a normal browser.
- 538 forts are catalogue points without a traced outline.
- The Google Maps link cannot force satellite view in the phone app.
- A global gravity layer (EIGEN-6C4, land and sea) is available if wanted; it has not been built.
