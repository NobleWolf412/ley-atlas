# Ley Atlas changelog

## Unreleased: Guided site import

- Paste place names, copied lists or coordinates and choose **Find sites**. Review atlas matches, choose between namesakes, correct missing locations with coordinates or a map pin, then import only selected sites.
- Matching and the preview map work offline. Uncertain names are not assigned invented coordinates; pasted lists stay on the device.
- Existing atlas matches become collection memberships without duplicate map points or inflated site counts. New locations retain their coordinate source and original pasted label in local saves and backups.
- CSV, TSV and GeoJSON file uploads and column mapping remain available. Headerless tables keep their first named row; malformed geometry reports an import error or skipped row.

## Unreleased: Research Library

- Explore now contains Research Collections: featured/all/saved views, search and filters, source-aware site profiles, and Overview / Sites / Geometry / Analysis / Sources tabs.
- 17 unverified research drafts retain 80 source memberships, including 78 rows from 13 dossier tables. The full 15-table / 86-row intake is reconciled in a manifest; two cultural tables remain held outside the public bundle. Original documents and personal interpretations are excluded.
- Reversible previews show schematic sequences, source nodes, exact meridians and latitude parallels. Endpoint and least-squares great-circle models are explicitly calculations. Unsupported network, cultural and sky methods cannot run a generic line test.
- Eligible models use the existing seeded 2,000-control comparison engine with isolated results, source-anchor exclusion, coverage and selection caveats. Explicitly save a computed model to My lines to use the existing Analyze tools without replacing the working line.
- Local bookmarks, notes, investigation fingerprints and result snapshots, plus a source-attributed history timeline. Notebook export/import merges preserve existing local entries; full backups use v4 and restore v1–v4.
- Keyboard tabs and shared browser/panel Back behavior; bundled content works offline. Data validation runs before every production build.

## 2.9 (16 Nov 2026): Atlas workspace

- A unified menu: **My lines**, **Layers**, **Analyze**, **Resources**, and **Appearance**. The map still opens on its own.
- **Resources** brings dataset switches, imported collections, CSV/GeoJSON imports, backups, GeoJSON/CSV/PNG exports, attribution, and methods into one place.
- **Layers** contains only Sites, Underground, and Lines. **Appearance** holds theme, map styling, overlays, background map controls, and line style.
- **Analyze** groups line details, chance comparisons, alignment searches, and map tools. Measure and markers have a dedicated screen; comparison panels show details on demand.
- A new paper-and-evergreen interface with consistent icons, larger touch targets, responsive panels, keyboard focus, explicit delete buttons alongside swipe gestures, and reduced-motion support.
- Dataset visibility and map styling now persist across reloads alongside the existing preferences.
- Backups retain imported collections over 3,000 rows; previously they were silently omitted. Restore closes its host panel correctly.
- Regression coverage uses the real datasets for Stonehenge → Bourtange: **648 km, 1 mineral deposit, 13 historic sites**. Dataset integrity and existing algorithm tests remain in place.

## 2.8 (16 Nov 2026): Find alignments

The "spot patterns" job from the mission, which had nothing built for it.

- **New: Find alignments**, in the ☰ menu. Move the map to an area, press **Search the sites in view**, and it lists the straight lines that pass through 4 or more of the sites showing, each within 1 km of the line.
  - Each result shows how many sites, how long, its two end sites and how tightly the sites sit on it. All the lines are drawn on the map; tap one to highlight it and ring its sites.
  - **Open as my line** turns a result into your line, so you can see what it crosses, fly it and test it like any other.
  - **One-line luck check.** The same sites are nudged 5–25 km at random three times and searched again. The verdict says whether the real lines beat that. Around southern England, 12 sites on a line sounds impressive, but nudged copies gave 13, so the verdict there reads "about what chance gives".
  - Sites in the same town (closer than 3 km along the line) count once, so one cluster cannot make a line.
  - Handles up to 400 sites at a time; with more in view it asks you to zoom in or switch site types off. About 2 seconds on a slow phone.
