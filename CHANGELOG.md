# Ley Atlas changelog

## 2.3.2 (15 Nov 2026): the line card makes sense, updates announce themselves

From Matt: "if I want to dismiss it, there's no way to. And I never actually saved it. I go to My lines and it shows zero."

- **The line card on the map now has buttons:** **Fly it in 3D**, **Save** (only for a line that is not saved yet) and **Open →**. Flying is one tap from the map.
- **✕ puts the line away.** It clears the line off the map without deleting it, and "＋ Draw a line" comes back. A message says where it went. (The ＋ that used to sit there is gone; it started a new line, which is what "Draw a line" is for.)
- **A line you have not saved is labelled "Not saved yet"** on the card.
- **My lines shows the unsaved line too**, in its own "Not saved yet" box with Save line and Remove. The menu reads, for example, "0 saved · 1 not saved yet".
- A line you put away stays away when you reopen the app.
- **Updates announce themselves.** When a newer version has downloaded, a "A new version of Ley Atlas is ready · Update" bar appears; tap Update. Before this, a new version only showed after closing and reopening the tab. The app also checks for updates each time you come back to it.
- **The version number** is at the bottom of the ☰ menu.

## 2.3 (15 Nov 2026): Fly the line in 3D

- **Fly it in 3D:** new button on the line card and on the "what's along it" screen. It opens a full-screen 3D view, swoops down to point A and flies the line over satellite imagery and real terrain.
  - The line glows on the ground. Sites along it stand as pins; mineral deposits are amber dots, fault crossings red, plate boundaries purple.
  - A **Passing** card names what is beside you right now and how far to the left or right it is. The top shows distance travelled and the ground height under you.
  - Controls: play/pause, a slider to jump anywhere along the line, and speed (1×, 2×, 4×, ½×). Esc or ✕ closes it. Drag to look around while paused.
  - **It ends on the honest question.** The last card repeats what was found, says plainly that a long line through busy country always passes things, and offers **Is it unusual? Run the test**.
- The 3D engine (MapLibre) is only downloaded the first time you fly, so the normal start-up is no slower.
- Needs a connection for satellite and terrain tiles (Esri World Imagery; Mapzen terrain tiles on AWS). Without one, the flight still runs over a dark ground.
- The research screens still use the existing 2D map and globe. Moving those onto the 3D engine is a later step.

## 2.2.1 (14 Nov 2026): internal tidy-up, nothing changes on screen

- The map no longer depends on the features drawn on it: features now plug into the map and the panels through small extension points (events, draw layers, screens, actions). This is the groundwork for swapping in a 3D map engine.
- Big files split up: panels by screen, map drawing into base layer, icons, labels and readout; underground data lookups separated from underground drawing.
- A lint rule now blocks code in the lower layers from reaching up into screens and features.
- **Fixed:** a share link opened in a background tab did nothing until the tab was brought to the front.
- Checked against 2.1: identical start screen pixel for pixel (phone and desktop) and identical results through drawing a line, line match, menus, layers and both tests.

## 2.2 (14 Nov 2026): opens fast, installs like an app, lines can be shared

- **Opens fast:** the map and all sites appear after about 1 MB of download instead of 5.8 MB. The heavy layers (detailed coastline, mineral deposits, faults, plates, magnetic maps) arrive in the background; a small "Loading underground data…" note shows until they are in. Line match waits for them, and the active line's findings refresh by themselves when they land.
- **Installs like an app:** in Chrome on Android use ⋮ → "Add to Home screen" (or "Install app"). It then opens full screen from its own icon and **works offline** after the first visit. New versions are picked up automatically the next time it opens.
- **Share a line:** the line card has a **Share** button. On a phone it opens the share sheet; on a computer it copies a link. The link opens the atlas on that exact line (site to site, freehand, or a case study) with the same search corridor. With no line chosen, the link carries the current map view.
- **Fixed:** the small line card on the map could miss "strong magnetic signal" if the line was shown before the magnetic map had finished loading. It now updates.
- Not included yet: satellite tiles are not kept for offline use.

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
