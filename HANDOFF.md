PROJECT: FSU (drfllcky13-droid/fsu)
BATON → CHAT
Carry: Chat reviews draft PR #9 (backlog items 1–3) and answers decision 1 below; the user merges.
Status: Backlog items 1–3 built in PR #9 (tooling, debounced saves 2026.09.30.1, ESLint); CI green; 2026.09.29.1 still live.
Blocked on: nothing

## Report for Chat

**2026-09-24.** Live `APP_VERSION`: **2026.09.29.1** (main at b8ebd38). PR #9 carries 2026.09.30.1 and is not merged.

### Open PRs
| PR | Head | CI | Local suite |
|---|---|---|---|
| [#9](https://github.com/drfllcky13-droid/fsu/pull/9) test tooling, debounced saves, ESLint (draft) | f793ca7 (code); this report is the next commit | green on f793ca7 (push and pull_request runs) | 294/294 in Chromium, visual.spec.js excluded |

### What changed since the last report
- `5cfe135` BRIEF.md: backlog items 4–6 (Linux visual baselines, per-page CSS, folding `ext-*`) dropped, with one line each on why.
- `a939d51` Test tooling:
  - `sample.js` runs on `scenes.html` and starts its own server.
  - `mutate.js` mutates the `src/*.js` parts.
  - `pdf2png.js` uses vendored pdf.js, so it needs no network.
  - `failures-reporter.js` names every failed or flaky test at the end of a run and in `fsu-tests/last-run.txt`, which CI prints.
- `642e283` Typing saves after a 500 ms pause:
  - Covers form fields, sketch object names and the backdrop sliders.
  - The pending save is written at once on hidden or `pagehide`.
  - A save the other page makes mid-pause keeps both changes.
  - 6 new tests. Version 2026.09.30.1, changelog entry and in-app line.
- `f793ca7` ESLint (`no-undef`, `no-unused-vars`, `no-use-before-define`) over each built page's script:
  - Runs from `npm run lint`, from the suite, and in CI.
  - 37 findings fixed without changing behaviour, which removed 103 lines of dead code from `src/`.
  - 3 findings kept in `fsu-tests/lint-allow.json` (decision 1).
- This commit: this report.

### Decisions needed from the user
1. **Three unguarded calls on the van page** (lint `no-undef`, kept in `lint-allow.json`). Shared code on `index.html` calls functions only `scenes.html` defines:
   - `newSketch` in `src/pages.js:66`, already behind `if(!here("sketch"))return`;
   - `bundleIncident` in `src/events.js:91`, from the incident view's bundle button;
   - `exportFill` in `src/events.js:196`, from the form view's Export PDF button.

   The van page has none of those views, so none of these can run there today. They would throw only if a future change put one of those buttons on the van. Options:
   - (a) Leave them as they are, allow-listed with reasons. **Recommended.** Nothing reaches them, and the allow list makes a new one visible.
   - (b) Add `typeof x==="function"&&` guards. That turns a would-be error into a silent no-op, which is a behaviour change.
   - (c) Move those handlers out of the shared `events.js` into scene-only parts. That's cleaner, but it's a structural change to shared code.

### Noticed but not acted on
- **Mutation survivor.** `mutate.js` found a mutation at `src/sketch-canvas.js:631` that nothing catches: the aerial backdrop's `place` label was dropped (`||` to `&&`) and no test failed. That is the next test to write if more coverage is wanted. `node fsu-tests/mutate.js 25` gives the fuller picture, at about 45 minutes.
- **The unexplained one-off failure** on the PR #8 branch did not recur in 6 full runs. If it happens again, `last-run.txt` and the end of the log now name it.
- **svg2pdf 2.8.1 throws if it is loaded before jsPDF.** Only the vector sketch export loads it, after `loadPDF()`. A future caller must keep that order.

### Remaining backlog, in recommended order
| # | Item | Payoff | Effort |
|---|---|---|---|
| 1 | Decision 1 above | Settles the only lint exceptions | S whichever option |
| 2 | A 25-mutant `mutate.js` run, then tests for what survives | Finds the behaviour nothing guards, starting with `sketch-canvas.js:631` | S to run, then S per test |
| 3 | Page size (review finding 17): measure a cold and a warm open of `scenes.html` on an iPad before changing anything | Tells whether the 915 KB page is a real problem now that the service worker answers after 3 s | S to measure; any fix is M |
