---
name: write-adr
description: Use when a decision needs to be recorded or an existing ADR superseded. Agents draft ADR text in a PR description or issue comment; only the owner commits to docs/adr/ (protected zone).
---

# Write an ADR

`docs/adr/` is a protected zone. As an agent, you **draft** the ADR and put it in the PR body
(section "Proposed ADR") or in an issue comment. The owner commits it.

## Format (English)

File name: `docs/adr/NNNN-<kebab-slug>.md`.

```markdown
# ADR-NNNN: <the decision in one sentence>

- Status: Proposed | Accepted | Superseded by ADR-XXXX
- Date: YYYY-MM-DD

## Context
The problem, the forces and constraints. 3–6 sentences.

## Decision
What was decided, in the imperative. Include what is explicitly out.

## Alternatives considered
- <alternative> — why not.

## Consequences
Positive, negative, and what becomes mandatory (tests, conventions).
```

Rules: one decision per ADR. Never edit an accepted ADR's decision. Supersede it with a new ADR
and update the old one's status.
