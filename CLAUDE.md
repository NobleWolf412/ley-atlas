# Ley Atlas: notes for Claude

## Mission (agreed with Matt, 16 Nov 2026)

**A calm research map of ancient, sacred and fortified sites.** Five jobs: (1) find sites easily, (2) clear and accurate layers, (3) draw lines and see what they cross, (4) spot patterns, (5) learn about each site.

The rule over all of them is **calm**: few buttons, one way to do each thing, summary first with details collapsed. A feature that does not serve one of the five jobs waits. A new feature must not add buttons to a screen that is already busy; pair it with a cut where possible. Pages of statistics are not a feature (the Star fort lab was built and removed for this reason); a luck check is one plain verdict line.

## Design decisions (from Matt and Summer)

- Map-first: the map opens on its own with ☰ Menu, "Search sites" and "＋ Draw a line". No tabs. Panels open only on demand. Summer found the tabbed UI overwhelming.
- One way into each control. No redundant buttons.
- The app starts with no line chosen. Vatican–Sant'Angelo is a case-study line, not the default.
- Prioritize geological feedback along lines (faults, minerals, magnetic rock) over adding more datasets.
- Star-fort projection rays are dropped for now.
- Stay honest: line scores are "a guide, not proof". Keep the fair-p correction for lines whose B was chosen after seeing scores.

## Code rules

- Read ARCHITECTURE.md before structural changes.
- Arrows point down: `core`, `data`, `state`, `domain`, `render` never import from `map`, `layers`, `features`, `ui` or `panels`.
- Modules do no work when imported. Set-up goes in an exported `initX()` called from `src/app.js`, in order.
- Only the owning module assigns its exported variables; others use a named function or setter.
- Pure logic (maths, parsing, formatting) goes in `src/core/` with a test in `tests/`.
- Before committing: `npm run check` (lint, format, tests, build) must pass.

## Testing

- The main target is Chrome on an Android phone. Check the mobile viewport and touch use, and keep the UI responsive (line match runs in slices, about 4.5 s with the CPU slowed 4×).
- For refactors, compare against the live site: same map render, same Stonehenge → Bourtange result (648 km, 1 mineral deposit, 13 historic sites).

## Workflow

- Record user-facing changes in CHANGELOG.md, newest first.
- Pushing to `main` deploys to https://noblewolf412.github.io/ley-atlas/ via GitHub Actions.
