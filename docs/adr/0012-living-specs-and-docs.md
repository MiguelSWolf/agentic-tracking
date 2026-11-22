# ADR-0012: Specs and docs live in the repo and change in the same PR as the behaviour

- Status: Accepted
- Date: 2026-11-21
- Tags: docs, specs, workflow, agents, source-of-truth

## Context

Work is planned in Linear and executed by agents through PRs. Without a rule, the current behaviour of the system exists only in code and in a trail of issue comments. Agents and humans then have to reconstruct it each time, and documentation drifts from the code.

The owner wants git to be the single source of truth. Linear keeps the history of how a decision was reached; the repo should hold the current state.

## Decision

1. **All documentation lives under `docs/`**, organised by purpose and guided by Diátaxis (tutorials, how-to, reference, explanation). `docs/README.md` is the index and says what lives where.
2. **Specs are per capability, not per issue.** `docs/specs/<capability>.md` (e.g. `event-envelope.md`, `collector-api.md`, `attribution.md`) describes what the system does today. There are no per-issue spec files.
3. **Behaviour and docs change together.** A PR that changes behaviour, configuration, operation or a decision updates the matching spec, doc or ADR **in the same PR**. A PR that does not need doc changes says so explicitly ("Docs: none, because …").
4. **The plan names its docs.** In the plan phase (G1) the agent lists the specs, docs and ADRs it will create or change. The owner approves that together with the plan.
5. **Decisions vs rules.** An ADR records a decision and its reasoning. `AGENTS.md` and the skills carry the short operational rule and link to the ADR. Content is linked, never copied.
6. **History stays in Linear and PRs.** Squash merges use the PR title and description as the commit message, so the why, the decisions and the plan feedback also land in `git log`.

## Alternatives considered

- **A spec file per issue** — becomes boilerplate and goes stale the moment the next issue changes the same behaviour.
- **Docs in Linear or a wiki** — not versioned with the code, not reviewable in the PR, and invisible to agents that only read the repo.
- **Rules only in ADRs** — ADRs are long and historical. Agents need short, current instructions, so the rule lives in `AGENTS.md` and the skills.

## Consequences

- `issue-flow` requires a "Docs to update" section in every plan, and the PR template has a "Docs & specs" section.
- Reviewers (owner, CodeRabbit, Codex) treat a behaviour change without a matching spec or doc update as a defect.
- Specs for existing code are written when that code is next changed, not as a big upfront effort.
- The milestone audit (code-health-audit) checks for drift between specs and code.
