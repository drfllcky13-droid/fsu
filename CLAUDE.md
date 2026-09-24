# FSU

**Read `PLAN.md` first.** It holds the goals, the standing rules, the decisions made and why, the
roadmap and the open questions for the user. Change it in the same commit as anything that makes
it wrong, and rewrite its "Where we are" section at the end of every session.

`BRIEF.md` is the project brief: structure, storage, sync and the things that bite. Keep it
correct when a change makes it wrong. (It was called `HANDOFF.md` until 2026-09-23.)

## Handoff protocol
Since 2026-09-24 Code plans and builds; the planning chat has stepped away. Decisions and
approvals go to the user. HANDOFF.md is the detailed report of the last session.

Start of every session and every scheduled check-in: read PLAN.md, then HANDOFF.md.

Do it yourself, no handoff: bug fixes, red CI, refactors, dependency bumps, and anything already on the roadmap in PLAN.md.
Hand to ME (the user): the end of a roadmap item, a design decision, unclear or conflicting requirements, being stuck after two attempts, and anything only the user can do: merges, approvals, credentials, real-device or real-world checks. One decision at a time, with a recommended option.

**Chat replies: none.** Do not write responses, progress notes or summaries in chat. The only
chat message is one line saying you are ready for the next phase, or the one question that blocks
work (see PLAN.md §2).

End of every task: overwrite HANDOFF.md with the footer below plus a "## Report" section (what changed, commit hashes, test results, decisions needed with options), and rewrite "Where we are" in PLAN.md. Commit and push them with the work. The footer, in HANDOFF.md:

PROJECT: <name>
BATON → CODE / ME / IDLE
Carry: <the single next action and who does it>
Status: <phase + what's done, one line>
Blocked on: <what needs the user, or "nothing">
