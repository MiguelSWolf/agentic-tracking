# ADR-0007: In-session order comes from the client `seq`

- Status: Accepted
- Date: 2026-11-20
- Tags: ordering, sessions, sdk

## Context

`sendBeacon` sends in batches and out of order, and client clocks are unreliable.

## Decision

The SDK generates a monotonic `seq` per `session_id`. The session timeline orders by `seq`. `occurred_at` is informational and `received_at` is set by the server. Across sessions, the global `position` applies.

## Alternatives considered

- Order by `occurred_at`: breaks with clock skew.
- Order by `position`: breaks with out-of-order batches.

## Consequences

`dwell_ms` is derived in the projection from the next `PageViewed`, never sent by the client.
