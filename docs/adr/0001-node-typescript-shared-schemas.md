# ADR-0001: Node/TypeScript across the system, with shared zod schemas

- Status: Accepted
- Date: 2026-11-20
- Tags: stack, typescript, zod, monorepo, contracts

## Context

The browser SDK, server SDK, collector, event store and projectors must agree on the event format. A contract duplicated across two languages drifts over time.

## Decision

Use Node 24 + strict TypeScript in every package, in a pnpm + Turborepo monorepo. Event schemas live in `packages/event-schemas` (zod) and are the only source of the contract.

## Alternatives considered

- PHP/Laravel: familiar, but forces the contract to be duplicated between the SDK (TS) and the backend.

## Consequences

One `parseEvent` used by the collector, tests and projectors. Contract changes always go through the schemas package.
