# F-005: `pr-context` does not include the parent issue's plan and owner feedback

- Status: open
- Area: Agent context
- Source: agent
- Found: 2026-11-22
- Evidence: TRK-17 plan (open question 1); TRK-17 to TRK-20 needed hand-written context comments

## What happened

Sub-issues TRK-17 to TRK-20 say "follow the approved plan in TRK-16", but `scripts/linear.mjs pr-context` only reads the issue's own comments.

## Proposed fix

When the issue has a parent, `pr-context` also includes the parent's description, latest plan and owner feedback. `scripts/linear.mjs` is protected, so this is an owner change.

## Decision

Open, follow-up issue proposed: "pr-context includes the parent issue's plan and owner feedback". `scripts/linear.mjs` is protected, so the owner applies it. See the retro's follow-up table.
