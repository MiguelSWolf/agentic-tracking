# F-001: Plan phase was capped at 25 turns, too few for plans that verify sources

- Status: fixed ([#15](https://github.com/MiguelSWolf/agentic-tracking/pull/15))
- Area: Gate G1
- Source: workflow
- Found: 2026-11-22
- Evidence: [run 45027257235](https://github.com/MiguelSWolf/agentic-tracking/actions/runs/45027257235) (TRK-18 plan)

## What happened

The TRK-18 plan run finished its work after 32 turns and was marked failed, because the plan phase allowed 25. Verifying source anchors with WebFetch costs one turn each.

## Proposed fix

PR #15 raised the plan phase to 40 turns.
