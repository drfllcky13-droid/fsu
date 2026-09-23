PROJECT: FSU (drfllcky13-droid/fsu)
BATON → ME
Carry: You review and merge PR #7 (jsPDF and Playwright) and PR #8 (this protocol); Code carries PR #7's HANDOFF.md edit over to BRIEF.md in whichever merges second.
Status: Backend-review follow-ups: PRs #1–#6 merged (2026.09.28.1 live); PR #7 green; PR #8 sets up the handoff protocol.
Blocked on: your review of PR #7 and PR #8

## Report for Chat

### What changed (PR #8, branch claude/fsu-handoff-731hf8, draft)
- `501c085`:
  - `CLAUDE.md` is new and carries the handoff protocol.
  - The project brief that was `HANDOFF.md` moved to `BRIEF.md` (git mv, history kept), so this mailbox doesn't overwrite it. That was the user's choice.
  - `README.md`, `src/README.md` and one code comment in `src/chrome.js` now point at `BRIEF.md`.
- This file, `HANDOFF.md`, is now only the mailbox.

### Still open: PR #7 (branch claude/fsu-jspdf-731hf8, draft, CI green)
- `76e1904`: jsPDF 2.5.1 → 4.2.1 and svg2pdf 2.2.4 → 2.8.1.
  - 2.5.1 had 16 published advisories, 2 of them critical. 4.2.1 is outside every one.
  - `lib/SOURCES.txt` has versions and a SHA-256 for every file; `libs.spec.js` checks them.
  - Old and new PDFs compared under the CSP: pixel-identical on all 18 pages, 0 CSP violations. No visible difference, so no images to flag.
  - Version 2026.09.29.1.
- `a28ebb4`: `@playwright/test` pinned to 1.62.1. CI uses `npm ci` and installs the matching browsers.

### Tests
- PR #8: the full suite minus `visual.spec.js` passes 285/285 (Chromium), and `node build.js --check` passes.
- PR #7: 287/287 locally, and CI is green on a28ebb4, including the CSP tests on Playwright 1.62.1.

### Decisions needed
- None for Chat.
- One mechanical merge: PR #7 edits the old `HANDOFF.md` brief, so whichever PR merges second needs that paragraph carried into `BRIEF.md`. Code does it at merge time.
