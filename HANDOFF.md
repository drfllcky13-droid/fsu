PROJECT: FSU (drfllcky13-droid/fsu)
BATON → ME
Carry: The user merges PR "Accessibility fixes (2026.10.01.1)"; that puts it live.
Status: WCAG 2.1 AA audit done and a polish pass; 7 fixes plus tab bar and layout polish on branch claude/a11y-fixes; lint clean, 339 functional tests pass.
Blocked on: the merge (the user's call)

## Report

**2026-09-25.** An accessibility audit (WCAG 2.1 AA), run as a Playwright scan of every view on
both pages in light and dark, at phone size, plus Tab-order and 320 px reflow checks. It found
these, and the branch fixes them all:

1. Search: the count on the selected scope chip was blue on blue (1.00:1). The rail is also
   `.filters`, so `.filters button.sel` makes the chip solid blue. Now `.searchrail button.sel .n{color:inherit}`.
2. `#q` had no accessible name (only a placeholder). Now it has `aria-label="Search"`.
3. `#q` had no focus ring (`.sbox input{outline:none}`). Now `.sbox:focus-within` draws the ring.
4. Dark amber Sweep tile: `.sk`/`.ss` text at 82% opacity was 4.02:1. Now solid `--onamber`, about 4.9:1.
5. Dark amber `.schip.hot`: the same 82% text. Now `--onamber`.
6. The Scenes `.hnew` "+ New" button was 40 px tall. Now `min-height:44px`.
7. `#sheet` now has `role="dialog" aria-modal="true"`, and `closeSheet()` returns focus to the
   control that opened the sheet (`sheetOpener`, only when it is still in the DOM).

**Polish pass (same branch, impeccable `polish`):** the phone tab bar is an iOS-style bar (no box
per tab, 11 px labels, a tinted pill behind the current icon, a solid amber count badge); four-button
`.editbar` rows are 2x2 under 520 px; `.editbar button.danger` is red; `.qf` is auto-fill 150 px;
`.dt th` nowrap; tabular numerals; themed `::selection`, caret and accent colour. The detector's one
finding (`.justrow.dup` 3 px inset stripe) was already there and was left alone. Before and after
screenshots were taken at 1194x834 and 390x844 in both themes.

Version 2026.10.01.1, with entries in CHANGELOG.md and the in-app change log.

Tests: lint is clean and 339 tests pass. **The 12 `visual.spec.js` screenshot tests fail on this
Windows machine on plain `main` too** (checked by stashing these changes). The win32 baselines are
older than the Home and Storage design pass, so these failures are not from this branch. CI runs
on Linux, so it does not see them. If the win32 baselines should be refreshed, do it on its own
commit with `--update-snapshots`.

Not covered: screen reader passes (VoiceOver/NVDA), detail views that need a record open, and the
sketch canvas (freehand drawing is exempt from 2.1.1).

Decisions needed: merge the PR (recommended). It changes only colours, one button height, ARIA
attributes and focus handling.
