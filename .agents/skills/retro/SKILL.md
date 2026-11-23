---
name: retro
description: Use for the milestone retrospective issue (label type:retro). Collects the milestone's findings, calibration metrics and audit, decides every finding (fix, accept or already fixed), applies ADR-0011 to the gates, and writes docs/retros/<milestone>.md. Not for reviewing a single PR.
---

# Milestone retro

The retro closes the loop on the process. It is not a status report. Every finding of the milestone
leaves it with a decision. Every gate change is justified by ADR-0011 numbers. Run it through
`issue-flow` like any issue: the plan phase lists the decisions, and the implement phase writes the files.

## Inputs (all in the run; read every one)

| Input | Where |
| --- | --- |
| The retro issue, with owner notes | `.agent-out/issue.md` |
| Findings already in the repo | `docs/retros/<milestone>/findings/F-*.md` and its `README.md` |
| Findings opened by failed or degraded runs (Linear `source:finding`) | `.agent-out/retro-inputs.md`, written by the workflow |
| The milestone's issues, with size labels and state | `.agent-out/retro-inputs.md` |
| Review comments and `@claude` requests on the merged agent PRs | `.agent-out/reviews.md`, written by the workflow |
| Calibration metrics (ADR-0011) | `.agent-out/metrics.md`, written by the workflow with `scripts/agent-metrics.mjs` |
| The code-health audit (G4) | `docs/audits/<milestone>.md`, if it exists |
| Earlier retros, for the trend | `docs/retros/*.md` |

If an input is missing, say so in the retro and in the PR. Never invent numbers. If the metrics
are `n/a (incomplete…)`, report them as they are.

## Steps

1. **Import Linear findings.** For each `source:finding` issue that has no `F-*` file yet, create one
   (`node scripts/findings-index.mjs --next <milestone>`). Use `Source: workflow` and put the Linear
   issue and run links under Evidence. Merge duplicates into one file and list every link.
2. **Decide every finding.** Set its `Status` and add a `## Decision` section to its file:
   - `fixed (#PR)`: point to the PR that fixed it. Check that the PR is merged.
   - `accepted`: explain why living with it is cheaper than fixing it.
   - `open` → propose a follow-up issue. The status stays `open` until the owner creates the
     issue, then becomes `in progress (TRK-n)`.
   A finding never leaves the retro without a `## Decision`.
3. **Look for patterns.** Group findings by area. Do the same with the review comments in
   `reviews.md`: when the same kind of correction shows up in **two or more PRs**, or the owner flagged it,
   it is a recurring problem. For each recurring problem, propose **one concrete rule change** in
   `AGENTS.md`, a skill, a code standard or `.coderabbit.yaml`, with the PR links as evidence. Models do not
   learn between runs, but the rules they read do. Propose that change, not one fix per comment.
4. **Calibrate the gates (ADR-0011).**
   - Copy the metrics table as it is.
   - Compute the share of **`size:S`** agent PRs merged unchanged. Map each merged agent PR
     (`Fixes TRK-n`) to its issue's size label from the inputs, and show the PRs you counted.
   - Apply the rule exactly: G1 becomes optional for `size:S` only after **two consecutive
     milestones** at ≥ 80%. G2 and G5 are never relaxed. The first milestone is a baseline.
   - Never recommend a gate change that ADR-0011 does not allow. If the numbers suggest the rule
     itself is wrong, propose a superseding ADR via `write-adr`.
5. **Audit.** For each audit finding, say whether it became a Linear issue (G4 triage) and what
   happened to it.
6. **Write `docs/retros/<milestone>.md`** with the template below, run `pnpm findings:index`, and
   link the retro from `docs/retros/README.md`.

## Template: `docs/retros/<milestone>.md`

```markdown
# <Milestone> retro

- Date: YYYY-MM-DD
- Scope: <milestone name>, issues TRK-a … TRK-b

## Outcome
2–4 sentences: what the milestone set out to prove and whether it did.

## Calibration (ADR-0011)
<metrics table, copied as is>
`size:S` merged unchanged: x of y (z%). PRs counted: #…
Gate decision: <unchanged / G1 optional for size:S>, because …

## Findings
| ID | Finding | Decision | Follow-up |
| --- | --- | --- | --- |
(one row per finding, every finding of the milestone)

## Patterns and rule changes
- <problem>: evidence (F-…, PR #…, #…) → <exact rule, skill or check change>

## Audit (G4)
<summary, or "No audit report for this milestone.">

## Follow-up issues
| Title | Why (findings) | Size | Protected zone? |
| --- | --- | --- | --- |

## Keep doing
- 2–4 practices that worked, each with evidence.
```

## PR body

- Follow `issue-flow`. Under **Decisions**, list every finding decision and the gate decision.
- Add a **Follow-up issues** table that the owner can create in Linear as it is. The agent cannot create
  Linear issues.
- Changes to protected files go under "Proposed changes (owner)" with the exact text. This covers
  skills, `AGENTS.md`, `.github/` and `docs/code-standards/`.

## Never

- Drop a finding, or decide it without a reason.
- Relax G2 or G5, or relax G1 outside the ADR-0011 rule.
- Edit an Accepted ADR. A different rule needs a superseding ADR.
