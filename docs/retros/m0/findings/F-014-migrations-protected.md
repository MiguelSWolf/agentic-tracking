# F-014: `**/migrations/` is protected, so no agent can create the event-store migration

- Status: open
- Area: Protected zones
- Source: owner
- Found: 2026-11-23
- Evidence: [TRK-23](https://linear.app/agentic-tracking-mw/issue/TRK-23) plan (proposes ADR-0014 and the first event-store migration); AGENTS.md "Protected zones"

## What happened

AGENTS.md lists `**/migrations/` as a protected zone, and CI fails any `agent/*` branch that touches it. The M1 event store needs its first migration, so an agent cannot deliver that issue as written.

## Proposed fix

Allow agents to **add** new migration files, never to **modify or delete** an existing one. Enforce it in the CI guard (added files pass, modified, renamed or deleted files fail) and keep CODEOWNERS review on `**/migrations/`. The guard and AGENTS.md are protected, so the owner applies the change.

## Decision

Open, follow-up issue proposed: "Let agents add new migration files, never modify existing ones". See the retro's follow-up table.
