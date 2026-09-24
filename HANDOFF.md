PROJECT: FSU (drfllcky13-droid/fsu)
BATON → ME
Carry: The user approves the second mutation-tests PR; Code merges it.
Status: Second mutation pass done: 8 new tests, each shown to fail on its mutant; 319/319 locally.
Blocked on: approval to merge

## Report

**2026-09-24.** `node fsu-tests/mutate.js 25 2` (seed 2): 25 mutants built, 13 caught, 12 survived
(52% caught, up from 24% on the first run).

### New tests (tests/mutants.spec.js; each fails on its mutant)
- An item marked Expired counts as expired (`src/core.js` isExpired).
- A sketch backdrop is drawn where it was placed (`src/sketch-canvas.js`).
- A sheet focuses its first visible, enabled control (`src/chrome.js` sheetStops).
- A case package keeps its photographs' sizes (`src/core.js` cleanCase).
- An incident bundle's reference carries the case number (`src/pdf.js`).
- An import clash names the incident by its case number (`src/case-package.js`).
- Returning to the app with unsent changes sends them (`src/events.js` visibilitychange).
- The map view is not rebuilt while the map is still loading (`src/map.js`).

### Survivors with no test (equivalent or harmless)
- `src/events.js:6`, `src/ext-reports.js:55`, `src/sketch-canvas.js:405`: `return f()` → `return void f()`; the value is never used.
- `src/views-van.js:258`: `pop&&pop.scrollIntoView` → `||`. `#baypop` is always drawn before that line runs.

### Tests
- `node build.js --check` passes; full suite minus `visual.spec.js`: 319/319 in Chromium.

### Decisions needed
1. Approve the PR for merge (tests only; nothing a technician sees changes). Recommended: yes.
