# F-003: Iterations could not run `pnpm` on PRs opened by `github-actions[bot]`

- Status: fixed ([#20](https://github.com/MiguelSWolf/agentic-tracking/pull/20))
- Area: Gate G3
- Source: workflow
- Found: 2026-11-23
- Evidence: [run 45044447500](https://github.com/MiguelSWolf/agentic-tracking/actions/runs/45044447500) on [#19](https://github.com/MiguelSWolf/agentic-tracking/pull/19)

## What happened

The action refused every `pnpm` command because the PR author is not confirmed to have write access. The agent edited files but did not commit.

## Proposed fix

PR #20 set `restrict_untrusted_prs: "false"`, which is safe because only the owner can trigger the job. An owner token for PRs was rejected: the owner could no longer approve agent PRs (G2).

## Decision

Fixed. [#20](https://github.com/MiguelSWolf/agentic-tracking/pull/20) is merged (`ba3b2e3`).
