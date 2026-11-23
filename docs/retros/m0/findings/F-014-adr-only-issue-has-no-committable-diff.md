# F-014: An ADR-only issue has no committable change for a CI agent

- Status: open
- Area: agent context, protected zones (G5)
- Source: agent
- Found: 2026-11-23
- Evidence: TRK-23 (supersede ADR-0002 storage design)

## What happened

TRK-23 is a decision issue. Its only real output is a new ADR, an ADR-0002 status change and an
ES-04 edit. `docs/adr/` and `docs/code-standards/` are protected zones, so the agent cannot commit
any of them. The workflow fails a branch with no commits. The agent had to carry the ADR text in the
PR body and add this finding file to have something to commit.

## Proposed fix

Pick one route for ADR-only issues:

- the owner pushes the ADR to the agent branch before the PR opens; or
- the workflow accepts a branch with no commits when the issue has `type:docs` and the PR body
  contains a "Proposed ADR" section; or
- a dedicated path (for example `docs/adr-proposals/`) that agents may write and the owner moves.

Related, but separate: the retro (TRK-11) records the finding about `**/migrations/` being protected.
