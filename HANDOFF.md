PROJECT: FSU (drfllcky13-droid/fsu)
BATON → ME
Carry: The user approves draft PR #10 (mutation tests, BRIEF notes, PLAN.md); Code merges it and confirms live.
Status: 2026.09.30.1 live; PR #10 green; PLAN.md written; Code now plans and builds.
Blocked on: approval of PR #10, and the five open questions in PLAN.md §5

## Report

**2026-09-24.** Live `APP_VERSION` 2026.09.30.1 (`main` e27ae1a). The plan, rules, decisions and
open questions are in [PLAN.md](PLAN.md).

### What changed this session (all on draft [PR #10](https://github.com/drfllcky13-droid/fsu/pull/10))
- `bb79e9b` BRIEF.md: why the three lint exceptions stay; page size dropped unless opens are slow.
- `71c14e8` `fsu-tests/tests/mutants.spec.js`: 17 tests for the gaps `mutate.js 25` found. Each
  fails on its mutant.
- `a61f03e` the previous report.
- `4a0c98f` PLAN.md (new), CLAUDE.md (read PLAN.md first; hand to the user, not Chat), README.md.
- This commit: this report.

### Tests
- Full suite minus `visual.spec.js`: 311/311 in Chromium; `node build.js --check` passes.
- CI green on 71c14e8.

### Mutation survivors with no test (equivalent or harmless)
- `src/events.js:25`: `return renderList()` → `return void renderList()`. The value is unused.
- `src/chrome.js:44`: `navigator.storage&&estimate` → `||`. Inside `try{}catch(e){}`, so the outcome is the same.
- `src/sketch-controls.js:47`: `sk&&o` → `sk||o`. It only differs for a Renumber button naming a missing object, which is never drawn.

### Decisions needed
1. Approve PR #10 for merge (tests and docs only; nothing a technician sees changes). Recommended: yes.
