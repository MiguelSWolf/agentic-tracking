# F-008: "Agent notes" appear twice in agent PR bodies

- Status: fixed ([#26](https://github.com/MiguelSWolf/agentic-tracking/pull/26))
- Area: PR template
- Source: owner
- Found: 2026-11-22
- Evidence: [#17](https://github.com/MiguelSWolf/agentic-tracking/pull/17)

## What happened

The agent wrote its own `<details>` block and the workflow wrapped it in another one.

## Proposed fix

`issue-flow` says not to add the `<details>` wrapper, or the workflow stops adding it.

## Decision

Fixed by rule. `issue-flow` step 5 forbids the agent's own `<details>` wrapper.