- The **Save it** offer for an unsaved line now also covers lines made from a bearing and lines opened from the alignment finder.

## 2.7 (16 Nov 2026): a calmer app, and something to read about each site

From Matt: "an easy way to search/filter, a clear and accurate layer system, draw lines, look for patterns, research and learn about these sites… nothing too chaotic and full of hundreds of buttons." That is now the written mission of the app.

- **Map layers rebuilt.** It opened with 71 switches and settings at once. Now it opens with four rows: **Sites**, **Underground**, **Lines** and **Display options**. Each shows what is on ("10 of 11 types on", "all off") and opens when tapped; only one is open at a time.
  - Sites has **All on / All off**. The lists the sites come from are tucked under "Where the sites come from".
  - The case-study and published lines are tucked under "Example and published lines".
  - Zoom display, deposit and fault style, opacity, labels, fort outlines and the background map moved into Display options.
  - Nothing was removed; every switch is still there.
- **The line screen leads with the answer.** At the top: how long the line is, what lies within the corridor (for example "13 sites · 1 mineral deposit · 0 fault crossings · 0 plate boundaries"), what stands out, and the **Is it unusual?** button. Everything else is a closed row you open if you want it: Sites along it, Mineral deposits, Faults and plate boundaries, Magnetic field, Strip view, Sun and moon, Corridor and line settings. On a phone that is 11 things to tap instead of 35. Rows you open stay open.
- **New: About this place.** A site's card now shows a short introduction and a picture from Wikipedia, with a link to read more. It uses the article the site list names, or its Wikidata entry, or an article within 2 km whose name matches. If none clearly matches, it shows nothing rather than guess. Needs a connection.
- **An unsaved line is no longer lost silently.** If you draw a new line over one you never saved, a message offers **Save it** for the old one.
- Checked: 3D flight works on a phone (Matt).

## 2.6.1 (16 Nov 2026): Star fort lab removed

From Matt: not useful, scrap it.

- **The Star fort lab and the Research tools screen are gone.** "Is it unusual?" is back as its own row in the ☰ menu, and star fort cards are as they were in 2.5.
- Kept from 2.6, nothing visible: screens can now set their own title and back button, which the alignment finder will use.

## 2.6 (16 Nov 2026): Research tools and the Star fort lab

From Matt: "Can we start work on this and integrate it cleanly?… if you recommend a new type of layout, we need to adjust it."

- **New: Research tools**, in the ☰ menu. One screen holding every testing tool, each as a card. "Is it unusual?" moved in here, and later tools (alignment finder, grid overlays) will join it. The map screen is unchanged.
- **New: Star fort lab.** Pick a fort from the quick picks (Bourtange, Palmanova, Naarden, Neuf-Brisach, Goryōkaku, Fort McHenry), or tap any traced star fort on the map and press **✶ Star fort lab** on its card.
  - **Its shape:** a drawing of the outline with every point numbered and its direction drawn; how many points, how evenly spaced they are, how even their reach is, the area and the year built.
  - **What its points aim at:** other star forts, or ancient and sacred sites, within 1,000 km, at ±0.5°, ±1° or ±2°. Tap one to see it on the map.
  - **The sun and moon:** whether a point faces a solstice, equinox or lunar standstill rise or set, for the year it was built (AD 1600 if not recorded).
  - **Luck check on both:** the same fort is turned to every angle, a quarter degree at a time, to show how often a randomly turned copy would do as well. Most forts aim at about as many things as chance gives.
  - **Show its directions on the map** draws each point's direction 800 km out and rings the sites it aims at.
- **All traced star forts (767):** how many have 3, 4, 5… points; whether forts with the same shape face the same way (with the fair-p correction, since seven shapes are tested); and a network test of whether forts point at each other more than chance. Today's answer: 1.02 times what chance gives, which is chance.
- "Points" are the tips of the traced outline, so ravelins and outworks count. Bourtange shows 10, not its 5 bastions.

