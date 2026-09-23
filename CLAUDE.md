# FSU

`BRIEF.md` is the project brief: structure, storage, sync and the things that bite. Keep it
correct when a change makes it wrong. (It was called `HANDOFF.md` until 2026-09-23.)

## Handoff protocol
Chat plans, Code builds, the user relays. HANDOFF.md is the mailbox.

Start of every session and every scheduled check-in: read HANDOFF.md.

Do it yourself, no handoff: bug fixes, red CI, refactors, dependency bumps, and anything already specified in the current phase plan.
Hand to CHAT: end of a phase or numbered item, a design decision, unclear or conflicting requirements, or stuck after two attempts.
Hand to ME only for things only the user can do: merges, approvals, credentials, real-device or real-world checks.

End of every task: overwrite HANDOFF.md with the footer below plus a "## Report for Chat" section (what changed, commit hashes, test results, decisions needed with options). Commit and push it with the work. End your reply with the footer:

PROJECT: <name>
BATON → CODE / CHAT / ME / IDLE
Carry: <the single next action and who does it>
Status: <phase + what's done, one line>
Blocked on: <what needs the user, or "nothing">
