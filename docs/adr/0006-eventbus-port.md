# ADR-0006: EventBus port: Postgres polling now, Kafka/Redpanda later

- Status: Accepted
- Date: 2026-11-20
- Tags: event-bus, kafka, transport, ports

## Context

Kafka is a learning goal, but bringing it into M1 multiplies operational complexity before it adds value.

## Decision

Define the `EventBus` interface in `packages/event-bus`. The first implementation polls Postgres by `position`. The Redpanda/Kafka implementation comes in M5, without changing projectors.

## Alternatives considered

- Kafka from M1: complexity too early.
- Managed Kafka on GCP: an always-on cluster, expensive for a learning project. In production, prefer Pub/Sub.

## Consequences

Projectors depend only on the port. Port contract tests run against both implementations.
