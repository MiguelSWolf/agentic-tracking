# Workflow

How work flows from a Linear issue to a merged PR. This page links to the sources of the
rules; it does not copy them. Policy on docs: [ADR-0012](../adr/0012-living-specs-and-docs.md).
Gate calibration: [ADR-0011](../adr/0011-calibration-metrics.md).
Process gaps found along the way: [findings.md](findings.md).

## Roles

| Role | Does |
| --- | --- |
| Owner | Decides, approves plans, reviews and merges. Owns protected zones. |
| Claude | Plans and implements issues, iterates on PR feedback. |
| CodeRabbit | Reviews agent PRs. |
| Codex | Audits the codebase at the end of a milestone. |

## Gates

| Gate | Meaning | Enforced by |
| --- | --- | --- |
| G0 | Issue is ready for an agent (`agent:ready`) | Linear label, see [`.github/linear-labels.md`](../../.github/linear-labels.md) |
| G1 | Owner approves the plan (`plan:approved`) | `.github/workflows/agent-implement.yml` |
| G2 | Owner reviews the draft PR and merges | Branch ruleset, CODEOWNERS |
| G3 | Owner iterates on the PR with `@claude` | `.github/workflows/agent-pr-iterate.yml` |
| G4 | Audit findings become Linear issues | `.github/workflows/audit-to-linear.yml` |
| G5 | Protected zones need the owner's review | `.github/CODEOWNERS`, `guard-protected-paths` job in `.github/workflows/ci.yml` |

## Flow

1. Linear issue gets `agent:ready` (G0).
2. Claude writes a plan as a Linear comment.
3. Owner replies with feedback or adds `plan:approved` (G1).
4. Claude implements on `agent/trk-<n>-<slug>`; the workflow opens a draft PR.
5. CodeRabbit and the owner review; Claude iterates on `@claude` comments (G2, G3).
6. Owner merges. The PR contains `Fixes TRK-<n>`, which closes the issue.

## Sources

- Rules for every agent: [`AGENTS.md`](../../AGENTS.md)
- Skills (in `.agents/skills/`):
  - [`issue-flow`](../../.agents/skills/issue-flow/SKILL.md)
  - [`review-pr`](../../.agents/skills/review-pr/SKILL.md): how to review a PR and apply review feedback
  - [`write-adr`](../../.agents/skills/write-adr/SKILL.md)
  - [`new-event-type`](../../.agents/skills/new-event-type/SKILL.md)
  - [`new-projection`](../../.agents/skills/new-projection/SKILL.md)
  - [`code-health-audit`](../../.agents/skills/code-health-audit/SKILL.md)
- PR template: [`.github/pull_request_template.md`](../../.github/pull_request_template.md)
