---
name: review-pr
description: Use when reviewing a pull request in this repo (as Claude, Codex or another reviewer), or when applying review feedback on a PR after an `@claude` request. Gives the review order, the checks per kind of change, the comment format and how to answer review threads.
---

# Review a PR / apply review feedback

Two modes. **Review** produces findings for the owner. **Respond** applies the owner's `@claude`
request. Rules live in `AGENTS.md`, `docs/adr/README.md` and `docs/code-standards/`: cite them,
do not restate them.

## Mode 1: Review

### Read first
1. The PR body: Why, Decisions, Acceptance criteria → evidence, and Out of scope findings.
2. The Linear issue and its approved plan (`Fixes TRK-<n>`), if any.
3. `docs/adr/README.md` and every ADR the PR lists under "ADRs touched".
4. The diff. Read every non-fixture file in full. Sample the fixtures.

### Review order (stop and report a P1 as soon as you find one)
1. **Domain invariants** (`AGENTS.md`) and ES-* rules.
2. **Missing tests** the rules require: a contract test per event version (ES-06, TEST-15), a replay
   test per projection (ES-15, TEST-16), the concurrent-append test (TEST-17), the bus contract suite (TEST-18).
3. **ADR violations.** A change that contradicts an Accepted ADR needs a superseding ADR first.
4. **Docs and specs (ADR-0012).** Did a behaviour change update `docs/specs/` or the matching doc?
5. **Correctness.** Edge cases, error paths, and whether the tests could pass while the code is wrong
   (assertions that are too weak, examples that test the end state only).
6. **Security and privacy.** PII (ES-09, NODE-13, ADR-0009), secrets (NODE-11), injection (NODE-16), trust rules (ADR-0008).
7. **Code standards.** Cite the rule ID (`TS-14`, `NODE-02`, …). Skip anything Biome already reports.

### Checks per kind of change
| Change touches | Check |
| --- | --- |
| `packages/event-schemas` | literal `version`, strict objects, ≥2 valid and ≥2 invalid fixtures, each invalid fixture breaks one thing and asserts `expected_path`, registry ↔ fixtures in sync, published versions unchanged (ES-07) |
| projections | pure handlers (ES-12), idempotent writes (ES-13), checkpoint owned by the runner (ES-14), replay test (ES-15), version bump for a logic change (ES-16) |
| event store | append-only (ES-01), advisory lock (ES-03), `position` order (ES-02), parameterised SQL (NODE-16) |
| docs / code standards | links resolve, rule IDs unchanged, no copy of ADR content (ADR-0012) |
| `.github/`, `.agents/`, protected paths | only the owner may change these (G5). Flag it if an `agent/*` branch touches them |

### Comment format
Write one inline comment per finding, on the exact line:

```
**[P1|P2|P3] <short title>**
<what is wrong and why, in 1–3 sentences, citing the rule ID or ADR>
Suggested fix: <concrete change>
```

- **P1:** blocks the merge (an invariant, an ADR, a MUST rule, data loss, security).
- **P2:** should be fixed in this PR (correctness, a missing test, a SHOULD rule with no stated reason).
- **P3:** a nice-to-have or a wording issue. It can be fixed now or left for later.

### Summary (top-level review comment)
```
Verdict: approve | request changes
Findings: P1 ×n, P2 ×n, P3 ×n

<one line per finding, with a link to its inline comment>
```
If there is anything to fix, end with a **plain-text** block the owner can paste as a PR comment.
Never use a formatted mention: a linked or bold `@claude` does not trigger the agent (F-002).

    @claude please address the review comments on this PR, commit the fixes on this branch and reply to each thread:
    1. [P2] <file>:<line> — <fix>
    2. ...
    Run pnpm lint, typecheck and test before committing.

## Mode 2: Respond (an `@claude` request on a PR)

1. Read every open review thread and the request. Do only what they ask (scope discipline).
2. Fix each item in a small commit (Conventional Commits), then run `pnpm lint && pnpm typecheck && pnpm test`.
3. **Reply to every thread** with what changed and the commit SHA (F-004). Resolve the thread only if
   the fix is exactly what was asked. If you disagree with a comment, reply with your reason and leave
   the thread open for the owner.
4. Post one summary comment that lists each thread → commit.
5. Never weaken a test or an assertion to make a comment go away (TEST-09).

## Record process gaps (both modes)

If the review or the iteration hits a gap in the process or tooling, add a finding file in the same
PR, following [docs/workflow/findings.md](../../../docs/workflow/findings.md). Examples: a command you
could not run, context you could not reach, a rule that contradicts another, a check that should have
caught something. Get the ID with `node scripts/findings-index.mjs --next <milestone>`, then run
`pnpm findings:index`.
