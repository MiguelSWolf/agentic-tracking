# ADR-0014: The event store is one unpartitioned `events` table with a global unique `event_id`

- Status: Accepted
- Date: 2026-11-23
- Tags: event-store, postgres, event-sourcing, replay, idempotency
- Supersedes: ADR-0002

## Context

The event log needs a reliable global order for deterministic replay, idempotency on `event_id`, and transactions. Target volume: 50k events/day (~18M/year).

ADR-0002 asked for a table partitioned by month on `occurred_at` and for `event_id uuid unique`. PostgreSQL 16 cannot do both. From
[§5.11.2.3 Limitations](https://www.postgresql.org/docs/16/ddl-partitioning.html#DDL-PARTITIONING-DECLARATIVE-LIMITATIONS):

> To create a unique or primary key constraint on a partitioned table, the partition keys must not include any expressions or function calls and the constraint's columns must include all of the partition key columns. This limitation exists because the individual indexes making up the constraint can only directly enforce uniqueness within their own partitions.

So `UNIQUE (event_id)` is not allowed with the partition key `occurred_at`. `UNIQUE (event_id, occurred_at)` would accept the same `event_id` again when a retry carries a different `occurred_at`, which breaks the idempotency key (ES-04, invariant 3). The same rule also stops `position` from being a global primary key on a partitioned table.

## Decision

The event store is one **unpartitioned**, append-only `events` table:

- `position bigserial PRIMARY KEY` (global order),
- `event_id uuid NOT NULL UNIQUE` (idempotency key),
- `occurred_at timestamptz NOT NULL`,
- `payload jsonb NOT NULL`.

Append is `INSERT … ON CONFLICT (event_id) DO NOTHING` under the advisory lock of ADR-0003. The first write wins and is never overwritten. No UPDATE or DELETE. Replays read by `position`.

**Positions are monotonic, not contiguous.** `position` comes from a `bigserial`, and PostgreSQL draws the next sequence value *before* `ON CONFLICT DO NOTHING` detects the duplicate. Sequence values are never returned. So every duplicate append, and every rolled-back append, leaves a permanent unused `position`. ADR-0003's "no gaps visible to the reader" means a reader never sees a lower `position` appear after a higher one (visibility order). It does not mean `position` values are consecutive. Consumers MUST treat `position` as an ordering key only: checkpoint with `position > checkpoint`, and never detect loss by counting or by `position = previous + 1`. The advisory lock stays, because it is what guarantees visibility order. Avoiding gaps would need a counter row or a pre-check `SELECT` before the INSERT. Both cost throughput or complexity and are not needed here.

No unique key that includes `occurred_at` is allowed as a substitute for `event_id` uniqueness.

**Revisit trigger:** `events` above ~100M rows, or a retention/archival requirement. Then partitioning by a key derived from the UUIDv7 timestamp (option C below) is the preferred route, with a guard table (option B) as fallback. Either needs a new ADR and a data migration.

## Alternatives considered

Carried over from ADR-0002:

- MongoDB: no native monotonic global sequence.
- Kafka: transport with finite retention, no per-stream queries, no concurrency control.
- EventStoreDB: a good fit, but one more technology without proportional learning value.

New:

- **B. Partitioned `events` plus an `event_ids (event_id uuid PRIMARY KEY)` guard table**, written first in the same transaction under the advisory lock. Global uniqueness holds, but every append is two INSERTs, `ON CONFLICT` moves to the guard table, and the guard table grows forever unpartitioned. More moving parts for no benefit at this volume.
- **C. Range-partition on `event_id`** with bounds at UUIDv7 month prefixes. `UNIQUE (event_id)` is allowed because the key is the bare column. Costs: `position` can no longer be a global primary key, replays scan all partitions, and the partition depends on the client clock inside the UUID (skewed or forged ids need a DEFAULT partition).
- **D. `UNIQUE (event_id, occurred_at)`.** Rejected: it allows duplicates with a changed timestamp.

## Consequences

One table, one constraint and one lock. ES-01 to ES-04 and ADR-0003 hold unchanged. We lose cheap archival by `DETACH PARTITION`; nobody needs it yet.

A Postgres integration test is **mandatory** and ships with the first event-store migration (M1):

- File: `packages/event-store/src/append.int.test.ts` (TEST-03).
- Name (TEST-01): `append › same event_id retried with occurred_at in different months › stores exactly one event`.
- Arrange: real Postgres (TEST-10), schema built by the production migrations (TEST-11), a fresh UUIDv7 `event_id` and unique `attribution_key` from an injected generator (TEST-12, TEST-20). Three envelopes identical except `occurred_at`: `2026-01-31T23:59:59.999Z`, `2026-02-01T00:00:00.000Z`, and a later month.
- Act: append all three through the public `append` API. Then run a concurrent variant on two connections (TEST-17): hold the first transaction open, append the duplicate on the second, commit the first.
- Assert (TEST-14): exactly one row for that `event_id`; its `occurred_at` is the first one appended; later appends return a "duplicate" result (a union, TS-16) and do not throw; the reader sees one stored event. Then append a fresh event (new `event_id`) after the duplicates: it is stored and read back, its `position` is greater than the first event's, and the test does **not** assert that it is `first + 1`. The reader, reading by `position`, still receives both events in order. Clean-up follows the suite strategy (TEST-13, never DELETE from `events`).
