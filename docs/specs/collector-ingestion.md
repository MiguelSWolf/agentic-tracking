# Collector ingestion

## Purpose

The collector turns an incoming batch of events into appended events: it validates each event, removes
personal data, sets the fields only the server may set, and appends through the event-store port. This spec
covers the transport-agnostic handler. The HTTP endpoint is TRK-49 and the Postgres adapter is TRK-48.

## Behaviour

### Event-store port

`EventStore.append(event)` in `packages/event-store/src/port.ts` returns `{ status: "appended", position }`
or `{ status: "duplicate" }`. `event_id` is the idempotency key (invariant 3, ES-04): the first write wins. A
duplicate is a result, not an error (ADR-0014). `position` is an ordering key only, not a count. The promise
rejects only for operational failures.

`@tracking/event-store/testing` exports an in-memory fake (`createInMemoryEventStore`) and a shared contract
suite (`runEventStoreContract(create)`). The Postgres adapter (TRK-48) must run the same suite. The suite
checks: a new `event_id` is appended with a greater position, and a repeated `event_id` returns `duplicate`.
It does not check concurrency (TEST-17, TRK-48) or what is stored beyond the duplicate result.

### Batch handler

`ingestBatch({ body, clientIp }, { store, clock, propertyPolicy?, urlPolicy? })` in
`apps/collector/src/ingest/ingest-batch.ts`.

**Batch shape.** `body` must be `{ events: [...] }` with 1 to 100 events (`MAX_BATCH_SIZE`). Anything else
returns `{ ok: false, reason: "invalid_batch" }` and appends nothing. This is the only whole-batch rejection.

**Per event, in order.** One invalid event never fails the batch; results keep the input order.

1. Server-owned fields are set before parsing: `received_at` from the injected clock, and `context.ip_trunc`
   from the truncated client IP. Any client value for these two fields is discarded. If the client IP is
   missing or invalid, `ip_trunc` is removed.
2. `parseEvent` validates the event against the registered schema (ADR-0001). A failure gives
   `{ status: "rejected", reason: "invalid_event", issues }`, where `issues` holds the zod path and code only.
   Messages are left out because they can echo input values (ES-09, NODE-13).
3. `applyUrlPolicy` runs on every event type.
4. For `CustomEventTracked`, `applyEventNamePolicy` and then `applyPropertyPolicy` run. Other types pass
   unchanged. The `switch` on `type` is exhaustive, so a new event type fails to compile until it is handled.
5. `store.append`. The result is `accepted` or `duplicate`.

The handler also returns `redactions`: the policy counts summed over the batch (fixed reasons, integers only),
for the caller to log (NODE-13).

**Store failures.** If `append` rejects, the handler rethrows and stops. Earlier events of the batch stay
stored. The caller answers 5xx and the client retries the batch; events already stored come back as
`duplicate`.

### IP truncation

`truncateIp(ip)` in `apps/collector/src/privacy/truncate-ip.ts` (ADR-0009). IPv4 keeps the first 24 bits
(`203.0.113.77` → `203.0.113.0`). IPv6 keeps the first 48 bits (`2001:db8:abcd:12::5` → `2001:db8:abcd::`).
IPv4-mapped IPv6 (`::ffff:203.0.113.77`) is treated as IPv4. Anything else, including IPv6 with a zone id,
returns `undefined`. The widths are recorded here and not in an ADR. The handler receives `clientIp` from the
transport; picking it from a trusted proxy header is TRK-49.

### Consent

The handler does not check consent. The SDK sends events only after consent (ADR-0009) and the collector
trusts that gate. A client that skips the gate can still send events; the collector cannot detect it.

### Trust

The handler does not reject `trust: "signed"`. The schema only forbids `signed` on `source: "client"`, so a
`source: "server"` event claiming `signed` is stored without HMAC verification (ADR-0008). Tracked in TRK-47.

## Not covered

HTTP transport, body size limit, rate limiting, client IP extraction (TRK-49). Postgres adapter, migration,
advisory lock and concurrent-append test (TRK-48). HMAC verification (TRK-47). Atomic batches: events are
appended one at a time.

## Related ADRs and schemas

- ADR-0001, ADR-0004, ADR-0008, ADR-0009, ADR-0012, ADR-0014.
- ES-04, ES-09, NODE-03, NODE-13, NODE-15, TS-15, TEST-20.
- Code: `apps/collector/src/ingest/`, `apps/collector/src/privacy/truncate-ip.ts`, `packages/event-store/src/`.
- See also [collector-property-policy.md](collector-property-policy.md) and [event-envelope.md](event-envelope.md).
