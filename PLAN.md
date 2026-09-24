# FSU plan

The one place for goals, rules, decisions, the roadmap and open questions. Since 24 September 2026
Claude Code does both the planning and the building. Keep this file current: change it in the same
commit as anything that makes it wrong, and rewrite **Where we are** at the end of every session.

How the app is built and what bites: [BRIEF.md](BRIEF.md). Sync design: [SYNC_DESIGN.txt](SYNC_DESIGN.txt).
Building from `src/`: [src/README.md](src/README.md). The suite: [fsu-tests/README.md](fsu-tests/README.md).
The last session's detailed report: [HANDOFF.md](HANDOFF.md). History: [CHANGELOG.md](CHANGELOG.md).

## 1. Goal and scope

An offline web app for the Williamsport Bureau of Police Forensic Services Unit, built and
maintained for Addison (the user). Two deliberately separate apps from one `src/`:

- **FSU** (`index.html`): van inventory: compartments, items, sweeps, restock, guide, labels, printable map.
- **FSU Scenes** (`scenes.html`): incidents, forms, sketches, the Williamsport map, case packages.

Live at https://drfllcky13-droid.github.io/fsu/ and `…/fsu/scenes.html` (GitHub Pages, from `main`);
install sheet `…/fsu/install.html`. Used on iPads (the main device), iPhones and desktops in the
field, often with no signal.

Only van data syncs, to the private repo `drfllcky13-droid/van-data` (`data.json`), with a
fine-grained token on each device. Case material (incidents, forms, sketches, photographs) never
leaves the device except as an exported PDF, Word file, DXF or case package.

Out of scope unless the user asks: a server, a framework, a build-tool migration, a rewrite,
merging the two apps.

## 2. Standing rules

**Working with the user**
- Build only what the user has approved. Beyond routine fixes, ask first: one decision at a time,
  with a recommended option, as you go.
- The user is often on a phone and is not a developer. Say what changes for a technician, not the
  internals. Keep reports short and lead with the decision needed.
- **No chat replies** (the user's instruction, 24 Sep). Do not write responses, progress notes or
  summaries in chat. Say only one line when ready for the next phase, or ask the one decision that
  blocks work. Everything else goes in HANDOFF.md, PLAN.md and the PR.
- Never touch `drfllcky13-droid/van-data` (the real data) without approval of the exact change.
- Keep the two apps separate: no button, tab or link from one into the other (`pages.spec.js`).

**Building**
- No refactors beyond what a change needs. No server, framework or build-tool migration.
- One commit per item, on a branch with a draft PR. Merge only when the user has approved it or
  the change is truly routine, and always with a merge commit (never squash).
- After every change: `node build.js`, then the full `fsu-tests` suite except `visual.spec.js`
  (it includes the lint; `npm run lint` runs it alone).
- A bug fix comes with a test that fails before the fix. Never skip, disable or weaken a test to
  get CI green; find the cause.
- User-facing changes get a plain-language `CHANGELOG.md` entry written for technicians, the
  matching line in the in-app `CHANGELOG` in `src/ext-reports.js`, and an `APP_VERSION` bump
  (`YYYY.MM.DD.N`).
- Keep `BRIEF.md`, `SYNC_DESIGN.txt`, `src/README.md` and `install.html` true when a change makes
  them wrong.
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- After a merge: both live pages serve the new `APP_VERSION` with 0 CSP violations, and `main`'s CI
  passes.

**Tracker**
- The user's "Baton" tracker artifact: https://claude.ai/artifact/4BeGhYgGc7C58oUk9XFH1n,
  collection `projects`, doc `fsu` (fields `who`, `carry`, `status`, `needs`, `by`, `updated`).
- When a tool can write to it, update doc `fsu` at the end of each session: `who` = `code` while
  working, `me` when waiting on the user, `idle` when nothing is pending; `by` = `code`.
- Read the doc first and pin the write to its version. Only ever write doc `fsu`: on 23 September
  another project's status was written into it by mistake and had to be overwritten.

## 3. Decisions made, with reasons

**Front end** (design pass, 2026.09.23.1)
- FSU Home is titled "Home", to match its tab.
- The six status tiles became one slim strip: amber chips for problems, one grey "All clear" chip
  for the rest. The tiles repeated the urgent list and pushed it below the fold on phones.
- One-time setup jobs sit in their own "Finish setting up" panel, which goes away when they are
  done; they had been mixed in with daily work.
- On a phone the title comes first, with a search icon and a gear in the header; the Settings link
  in the middle of Home is gone and search stays hidden until tapped.
- The save status stays on screen: grey "Saved", green "Synced HH:MM", blue "Saving…", amber
  "Offline", red "Not saving". The old one flashed and vanished, and sync state matters to the unit.
- Scenes has its own violet accent; the two apps looked identical inside.
- Scenes has no side bar or tab bar (there was only one entry): a gear opens Settings, "+ New"
  starts an incident, the Open/Closed tiles are the filter, and Settings and the incident page go
  back with "‹ Scenes". On a phone it shows one card per incident, not a squeezed table.
- Small text went up a step for gloves and arm's-length reading (tile labels 11→13 px, hints
  12.5→14, list text 13.5→15); tap targets are at least 44 px.
