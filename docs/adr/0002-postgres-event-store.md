# ADR-0002: PostgreSQL is the event store

- Status: Superseded by ADR-0014
- Date: 2026-11-20
- Tags: event-store, postgres, event-sourcing, replay

## Context

The event log needs a reliable global order for deterministic replay, idempotency on `event_id`, and transactions. Target volume: 50k events/day (~18M/year).

## Decision

An append-only `events` table, partitioned by month on `occurred_at`, with `position bigserial` (global order), `event_id uuid unique` and `payload jsonb`. No UPDATE or DELETE.

## Alternatives considered

- MongoDB: no native monotonic global sequence.
- Kafka: transport with finite retention, no per-stream queries, no concurrency control.
- EventStoreDB: a good fit, but one more technology without proportional learning value.

## Consequences

Replays read by `position`. Fixes are new events or upcasters, never edits.
