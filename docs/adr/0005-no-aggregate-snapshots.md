# ADR-0005: No aggregate snapshots; projection snapshots are optional

- Status: Accepted
- Date: 2026-11-20
- Tags: event-sourcing, snapshots, projections

## Context

Aggregate snapshots exist to validate commands without re-reading long streams. This system validates no commands: it only receives facts.

## Decision

Do not model aggregates or aggregate snapshots. Snapshotting a projection's state at position X is allowed as a time-travel and partial-replay feature, built only when an issue asks for it.

## Alternatives considered

- A Journey aggregate with snapshots: complexity with no business rule to justify it.

## Consequences

A full rebuild stays the default path (minutes for 18M events).
