# ADR-0003: Serialized appends so global position is never visible out of order

- Status: Accepted
- Date: 2026-11-20
- Tags: event-store, postgres, concurrency, ordering

## Context

With `bigserial`, two concurrent transactions can commit in a different order than their positions. A projector reading `position > checkpoint` would skip the lower position that committed later.

## Decision

Every append takes `pg_advisory_xact_lock(<constant>)` in the same transaction as the INSERT. At 50k events/day, serialized throughput is more than enough.

## Alternatives considered

- Reading only up to `pg_snapshot_xmin`: correct, but harder to understand and test.
- In-process single writer: fragile with several collector instances.

## Consequences

Mandatory integration test: concurrent appends yield positions with no gaps visible to the reader.
