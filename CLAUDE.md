# Ley Atlas: notes for Claude

## Design decisions (from Matt and Summer)
- Map-first: the map opens on its own with ☰ Menu, "Search sites" and "＋ Draw a line". No tabs. Panels open only on demand. Summer found the tabbed UI overwhelming.
- One way into each control. No redundant buttons.
- The app starts with no line chosen. Vatican–Sant'Angelo is a case-study line, not the default.
- Prioritize geological feedback along lines (faults, minerals, magnetic rock) over adding more datasets.
- Star-fort projection rays are dropped for now.
- Stay honest: line scores are "a guide, not proof". Keep the fair-p correction for lines whose B was chosen after seeing scores.

## Testing
- The main target is Chrome on an Android phone. Check the mobile viewport and touch use, and keep the UI responsive (line match runs in slices, about 4.5 s with the CPU slowed 4×).

## Workflow
- Record user-facing changes in CHANGELOG.md, newest first.
