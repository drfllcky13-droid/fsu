PROJECT: FSU (drfllcky13-droid/fsu)
BATON → CHAT
Carry: Chat reviews draft PR #10 (17 mutation tests and BRIEF notes); the user merges. The backlog is then empty.
Status: PR #9 merged, 2026.09.30.1 live with 0 CSP violations, main CI green; PR #10 green (311/311).
Blocked on: nothing

## Report for Chat

**2026-09-24.** Live `APP_VERSION`: **2026.09.30.1**. main is at e27ae1a (the PR #9 merge), and main's CI is green on it.
- Both live pages were checked in a browser: 0 CSP violations and no page errors.
- jsPDF 4.2.1 and the QR library load from `lib/`.

### Open PRs
| PR | Head | CI | Local suite |
|---|---|---|---|
| [#10](https://github.com/drfllcky13-droid/fsu/pull/10) mutation tests and BRIEF notes (draft) | 71c14e8 (tests); this report is the next commit | green on 71c14e8 | 311/311 in Chromium, visual.spec.js excluded |

### What changed since the last report
- `e27ae1a` PR #9 merged: test tooling, debounced saves (2026.09.30.1), ESLint.
- `bb79e9b` BRIEF.md:
  - The three lint allow-list entries are kept (decision 1 = a), with the reason.
  - Shrinking the pages is dropped unless technicians report slow opens.
- `71c14e8` `fsu-tests/tests/mutants.spec.js`: 17 tests, one per real gap found by `mutate.js 25`. Each was shown to fail on its mutant.
- This commit: this report.

### Mutation run (`node fsu-tests/mutate.js 25`, seed 1)
- 25 mutants built. 6 were caught and 19 survived.
- Adding `src/sketch-canvas.js:631` from the trial run gives 20 survivors.
- 17 of those are real gaps, all now killed; the table in PR #10 lists them.
- 3 are equivalent or harmless, with no test:
  - `src/events.js:25` `return renderList()` → `return void renderList()`: the return value is never used.
  - `src/chrome.js:44` `navigator.storage&&estimate` → `||`: inside `try{}catch(e){}`, so a browser without `navigator.storage` skips the estimate either way.
  - `src/sketch-controls.js:47` `sk&&o` → `sk||o`: it differs only if the Renumber button names an object that doesn't exist, and that button is drawn only for the selected object.

### Decisions needed from the user
None.

### Noticed but not acted on
- **Weak spots in the suite before this PR.** The run caught only 24% of mutants. Most survivors were in text and count rendering on the van page, and in sketch geometry. Another `mutate.js` run with a different seed (`node fsu-tests/mutate.js 25 2`) would show how much of that is left. It takes about 45 minutes.
- **The wide-screen item list is a table** that does not use the list code (`renderInventory`'s `body`). Tests of that list have to run at iPad-portrait width or narrower. The first run of the A to Z test hit exactly that race, when I resized the window after the page loaded.
- **The first draft of the locked-layer drag test passed only because the new-sketch sheet's scrim covered the canvas.** Any mouse test on a new sketch must close that sheet first.

### Remaining backlog
Empty. The items still open from the review were decided against in BRIEF.md: Linux visual baselines, a per-page CSS split, folding `ext-*`, and page size unless opens are slow. A second mutation run (above) is optional.