- FSU search has no "Forms" filter (forms live in Scenes). Quick find shows "Not placed", not a dash.
- Icons: keep the FSU van icon (the user likes it). The Scenes icon is an evidence marker with an
  L-scale on violet (option A of four; source `scenes-icon.svg`).

**Sync and data** (PRs #1–#7; the mechanics are in [SYNC_DESIGN.txt](SYNC_DESIGN.txt) and [BRIEF.md](BRIEF.md))
- The sync base is what the repo holds, not the live copy; one sync at a time, 20 s limit, no
  empty commits, rate limits wait instead of killing sync. Reason: four reproduced silent
  data-loss bugs.
- Old-build devices merge three ways against their last synced file on first sync (tested on a
  copy of the real `data.json`).
- Backups hold van data only, by a fixed list of fields. Restore while sync is connected only adds
  what is missing.
- Everything from outside (sync, backups, case packages, stored sketches) is validated, output is
  escaped, and a CSP with a script hash stands behind both. Reason: one bad record could otherwise
  run code on every device and read the token.
- Case-package import asks before replacing anything that differs: Keep mine (default), Use the
  package's, or Keep both.
- The "Safari can delete everything" bar shows on Apple devices only: the 7-day rule applies
  there; Chrome clears storage only when the disk runs short, so a bar there would be noise.
- The storage meter warns at 70%. Only closed cases that are fully packaged and unchanged since
  the package can be removed.
- The service worker handles this site's own files only, waits 3 s for the network before opening
  from the cache, offers Reload/Later on an update and never reloads by itself; offline, Scenes
  falls back to Scenes.
- Deletion markers are kept 365 days; a device away longer rejoins as new and holds back its
  local-only records for the user to decide.
- A saved record that cannot be read is copied aside, never written over. Photographs an export
  could not read are named. The orphan-photograph clean-up asks first.
- jsPDF 2.5.1 → 4.2.1 and svg2pdf → 2.8.1 (16 published advisories); `lib/` is checked against
  checksums; Playwright is pinned.
- Rollout: after PR #1 the user connected sync on one device and saw 103 items, not the 72 in
  `data.json`. The user confirmed 103 is right: items logged on an older, unsynced build merged in.
  Not a duplicate problem.

**Backlog decisions**
- Dropped, reasons in [BRIEF.md](BRIEF.md) §6 ("Decided against"): Linux visual baselines, a
  per-page CSS split, folding the `ext-*` layers as a project, and shrinking the pages unless
  technicians report slow opens (the PR #5 service worker covers a slow signal).
- Lint exceptions, option (a): `newSketch`, `bundleIncident` and `exportFill` stay in
  `fsu-tests/lint-allow.json` with their reasons. None can run on the van page, and a guard would
  hide a real future mistake.

## 4. Roadmap

1. ~~Merge PR #9 and confirm 2026.09.30.1 live.~~ Done 24 Sep (e27ae1a; 0 CSP violations, CI green).
2. ~~Record the lint decision in BRIEF.md.~~ Done in PR #10 (bb79e9b).
3. ~~Mutation pass: `node fsu-tests/mutate.js 25`, a test for each real survivor.~~ Done in PR #10
   (71c14e8): 17 tests, 3 harmless survivors listed in [HANDOFF.md](HANDOFF.md).
4. **Merge PR #10** once the user approves it (tests and docs only; no app change).
5. Then idle: wait for feedback from the field (open question 5) before starting new work.

**Watch items** (not work)
- svg2pdf must load after jsPDF; only the vector sketch export loads it, after `loadPDF()`.
- `bulk.spec.js` has a render-time budget that has occasionally failed under load.
- One unexplained failure on the PR #8 branch has not recurred; `fsu-tests/last-run.txt` and the
  end of every run now name any failure.

## 5. Open questions for the user

Keep each until it is answered.

1. **iPad PDF check.** After the jsPDF 4.2.1 upgrade, export one incident bundle (or a report or a
   sketch) as PDF on the iPad and open it. Does it look right? The pixel comparison ran on a PC and
   cannot cover iPad Safari.
2. **Offline check on the iPad.** Open both apps online, switch on airplane mode, then open each
   from its home-screen icon. Does FSU open as FSU and Scenes as Scenes?
3. **Rollout.** Are all devices connected to sync and showing the same item count?
4. **Old Scenes icon.** Was it replaced on the devices that had it? If not: remove it and add it again.
5. **Field requests.** Have the technicians asked for any feature or change? That decides what
   comes after the mutation-test pass.

## Where we are

*Rewritten at the end of every session. Last: 24 September 2026.*

- Live: **2026.09.30.1** (`main` at e27ae1a), both pages with 0 CSP violations; `main`'s CI green.
- Open: draft [PR #10](https://github.com/drfllcky13-droid/fsu/pull/10), the 17 mutation tests
  and two BRIEF.md notes. CI green on 71c14e8, 311/311 locally. Waiting on the user's approval to
  merge.
- Next: roadmap step 4, then idle until the open questions above get answers.
