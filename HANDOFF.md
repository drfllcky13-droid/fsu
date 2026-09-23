PROJECT: FSU (drfllcky13-droid/fsu)
BATON → CHAT
Carry: Chat picks which backlog items below to approve (recommended: 1 and 2 now); Code builds them.
Status: Backend-review follow-ups done: PR #7 merged, 2026.09.29.1 live with 0 CSP violations; PR #8 (this protocol) merged right after this commit.
Blocked on: nothing

## Report for Chat

**2026-09-23.** Live `APP_VERSION`: **2026.09.29.1**. index.html and scenes.html were checked in a browser against the live site:
- 0 CSP violations and no page errors.
- jsPDF 4.2.1, svg2pdf and the QR encoder load from `lib/`, and a PDF gets made.
- main's CI is green on the PR #7 merge (de1f5d9), and Pages deployed it.

### Open PRs
| PR | Head | CI | Local suite |
|---|---|---|---|
| [#8](https://github.com/drfllcky13-droid/fsu/pull/8) Handoff protocol: CLAUDE.md, BRIEF.md, HANDOFF.md as the mailbox | this commit (after aba3689) | green on 9a2d0ff; merged by Code once green on this head | 287/287 in Chromium, visual.spec.js excluded |

None remain open once PR #8 is merged.

### What changed since the last report
- `de1f5d9` PR #7 merged: jsPDF 4.2.1, svg2pdf 2.8.1, checksums for `lib/`, Playwright pinned to 1.62.1. Version 2026.09.29.1.
- `aba3689` main merged into PR #8. PR #7's edits to the old brief (the `lib/` checksum paragraph and the `npm ci` line) are carried into `BRIEF.md`. Its "Report for Chat" moves here.
- This commit: this report, rewritten.

### Decisions needed from the user
1. Which backlog items to approve, from the list below. Recommended: 1 and 2 now, 3 after them, and 4–6 not at all.

### Noticed but not acted on
- On the merge of PR #7 into PR #8, the first local suite run had 1 failure. The output didn't name it, and two full reruns passed 287/287. It is most likely the render-time budget in `bulk.spec.js`, but that is not established. If it recurs, it gets a root cause, not a retry.
- svg2pdf 2.8.1 throws if it is loaded before jsPDF. The app only loads it from the vector sketch export, after `loadPDF()`, so nothing reaches this today. A future caller must keep that order.
- The label QR codes encode the page's own address, so a preview server on another port prints different codes. That is expected.

### Remaining backlog, in recommended order

| # | Item | Payoff | Effort | Worth it? |
|---|---|---|---|---|
| 1 | Fix the stale test scripts. `sample.js` builds its sketch on `index.html`, which lost the sketch at the split. `mutate.js` breaks `src/app.js`, which no longer exists. `pdf2png.js` loads pdf.js from cdnjs on every run. | Brings back the two tools used to check exports and grade the suite. `mutate.js` is the only check on whether the tests would catch a real break. | S (half a day) | Yes |
| 2 | Debounce form saves (`src/nav.js:51` saves the whole record on every keystroke), flushing on `pagehide`/`visibilitychange` so nothing typed is lost. | Typing in a long report stays smooth on an iPad once the record is a few MB, and the other open page stops reparsing and redrawing on every key. | S | Yes |
| 3 | Lint. A minimal ESLint (`no-undef`, `no-unused-vars`, `no-use-before-define`) over the concatenated parts in build order, run in CI. | Catches typos, stray globals and use-before-definition, like the `view` TDZ slip in PR #6, before a test has to. | S–M (the first run will need a globals list and some cleanup) | Yes, with only those rules. A style ruleset would be churn. |
| 4 | Linux visual baselines, generated in CI's container so `visual.spec.js` stops being skipped there. | Pixel-level layout regressions caught in CI. | M, plus every intended visual change then needs its baselines refreshed. | **Probably not.** The layout audit in `ui.spec.js`, `contrast.spec.js` and the print checks already catch what has actually broken. Revisit if a visual regression slips through. |
| 5 | Split CSS per page, so the van page doesn't carry sketch and scene styles. | A smaller van page. `app.css` is 95 KB for both; the saving is unmeasured, likely tens of KB (a few KB gzipped). The page is cached by the service worker after the first load. | M, with a real risk of dropping a style one page needs. | **No.** |
| 6 | Fold the `ext-*` layers (2,088 lines in 6 files) into the parts they extend. | Easier reading: each feature in one place, not base plus patch. No user-visible gain. | L. The diff touches most of the app, and every flow would need to be rechecked. | **No, as a project.** Fold a layer only when a change already has to rewrite that area. |
