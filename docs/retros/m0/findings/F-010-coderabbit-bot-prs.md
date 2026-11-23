# F-010: CodeRabbit skips every PR authored by `github-actions[bot]`

- Status: open
- Area: Review (CodeRabbit)
- Source: owner
- Found: 2026-11-22
- Evidence: [#16](https://github.com/MiguelSWolf/agentic-tracking/pull/16) ("bot user without a review seat")

## What happened

The bot author has no review seat. While the repository is private, CodeRabbit also gives only a summary.

## Proposed fix

Make the repository public, which gives full reviews on the free plan. Check the history for secrets first.

## Decision

Open, follow-up issue proposed: "Decide on making the repository public, after a secret scan of the history". Owner-only decision.
