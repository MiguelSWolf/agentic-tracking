# ADR-0011: Calibration metrics decide when gates are relaxed

- Status: Accepted
- Date: 2026-11-20
- Tags: agents, gates, metrics, workflow

## Context

Gates G0–G5 are all on in M0. Relaxing them on gut feeling is risky; never relaxing them wastes the agent.

## Decision

Measure per milestone: % of agent PRs merged with no commits after ready-for-review, median `@claude` rounds per PR, review findings accepted vs. rejected, time from draft to merge. If for two consecutive milestones ≥ 80% of `size:S` PRs merge unchanged, G1 (plan) becomes optional for `size:S` issues. G2 and G5 are never relaxed.

## Alternatives considered

- Relax by judgement: no comparable baseline between milestones.

## Consequences

`pnpm agent:metrics` (TRK-9) produces the table that goes into each milestone retro.
