# Event-sourcing standards (`ES-nn`)

Rules for the event log, event contracts, ordering and projections. How to read them:
[README](README.md). Policy: [ADR-0013](../adr/0013-code-standards-foundation.md).

The code under `packages/` and `apps/` is still stubs, so the examples are **illustrative**. Names
such as `appendEvent` show the intended shape, not an existing API.

## Summary

| ID                                                                  | Level    | Rule                                                             | Enforced by                                                                       |
| ------------------------------------------------------------------- | -------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [ES-01](#es-01-never-update-or-delete-events)                       | MUST NOT | Update or delete rows in `events`                                | Review only (planned: integration test that the app DB role has no UPDATE/DELETE) |
| [ES-02](#es-02-read-and-replay-in-position-order)                   | MUST     | Read and replay in `position` order                              | Review only (planned: store integration test)                                     |
| [ES-03](#es-03-take-the-advisory-lock-on-every-append)              | MUST     | Take `pg_advisory_xact_lock` in the INSERT transaction           | Review only (planned: concurrent-append integration test, ADR-0003)               |
| [ES-04](#es-04-use-a-client-uuidv7-event_id-as-the-idempotency-key) | MUST     | `event_id` is a client UUIDv7 and the idempotency key            | Review only (planned: store integration test for duplicate `event_id`)            |
| [ES-05](#es-05-give-every-event-type-a-versioned-zod-schema)        | MUST     | Every event type has a zod schema with a literal `version`       | Review only (planned: registry test)                                              |
| [ES-06](#es-06-ship-fixtures-and-a-contract-test-per-version)       | MUST     | Valid and invalid fixtures plus a contract test per version      | Review only (planned: test that every registry entry has fixtures)                |
| [ES-07](#es-07-never-change-a-published-schema-version)             | MUST NOT | Change a published schema version                                | Review only (planned: test of fixtures per version)                               |
| [ES-08](#es-08-name-events-as-past-tense-facts)                     | SHOULD   | Name events as past-tense facts; model no commands or aggregates | Review only                                                                       |
| [ES-09](#es-09-keep-personal-data-out-of-payloads)                  | MUST NOT | Carry personal data beyond ADR-0009                              | Review only                                                                       |
| [ES-10](#es-10-conversions-carry-origin-and-dedup-by-conversion_id) | MUST     | Conversions carry `source`, `app_id`, `trust`, `conversion_id`   | Review only (planned: schema contract test)                                       |
| [ES-11](#es-11-order-a-session-by-client-seq)                       | MUST     | Order a session by client `seq`                                  | Review only (planned: projection unit test with shuffled batches)                 |
| [ES-12](#es-12-keep-projection-handlers-pure)                       | MUST     | Handlers are pure `(state, event) => state`                      | Review only (planned: `Biome: style/noRestrictedImports` on `handlers.ts`)        |
| [ES-13](#es-13-make-projection-writes-idempotent)                   | MUST     | Applying the same event twice gives the same result              | Review only (planned: projection integration test)                                |
| [ES-14](#es-14-the-runner-owns-the-checkpoint)                      | MUST     | Own checkpoint per projection; handlers never touch it           | Review only                                                                       |
| [ES-15](#es-15-prove-replay-equals-incremental)                     | MUST     | Replay test per projection                                       | Review only (planned: CI check that each projection has a `*.int.test.ts`)        |
| [ES-16](#es-16-change-projection-logic-by-blue-green-version-bump)  | MUST     | Bump `k` and rebuild into `<name>_v<k+1>`                        | Review only                                                                       |
| [ES-17](#es-17-depend-on-the-eventbus-port-only)                    | MUST     | Projectors depend on the `EventBus` port only                    | Review only (planned: `Biome: style/noRestrictedImports`, not configured)         |
| [ES-18](#es-18-keep-projection-documents-bounded)                   | SHOULD   | Keep projection documents bounded                                | Review only                                                                       |

---

## Event log

### ES-01: Never update or delete events

**MUST NOT** `UPDATE` or `DELETE` rows in `events`. Fix mistakes with a new event or an upcaster.

**Why.** The log is the source of truth and every projection is rebuilt from it. An edited row
silently changes history and breaks replay determinism.

**Example.** (illustrative)

```ts
// ✅ a correction is a new fact
await appendEvent(db, { type: "ConversionCorrected", version: 1 /* ... */ });
```

```ts
// ❌ rewriting history
await db.query("UPDATE events SET payload = $1 WHERE event_id = $2", [fixed, id]);
```

**Enforced by.** Review only (planned: integration test that the application DB role has no
`UPDATE`/`DELETE` grant on `events`).

**Source.** [ADR-0014](../adr/0014-unpartitioned-event-store-global-event-id.md), AGENTS.md invariant 1.
[Microsoft, Event Sourcing pattern: "Versioning events"](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing#problems-and-considerations).

### ES-02: Read and replay in `position` order

**MUST** read and replay the log ordered by `position`. **MUST NOT** order by `occurred_at` or
`received_at`.

**Why.** `position` is the only gap-free global order. Client timestamps skew and server timestamps
can tie, so ordering by them makes replays differ between runs.

**Example.** (illustrative)

```sql
-- ✅
SELECT * FROM events WHERE position > $1 ORDER BY position LIMIT $2;
```

```sql
-- ❌
SELECT * FROM events WHERE occurred_at > $1 ORDER BY occurred_at;
```

**Enforced by.** Review only (planned: integration test that reads return ascending `position`).

**Source.** [ADR-0014](../adr/0014-unpartitioned-event-store-global-event-id.md),
[ADR-0003](../adr/0003-serialized-appends.md), [ADR-0007](../adr/0007-session-seq-ordering.md).

### ES-03: Take the advisory lock on every append

**MUST** take `pg_advisory_xact_lock(<constant>)` in the same transaction as the `INSERT`.

**Why.** With `bigserial`, transactions can commit out of position order. A reader at
`position > checkpoint` would then skip the lower position that committed later.

**Example.** (illustrative)

```ts
// ✅
await db.transaction(async (tx) => {
  await tx.query("SELECT pg_advisory_xact_lock($1)", [APPEND_LOCK_KEY]);
  await tx.query("INSERT INTO events (...) VALUES (...)");
});
```

```ts
// ❌ no lock: positions can become visible out of order
await db.query("INSERT INTO events (...) VALUES (...)");
```

**Enforced by.** Review only (planned: the concurrent-append integration test that ADR-0003
requires).

**Source.** [ADR-0003](../adr/0003-serialized-appends.md).
[PostgreSQL, Advisory Lock Functions](https://www.postgresql.org/docs/current/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS).

### ES-04: Use a client UUIDv7 `event_id` as the idempotency key

**MUST** generate `event_id` on the client as a UUIDv7. A second append with the same `event_id`
**MUST NOT** create a second event.

**Why.** Beacons and retries deliver the same event more than once. A client-generated key lets the
unique constraint absorb duplicates, and UUIDv7 keeps ids time-sortable.

**Example.** (illustrative)

```ts
// ✅
await tx.query(
  "INSERT INTO events (event_id, ...) VALUES ($1, ...) ON CONFLICT (event_id) DO NOTHING",
  [event.event_id],
);
```

```ts
// ❌ server invents the id, so retries become new events
const eventId = randomUUID();
```

**Enforced by.** Review only (planned: integration test `append › same event_id retried with occurred_at in different months › stores exactly one event`, ADR-0014).

**Source.** AGENTS.md invariant 3, [ADR-0014](../adr/0014-unpartitioned-event-store-global-event-id.md) (supersedes ADR-0002).
[RFC 9562 §5.7, UUID Version 7](https://www.rfc-editor.org/rfc/rfc9562#section-5.7).

## Event contracts

### ES-05: Give every event type a versioned zod schema

**MUST** define each event type as a zod schema in `packages/event-schemas` with an explicit
literal `version`. No schema, no event.

**Why.** One contract shared by SDKs, collector and projectors prevents drift. An explicit version
is what makes upcasting possible.

**Example.** (illustrative)

```ts
// ✅
export const PageViewedV1 = z.object({
  type: z.literal("PageViewed"),
  version: z.literal(1) /* ... */,
});
```

```ts
// ❌ no version, or a type declared outside event-schemas
export const PageViewed = z.object({ type: z.literal("PageViewed") });
```

**Enforced by.** Review only (planned: a registry test that fails on a schema without a literal
`version`).

**Source.** [ADR-0001](../adr/0001-node-typescript-shared-schemas.md), AGENTS.md invariant 2,
`new-event-type` skill.

### ES-06: Ship fixtures and a contract test per version

**MUST** give every event version valid and invalid fixtures and a contract test: every valid
fixture parses, every invalid fixture fails at the expected path.

**Why.** The fixtures are the executable definition of the contract and the input for upcaster and
projection tests.

**Example.**

```text
// ✅
fixtures/PageViewed.v1/valid-minimal.json
fixtures/PageViewed.v1/invalid-missing-attribution-key.json
```

```text
// ❌ a schema with no fixtures directory
```

**Enforced by.** Review only (planned: test that every registry entry has fixtures).

**Source.** AGENTS.md invariant 2, `new-event-type` skill.

### ES-07: Never change a published schema version

**MUST NOT** change a published schema version. A change adds `vN+1` and a pure upcaster. Readers
consume the latest version and upcast on read.

**Why.** Stored events keep their original shape forever. Upcasting keeps projections simple
without rewriting history.

**Example.** (illustrative)

```ts
// ✅ add V2 and keep V1 untouched
export const upcastPageViewedV1ToV2 = (e: PageViewedV1): PageViewedV2 => ({
  ...e,
  version: 2 /* ... */,
});
```

```ts
// ❌ edit PageViewedV1 in place, or rewrite stored rows
```

**Enforced by.** Review only (planned: CI check that the v1 fixtures still parse against v1).

**Source.** [ADR-0014](../adr/0014-unpartitioned-event-store-global-event-id.md) (consequences), `new-event-type` skill.

### ES-08: Name events as past-tense facts

Event types **SHOULD** be named as past-tense facts (`PageViewed`, `ConversionRecorded`). Commands
and aggregates **MUST NOT** be modelled.

**Why.** The system only receives facts and validates no commands, so aggregates add complexity
without a business rule to justify them.

**Example.**

```ts
// ✅
type EventType = "PageViewed" | "ConversionRecorded";
```

```ts
// ❌ a command, or an aggregate
type EventType = "TrackPageView" | "JourneyAggregate";
```

**Enforced by.** Review only.

**Source.** [ADR-0005](../adr/0005-no-aggregate-snapshots.md).
[Fowler, Event Sourcing](https://martinfowler.com/eaaDev/EventSourcing.html),
[Microsoft, Event Sourcing pattern: "Event design"](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing#problems-and-considerations).

### ES-09: Keep personal data out of payloads

Payloads **MUST NOT** carry personal data beyond what ADR-0009 allows. IPs **MUST** be truncated
before storage.

**Why.** The log is immutable, so personal data written once cannot be removed later.

**Example.** (illustrative)

```ts
// ✅
{ ip: truncateIp(req.ip), user_id: opaqueId }
```

```ts
// ❌
{ ip: req.ip, email: "a@b.com" }
```

**Enforced by.** Review only.

**Source.** [ADR-0009](../adr/0009-first-party-cookie-consent.md), AGENTS.md invariant 7.
[Microsoft, Event Sourcing pattern: "Personal data and regulatory compliance"](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing#problems-and-considerations).

### ES-10: Conversions carry origin and dedup by `conversion_id`

`ConversionRecorded` **MUST** carry `source` (`client` | `server`), `app_id`, `trust`
(`unverified` | `signed`) and `conversion_id`. Projections **MUST** count one `conversion_id` once,
and the server one wins.

**Why.** Client events can be forged and the same conversion can arrive from both sides.

**Example.** (illustrative)

```ts
// ✅
{ type: "ConversionRecorded", source: "server", app_id, trust: "signed", conversion_id }
```

```ts
// ❌ no origin or id: cannot be deduplicated or filtered by trust
{ type: "ConversionRecorded", value: 10 }
```

**Enforced by.** Review only (planned: schema contract test with invalid fixtures for each missing
field).

**Source.** [ADR-0008](../adr/0008-conversion-source-dedup.md), AGENTS.md invariant 6.

## Ordering

### ES-11: Order a session by client `seq`

In-session order **MUST** come from the client `seq`. Order-dependent values such as `dwell_ms`
**MUST** be derived in projections and **MUST NOT** be sent by the client.

**Why.** Beacons arrive in batches and out of order, and client clocks are unreliable. Across
sessions the global `position` applies.

**Example.** (illustrative)

```ts
// ✅
events.sort((a, b) => a.seq - b.seq);
```

```ts
// ❌
events.sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
```

**Enforced by.** Review only (planned: projection unit test with a shuffled batch).

**Source.** [ADR-0007](../adr/0007-session-seq-ordering.md), AGENTS.md invariant 4.

## Projections

### ES-12: Keep projection handlers pure

Handlers **MUST** be pure functions `(state, event) => state` with no I/O.

**Why.** Pure handlers are trivially testable and make rebuilds deterministic.

**Example.** (illustrative)

```ts
// ✅
export const onPageViewed = (s: Timeline, e: PageViewed): Timeline => ({
  ...s,
  views: s.views + 1,
});
```

```ts
// ❌ I/O and clock inside a handler
export const onPageViewed = async (s: Timeline, e: PageViewed) => {
  await mongo.save(s);
  Date.now();
};
```

**Enforced by.** Review only (planned: `Biome: style/noRestrictedImports` forbidding I/O modules in
`handlers.ts`; the rule exists in Biome 2.6.8 but is not configured).

**Source.** [ADR-0004](../adr/0004-mongo-projections.md), `new-projection` skill.

### ES-13: Make projection writes idempotent

Projection writes **MUST** be idempotent: applying the same event twice gives the same result.

**Why.** Delivery can be at least once, and rebuilds replay events already seen.

**Example.** (illustrative)

```ts
// ✅ upsert by document id
await col.replaceOne({ _id: doc._id }, doc, { upsert: true });
```

```ts
// ❌ increments again on redelivery
await col.updateOne({ _id }, { $inc: { views: 1 } });
```

**Enforced by.** Review only (planned: projection integration test applying each fixture twice).

**Source.** [ADR-0004](../adr/0004-mongo-projections.md),
[Microsoft, Event Sourcing pattern: "Idempotency requirements"](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing#problems-and-considerations).

### ES-14: The runner owns the checkpoint

Each projection **MUST** keep its own checkpoint `{projection, version, position}` in
`checkpoints`. Handlers **MUST NOT** read or write it.

**Why.** A per-projection checkpoint lets each one rebuild and resume independently. One writer
avoids a handler moving the position ahead of its data.

**Example.** (illustrative)

```ts
// ✅ the runner saves after a batch
await checkpoints.save({ projection: "timeline", version: 2, position });
```

```ts
// ❌ a handler writes the checkpoint
export const onPageViewed = (s, e) => {
  checkpoints.save(/* ... */);
  return s;
};
```

**Enforced by.** Review only.

**Source.** [ADR-0004](../adr/0004-mongo-projections.md), AGENTS.md invariant 5.

### ES-15: Prove replay equals incremental

Each projection **MUST** have a replay test: feeding fixtures incrementally and rebuilding from
position 0 give deep-equal results.

**Why.** It is the only proof that a projection can be rebuilt, which is a core invariant.

**Example.** (illustrative)

```ts
// ✅ timeline.int.test.ts
expect(await dump("timeline_v1")).toEqual(await dump("timeline_v1_rebuild"));
```

```text
// ❌ a projection with no *.int.test.ts replay test
```

**Enforced by.** Review only (planned: CI check that each projection directory has a replay test).

**Source.** [ADR-0004](../adr/0004-mongo-projections.md), AGENTS.md invariant 5,
`new-projection` skill.

### ES-16: Change projection logic by blue/green version bump

A change to projection logic **MUST** bump the version `k` and rebuild into `<name>_v<k+1>` from
position 0. A live projection's semantics **MUST NOT** change in place.

**Why.** Readers keep a consistent collection until the new one has caught up.

**Example.**

```text
// ✅ timeline_v1 keeps serving; timeline_v2 rebuilds; reads switch at the head
```

```text
// ❌ change the handler and keep writing into timeline_v1
```

**Enforced by.** Review only.

**Source.** [ADR-0004](../adr/0004-mongo-projections.md), `new-projection` skill.

### ES-17: Depend on the EventBus port only

Projectors **MUST** depend only on the `EventBus` port from `packages/event-bus`, never on a
transport implementation.

**Why.** It lets Kafka/Redpanda replace Postgres polling without changing projectors.

**Example.** (illustrative)

```ts
// ✅
import type { EventBus } from "@tracking/event-bus";
```

```ts
// ❌
import { PostgresPollingBus } from "@tracking/event-bus/postgres";
```

**Enforced by.** Review only (planned: `Biome: style/noRestrictedImports`; the rule exists in
Biome 2.6.8 but is not configured).

**Source.** [ADR-0006](../adr/0006-eventbus-port.md).

### ES-18: Keep projection documents bounded

Projection documents **SHOULD** stay bounded: use a summary document plus references (bucket
pattern) when something can grow without limit. Snapshots **MUST** be built only when an issue
asks for them.

**Why.** MongoDB caps a document at 16 MiB. Aggregate snapshots have no use here, and projection
snapshots are an optional feature.

**Example.** (illustrative)

```ts
// ✅ one bucket document per session and day, plus a summary
{ _id: "s1:2026-11-22", events: [/* bounded */] }
```

```ts
// ❌ a journey document that appends forever
{ _id: "visitor1", events: [/* unbounded */] }
```

**Enforced by.** Review only.

**Source.** [ADR-0005](../adr/0005-no-aggregate-snapshots.md), `new-projection` skill.
[MongoDB, Limits: BSON Document Size](https://www.mongodb.com/docs/manual/reference/limits/#mongodb-limit-BSON-Document-Size).

---

## Deviations from sources

- **No aggregates, no command-side concurrency control.** Fowler and Microsoft describe
  per-entity streams, command handlers and optimistic concurrency. This system only receives
  facts (ADR-0005), and appends are serialized by a global lock instead (ADR-0003).
- **No aggregate snapshots.** Microsoft recommends snapshots for long streams. We have no
  streams to rehydrate; a full rebuild is the default (ADR-0005).
- **Upcast on read, never rewrite.** Microsoft lists in-place migration as a last resort. We do
  not allow it (ES-01, ES-07).
