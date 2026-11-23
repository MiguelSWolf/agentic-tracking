# F-013: The protected-paths guard flagged files that changed on main, not on the agent branch

- Status: fixed ([#27](https://github.com/MiguelSWolf/agentic-tracking/pull/27))
- Area: CI
- Source: owner
- Found: 2026-11-23
- Evidence: [run 45168937544](https://github.com/MiguelSWolf/agentic-tracking/actions/runs/45168937544) on [#23](https://github.com/MiguelSWolf/agentic-tracking/pull/23)

## What happened

CI on PR #23 failed with "Protected paths changed by an agent branch: `docs/code-standards/testing.md`". The file came from PR #22, which merged into `main` minutes earlier. The guard diffed `base.sha...HEAD`, where `HEAD` is the PR merge commit, which includes the newer `main`.

## Proposed fix

Diff `origin/main...<pull_request.head.sha>`, so the guard lists only the branch's own changes.

## Decision

Fixed. [#27](https://github.com/MiguelSWolf/agentic-tracking/pull/27) is merged (`4eeecf9`).
