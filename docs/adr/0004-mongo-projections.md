# ADR-0004: Projections in MongoDB, with a checkpoint per projection and blue/green rebuilds

- Status: Accepted
- Date: 2026-11-20

## Context

Read models such as session timelines and journeys are documents by nature. Changing a projection's logic must not take reads down.

## Decision

Each projection writes to `<name>_v<k>` and keeps `{projection, version, position}` in the `checkpoints` collection. A logic change means a new version rebuilt in parallel from position 0, switching reads once it reaches the head of the log.

## Alternatives considered

- Projections in Postgres itself: possible, but loses the polyglot-persistence learning.
- Firestore with MongoDB API on GCP: evaluated alternative for production, without full compatibility guarantees.

## Consequences

Pure, idempotent handlers. A replay test (rebuild == incremental) is mandatory for every projection.
