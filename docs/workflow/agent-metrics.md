# Agent calibration metrics

`pnpm agent:metrics [--since YYYY-MM-DD]` prints the calibration metrics of
[ADR-0011](../adr/0011-calibration-metrics.md) as a markdown table, ready to paste into a
milestone retro. ADR-0011 explains how the numbers are used to relax gates.

## Running it

- **Locally:** `gh auth login`, then `pnpm agent:metrics --since 2026-11-01`.
- **In GitHub Actions:** `gh` is preinstalled. Set `GH_TOKEN: ${{ github.token }}` and run
  `node scripts/agent-metrics.mjs`. No `pnpm install` is needed, the script uses only Node
  built-ins. Redirect stdout to `$GITHUB_STEP_SUMMARY` to show the table in the job summary.

Errors go to stderr and the exit code is 1. The table goes to stdout.

## Definitions

Agent PRs are the PRs whose head branch starts with `agent/`.

| Metric                                        | Definition                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Opened                                        | Agent PRs with `createdAt` on or after `--since` (all history without it).                                                                                                                                                                                                                                                                                                      |
| Merged                                        | Agent PRs with `mergedAt` on or after `--since`. The metrics below use only these PRs.                                                                                                                                                                                                                                                                                          |
| Merged with no commits after ready-for-review | Share of merged PRs with no commit whose `committedDate` is after the ready-for-review time. Every commit counts, whoever wrote it. The ready time is the first `ReadyForReviewEvent`, or `createdAt` if the PR was never a draft. `n/a` if nothing merged.                                                                                                                     |
| Median `@claude` rounds                       | Per PR, the number of issue comments, and of submitted reviews, with a plain-text `@claude` request. Mentions in code blocks, inline code or quoted lines, formatted mentions (`**@claude**`) and longer handles (`@claude-bot`) do not count. A review counts once, even with several inline mentions. Bot authors are excluded. PRs with 0 rounds are included in the median. |
| Median draft to merge                         | `mergedAt - createdAt` in hours (agent PRs are opened as drafts).                                                                                                                                                                                                                                                                                                               |

## Known limits

- `committedDate` is set by the commit author. A rebase, or a commit made earlier and pushed
  later, can mislabel a PR. GraphQL has no reliable push time.
- `gh pr list` is capped at 1000 PRs, and each timeline query reads 100 items per page. The
  script warns on stderr when a cap is hit. If a review's inline comments are truncated, the rounds median is printed as `n/a (incomplete: …)`. If the outer timeline of a merged PR is truncated, both the rounds median and the "no commits after ready-for-review" percentage are withheld that way, because a post-ready commit or the first ready event may be missing. Inline-comment truncation alone does not affect the percentage. Code fences are matched by character and length, so a shorter fence inside a longer block does not end it.
- There is no breakdown by `size:` label (labels live in Linear), and no "review findings
  accepted vs. rejected" figure. Both are out of scope.

## Deviations from code standards

The script is plain `.mjs` run by `node`, with Vitest tests in `scripts/*.test.mjs`. TS-* rules
do not apply.

- NODE-12 (JSON logger): not followed. Output is a human-readable table and errors are plain
  text on stderr.
- NODE-10 (config module): not needed. The script reads no `process.env`. `gh` reads `GH_TOKEN`.
- NODE-15 (zod): `gh` output is validated by hand in `normalisePr`, because zod is not a root
  dependency.
