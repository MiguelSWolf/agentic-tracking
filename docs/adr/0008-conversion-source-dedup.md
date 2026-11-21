# ADR-0008: Conversions identify their origin and are deduped by `conversion_id`

- Status: Accepted
- Date: 2026-11-20

## Context

Conversions mostly come from the backend but may come from the frontend. A client event can be forged.

## Decision

`ConversionRecorded` requires `source` (`client`|`server`), `app_id`, `trust` (`unverified`|`signed`) and `conversion_id`. Server events are HMAC-signed per app. In the projection, the same `conversion_id` from both sides counts once, and the server wins.

## Alternatives considered

- Accept server conversions only: loses legitimate frontend cases.

## Consequences

Reports can filter by `trust`. The per-app HMAC key lives in a secret, never in the repo.