## 2.5 (16 Nov 2026): Sun and moon, and a strip view along the line

Both are on the line's **See what's along it** screen.

- **Along the line.** A strip diagram from A to B: ground height, the magnetic signal as a colour band, and every fault crossing, plate boundary, mineral deposit and site placed at its distance along the line. Tap any mark to find it on the map.
  - Ground heights come from the open Terrain Tiles (the same ones the 3D flight uses), so they need a connection; the rest works offline.
  - It is a strip map of the surface, not a geological section, and says so. Heights are stretched to be visible.
- **Sun and moon.** Checks whether the line points at a June or December solstice, an equinox, or a major or minor lunar standstill, rising or setting, from each end of the line and looking both ways along it.
  - **Pick the era**, from today back to 3000 BC. Earth's tilt changes slowly, so a line laid out on the midsummer sunrise in 2500 BC is about 1° off today. The check allows for that.
  - **Pick what counts as a match:** ±0.5°, ±1° or ±2°.
  - **Luck check, always shown:** with up to 14 such directions at each end, a line in a random direction matches one of them within ±1° about one time in four or five. A match only means something if it is much closer than that, or was planned for.
  - **Show directions on the map** draws the sun (gold) and moon (blue) directions from each end; sets are dashed, and a direction the line matches is drawn thicker.
  - Assumes a flat horizon (hills shift a sunrise point by about 1–2° per degree of horizon height).

## 2.4.1 (15 Nov 2026): category chips on a computer, counts per country, magnetic field on the globe

From Matt: "when I'm on the computer there's no way to slide to the right… when I filter by country, those toggles don't reflect the number existing in that country… also magnetic field toggle doesn't show on globe mode."

- **On a computer, the category chips wrap onto more rows**, so all ten are visible. They were a single row meant to be swiped, with the scrollbar hidden, which left no way to reach the rest with a mouse. On a phone they still swipe.
- **With a country chosen, the chip counts are for that country.** Egypt shows how many castles, temples, pyramids and so on are in Egypt. Categories with none there are dimmed.
- **The magnetic field now shows on the globe.** Before, it was only drawn on the flat map, and switching it on threw you out of Globe view. It is drawn a little coarser while the globe is turning and sharpens when it stops.

## 2.4 (15 Nov 2026): search you can steer

From Matt: "the search functionality should be more intuitive, maybe filter by country… when I type it lags a bit."

- **Filter by country.** A Country drop-down sits under the category chips, in Search and in the point A / point B pickers. It lists every country that has sites in the chosen category, with counts (for example France 1,398). In Search, picking a country also moves the map there.
- **Every site now has a country.** Star forts and castles came with one; UNESCO, Roman, Pleiades and wonder sites are placed using the world outline in the app. The country shows under the site's name. The outline is coarse, so a few sites on small islands or right on a border may be missing a country or carry the neighbour's.
- **Best matches first.** While you type, names that start with what you typed come first, then names containing it, then matches by type or country. Typing "castle france" lists castles in France. Before, results were simply nearest-first, and any text containing the letters counted (so "france" matched "San Francesco").
- **Accents don't matter:** "chateau" finds Château, "sao" finds São.
- **Typing is about twice as quick.** Only the result rows are redrawn (the search box is left alone, so the phone keyboard no longer flickers), only the rows on screen are sorted, and the wait after each key is shorter. Measured on a slowed-down test device, per key: Search 227 → 107 ms, point A picker 184 → 80 ms, point B picker 158 → 80 ms.

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
- The world magnetic map is regional (about 25 km detail) and stops at ±80°.
- No cathedral dataset yet; the Wikidata import works from a normal browser.
- 538 forts are catalogue points without a traced outline.
- The Google Maps link cannot force satellite view in the phone app.
- A global gravity layer (EIGEN-6C4, land and sea) is available if wanted; it has not been built.
