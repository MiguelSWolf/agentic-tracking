# F-006: The agent sandbox cannot write `.env*` files

- Status: accepted
- Area: Agent sandbox
- Source: agent
- Found: 2026-11-22
- Evidence: [#17](https://github.com/MiguelSWolf/agentic-tracking/pull/17) (TRK-7, `.env.example`)

## What happened

TRK-7 needed `.env.example`. The agent put the content in the PR body and the owner committed it.

## Proposed fix

None. This is a sensible default of the action and rarely needed.
