# F-007: The `pull_request` CI run fails with no jobs on PRs opened by the bot

- Status: open
- Area: CI
- Source: owner
- Found: 2026-11-22
- Evidence: [run 45018489475](https://github.com/MiguelSWolf/agentic-tracking/actions/runs/45018489475) on [#11](https://github.com/MiguelSWolf/agentic-tracking/pull/11)

## What happened

The `pull_request`-triggered CI run failed without starting any job, while the CI run dispatched by `agent-implement` passed. The PR shows a red check.

## Proposed fix

Find out why the event run starts without jobs. Then fix it, or skip the `pull_request` trigger for `agent/*` branches, because the dispatched run already covers them.

## Decision

Open, follow-up issue proposed: "Investigate the empty `pull_request` CI run on agent PRs, or skip it for `agent/*`". `.github/` is protected, so the owner applies it.
