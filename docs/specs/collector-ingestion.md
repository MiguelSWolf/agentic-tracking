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

## HTTP endpoint

`createCollectorServer` (`apps/collector/src/http/server.ts`) puts a `node:http` server in front of `ingestBatch`.
It does not listen by itself: `main.ts` and the Postgres wiring come with TRK-50.

- Route: `POST /t/events` (ADR-0009). Other methods on it get `405` with `Allow: POST`. Any other path gets `404`.
- Content types: `application/json` and `text/plain` (any charset), because `navigator.sendBeacon` sends
  `text/plain`. Anything else gets `415`.
- Body: `{ "events": [...] }`, at most `COLLECTOR_MAX_BODY_BYTES` (default 262144). The limit is checked on
  `Content-Length` and again on the streamed bytes, so chunked bodies are covered.
- Batch length: more than `MAX_BATCH_SIZE` (100) events gets `413`. Other batch faults (not an object, no
  `events`, empty array) get `400`.

| Status | `error` | Cause |
| ------ | ------- | ----- |
| 200 | none | Batch processed. Body is `{ results }`: per event `accepted`, `duplicate` or `rejected` (path and code only). |
| 400 | `invalid_json`, `invalid_batch` | Body is not JSON, or not a valid batch. |
| 404 / 405 / 415 | `not_found`, `method_not_allowed`, `unsupported_media_type` | Routing or content type. |
| 413 | `payload_too_large` | Over the body byte limit or the batch limit. |
| 503 | `store_unavailable` | `store.append` threw. `Retry-After: 1`. Retrying is safe: `event_id` is the idempotency key (ES-04). |
| 500 | `internal_error` | Any other unexpected error. |

Error bodies are `{ "error": <fixed code>, "requestId" }`. They never echo input (ES-09, NODE-13).

Client IP: `resolveClientIp` reads `X-Forwarded-For` and takes the entry `COLLECTOR_TRUSTED_PROXY_HOPS` from the
right (default 1), which is the one our own proxy appended. With `0` hops, or a missing or too short header, it
uses the socket address. IPv4-mapped IPv6 is unwrapped. The IP goes only to `ingestBatch`, which truncates it.
If no proxy is in front and hops is 1, a client can spoof the IP by sending the header; bind to loopback or
keep a proxy in front.

Correlation id (NODE-14): an incoming `x-request-id` matching `^[A-Za-z0-9-]{8,64}$` is reused, otherwise a UUID
is generated. It is echoed in the `x-request-id` response header and bound to every log line of the request.

Logging (NODE-12, NODE-13): JSON lines on stdout. A request logs `requestId`, `method`, `route` (a fixed
string), `status`, `durationMs`, and for batches `bodyBytes` and the accepted, duplicate and rejected counts.
It never logs the IP, headers, body, or user agent. Errors are logged with `name`, `code`, `message` and `stack`
only; pg `detail` is dropped. This is checked by the "no log line contains" test on one email, IP and cookie. It
does not cover personal data placed in an error `message` by a different store adapter.

Config (NODE-10): `loadConfig` in `apps/collector/src/config.ts`. Keys: `DATABASE_URL` (required),
`COLLECTOR_HOST` (`127.0.0.1`), `COLLECTOR_PORT` (`3001`), `COLLECTOR_MAX_BODY_BYTES` (`262144`),
`COLLECTOR_TRUSTED_PROXY_HOPS` (`1`), `COLLECTOR_SHUTDOWN_TIMEOUT_MS` (`10000`, used by TRK-50), `LOG_LEVEL`
(`info`). A validation error names the keys, never the values.

## Not covered

`main.ts`, Postgres wiring and graceful shutdown (TRK-50). The `attribution_key` cookie, CORS and rate limiting. Postgres adapter, migration,
advisory lock and concurrent-append test (TRK-48). HMAC verification (TRK-47). Atomic batches: events are
appended one at a time.

## Related ADRs and schemas

- ADR-0001, ADR-0004, ADR-0008, ADR-0009, ADR-0012, ADR-0014.
- ES-04, ES-09, NODE-03, NODE-04, NODE-10, NODE-12, NODE-13, NODE-14, NODE-15, TS-15, TEST-20.
- Code: `apps/collector/src/ingest/`, `apps/collector/src/http/`, `apps/collector/src/config.ts`, `apps/collector/src/privacy/truncate-ip.ts`, `packages/event-store/src/`.
- See also [collector-property-policy.md](collector-property-policy.md) and [event-envelope.md](event-envelope.md).
