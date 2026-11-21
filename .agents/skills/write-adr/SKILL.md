---
name: write-adr
description: Use when a decision needs to be recorded, or an existing ADR superseded or deprecated. Also use to look up which ADRs apply to a change. Produces ADRs in one standard format and keeps docs/adr/README.md (the index) in sync.
---

# Write an ADR

ADRs record **decisions and their reasoning**. The short operational rule that follows from a decision goes in `AGENTS.md` or a skill, with a link to the ADR (ADR-0012). Never copy the content.

## 1. Look up existing ADRs first

Read `docs/adr/README.md`, the generated index with ID, decision, status, date and tags. Search it:

```
grep -i "<keyword>" docs/adr/README.md
```

- If an `Accepted` ADR already covers the decision, do not write a new one. Cite it.
- If the new decision **contradicts** an accepted ADR, you are superseding it (step 4).

## 2. Is it ADR-worthy?

Write an ADR when the decision:
- is hard or costly to reverse (storage, protocols, public contracts, event schemas, cloud);
- changes how agents or humans work (gates, workflow, standards);
- picks one option among real alternatives that a future reader would question.

Do not write one for routine implementation choices. Those go in the PR's **Decisions** table.

## 3. Create it

- Number: `node scripts/adr-index.mjs --next`
- File: `docs/adr/<NNNN>-<kebab-slug>.md`. The slug is 3–6 words summarising the decision.

```markdown
# ADR-NNNN: <the decision in one sentence, phrased as a statement>

- Status: Proposed | Accepted
- Date: YYYY-MM-DD
- Tags: <3–6 lowercase keywords, comma-separated, reuse existing tags from the index>
- Supersedes: ADR-XXXX            <- only when replacing one

## Context
The problem, forces and constraints. 3–6 sentences. Facts, not the solution.

## Decision
What was decided, in the imperative. Numbered points when there are several. Include what is explicitly out.

## Alternatives considered
- **<alternative>** — why not.

## Consequences
What becomes true or mandatory (rules, tests, conventions), plus trade-offs and follow-ups.
```

Rules:
- **One decision per ADR.** If you need "and also", write two.
- English, short sentences, no filler.
- Link the ADRs, specs and standards this one relates to.

## 4. Supersede or deprecate

Never edit the Decision of an accepted ADR. Instead:
1. Write the new ADR with `- Supersedes: ADR-XXXX`.
2. In the old ADR, change only the status line to `- Status: Superseded by ADR-NNNN`.
3. Update the operational rule in `AGENTS.md` or the skills to point to the new ADR.

## 5. Regenerate the index

```
pnpm adr:index
```

CI runs `node scripts/adr-index.mjs --check` and fails if the index is stale.

## Where ADRs can be written

`docs/adr/` is a protected zone (G5):
- **CI agents** (`agent-implement`, Codex audit) **draft** the ADR in the PR body under "Proposed ADR". The owner commits it.
- **Interactive sessions with the owner present** may write the file directly. The owner reviews it in the PR.
