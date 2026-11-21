---
name: issue-flow
description: Use when working a Linear issue (TRK-<n>) end to end — planning it (plan phase) or implementing it into a draft PR (implement phase). Not for audits or ADR writing.
---

# Issue flow (Linear → plan → PR)

The workflow passes you the issue (identifier, title, description, acceptance criteria, labels)
and a `PHASE`. Follow the phase exactly.

## PHASE = plan (gate G1)

Change no source files. Write `.agent-out/plan.md` with:

```markdown
## Plan for TRK-<n>: <title>

**Understanding:** 1–2 sentences restating the goal in your own words.

**Approach:**
1. <step> — files: `path/a.ts`, `path/b.ts`
2. ...

**Tests:** which tests prove each acceptance criterion (name them).

**Touches ADRs:** ADR-00X (how) — or "none".

**Risks / open questions:** bullet list, or "none". If a question blocks you, say so and stop here.

**Size:** S (<100 lines) | M (100–400) | L (>400 → propose a split instead).
```

Read `AGENTS.md`, the ADRs the issue touches, and the code you will change before writing the plan.

## PHASE = implement (only with `plan:approved`)

1. Re-read the approved plan (it is in the issue comments the workflow passes you).
   If the plan comments contain owner feedback, apply it.
2. `git switch -c agent/trk-<n>-<short-slug>`
3. Implement in small commits (Conventional Commits). Tests first where practical.
4. Run `pnpm lint && pnpm typecheck && pnpm test` (and `pnpm test:integration` if you touched
   store/projection code). Fix until green. Never skip or weaken a test to make it pass.
5. `git push -u origin HEAD`
6. Open a **draft** PR:
   `gh pr create --draft --title "<type>(<scope>): <summary>" --body-file .agent-out/pr.md`
   using `.github/pull_request_template.md`, including `Fixes TRK-<n>` and a checklist mapping
   every acceptance criterion to the test or file that satisfies it.
7. Stop. Do not mark the PR ready, do not merge.

## Never

- Touch protected zones (AGENTS.md → Protected zones).
- Expand scope. Put unrelated findings under "Out of scope findings" in the PR body.
- Invent requirements that are not in the issue or an ADR.
