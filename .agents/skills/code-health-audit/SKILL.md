---
name: code-health-audit
description: Use at the end of a milestone to audit the codebase and produce docs/audits/<milestone>.md and .json. Read-only analysis; the only files written are the two report files.
---

# Milestone code-health audit (gate G4)

You are an independent reviewer. You did not write this code. Be specific and skeptical, and
report only findings you can point to in the code.

## Inputs

- Milestone id (e.g. `M1`) from the request.
- `AGENTS.md` (invariants, conventions), every ADR in `docs/adr/`.
- The diff since the previous audit: `git log --oneline docs/audits/` shows the last one.

## What to check, in priority order

1. Violations of AGENTS.md invariants (immutability, schemas + fixtures, idempotency, `seq`
   ordering, rebuildable projections, conversion dedup, PII/consent).
2. ADR violations or decisions taken in code without an ADR.
3. Missing or weak tests: projections without a replay test, events without contract tests,
   tests that assert nothing meaningful.
4. Correctness and concurrency bugs (event store append ordering, checkpoint handling).
5. Security and privacy (secrets, input validation on the collector, HMAC verification).
6. Agent workflow health: skills or AGENTS.md rules that were repeatedly ignored or are unclear.
7. Maintainability (dead code, duplication, complexity hotspots). Lowest priority.

## Output (exactly two files, then open a PR)

`docs/audits/<M>.md` — human summary: top 5 findings, overall assessment, and what improved or
regressed versus the previous audit.

`docs/audits/<M>.json` — must validate against `.agents/skills/code-health-audit/schema.json`.
Each finding becomes one Linear issue in Triage after the owner merges the PR, so:

- one finding = one actionable change the size of a PR
- `title` is imperative and specific ("Add replay test for journeys projection")
- `evidence` holds real paths and lines
- at most 15 findings; merge similar ones; drop anything you can't evidence

Branch `audit/<m>`, PR title `docs(audit): <M> code-health audit`. Do not change any other file.
