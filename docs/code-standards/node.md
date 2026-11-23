# Node runtime standards (`NODE-nn`)

Rules for the Node process: errors, async I/O, config, logging, security and lifecycle. TypeScript
language rules (types, `any`, exports) live in `typescript.md`. How to read the rules:
[README](README.md). Policy: [ADR-0013](../adr/0013-code-standards-foundation.md).

The base reference is
[goldbergyoni/nodebestpractices](https://github.com/goldbergyoni/nodebestpractices) ("nbp"). Section
numbers below are its README numbering.

The code under `packages/` and `apps/` is still stubs, so the examples are **illustrative**. Names
such as `loadConfig` and `logger` show the intended shape, not an existing API.

## Summary

| ID | Level | Rule | Enforced by |
| --- | --- | --- | --- |
| [NODE-01](#node-01-throw-only-error-objects) | MUST | Throw only `Error` objects; app errors extend `Error` | Review only |
| [NODE-02](#node-02-pass-the-caught-error-as-cause) | MUST | Pass a caught error as `cause` when wrapping it | Review only (planned: `Biome: style/useErrorCause`) |
| [NODE-03](#node-03-keep-operational-errors-apart-from-programmer-errors) | MUST | Mark operational errors apart from programmer errors | Review only |
| [NODE-04](#node-04-handle-errors-in-one-central-handler) | MUST | Handle errors in one central handler per process | Review only |
| [NODE-05](#node-05-exit-on-uncaught-exceptions-and-unhandled-rejections) | MUST | On `uncaughtException`, `unhandledRejection` or a programmer error: log, shut down, exit non-zero | Review only |
| [NODE-06](#node-06-never-leave-a-promise-floating) | MUST NOT | Leave a promise floating | Review only (planned: `Biome: nursery/noFloatingPromises`) |
| [NODE-07](#node-07-await-before-returning-inside-try) | SHOULD | `return await` inside `try` blocks | Review only |
| [NODE-08](#node-08-handle-error-events-on-emitters-and-streams) | MUST | Handle `'error'` on emitters and streams; use `pipeline` | Review only |
| [NODE-09](#node-09-put-a-timeout-on-every-outbound-call) | MUST | Give every outbound I/O call a timeout or `AbortSignal` | Review only |
| [NODE-10](#node-10-read-the-environment-in-one-config-module) | MUST | Read `process.env` only in one config module, parsed with zod at startup | Review only (planned: `Biome: style/noProcessEnv`) |
| [NODE-11](#node-11-keep-secrets-out-of-the-repo-and-logs) | MUST NOT | Put secrets in the repo or in logs | Review only |
| [NODE-12](#node-12-log-structured-json-to-stdout-through-one-logger) | MUST | Log structured JSON to stdout through one logger | Review only (planned: `Biome: suspicious/noConsole`) |
| [NODE-13](#node-13-keep-personal-data-out-of-logs) | MUST NOT | Log personal data | Review only |
| [NODE-14](#node-14-attach-a-correlation-id-to-every-log-line) | SHOULD | Attach a correlation id to every log line | Review only |
| [NODE-15](#node-15-validate-external-input-at-the-boundary) | MUST | Validate all external input with the shared zod schemas before use | Review only |
| [NODE-16](#node-16-use-parameterised-sql-only) | MUST | Use parameterised SQL only | Review only (planned: integration test with a hostile input) |
| [NODE-17](#node-17-shut-down-gracefully-on-sigterm-and-sigint) | MUST | Shut down gracefully on `SIGTERM` and `SIGINT` | Review only (planned: process-level integration test) |
| [NODE-18](#node-18-import-built-ins-with-the-node-protocol) | MUST | Import Node built-ins with the `node:` protocol | Biome: style/useNodejsImportProtocol |
| [NODE-19](#node-19-compare-signatures-in-constant-time) | MUST | Compare HMAC signatures with `crypto.timingSafeEqual` | Review only |

---

## Errors

### NODE-01: Throw only Error objects

**MUST** throw only `Error` instances. Application errors **MUST** extend `Error`, so they carry a
stack and a `name`.

**Why.** Strings and plain objects have no stack trace, so the origin of a failure is lost.

**Example.** (illustrative)

```ts
// ✅
export class InvalidEventError extends Error {
  override name = "InvalidEventError";
}
throw new InvalidEventError("seq must be a positive integer");
```

```ts
// ❌ no stack, no type
throw "invalid event";
```

**Enforced by.** Review only.

**Source.** [nbp 2.2, Extend the built-in Error object](https://github.com/goldbergyoni/nodebestpractices#-22-extend-the-built-in-error-object).

### NODE-02: Pass the caught error as cause

**MUST** pass the original error as `cause` when a catch block throws a new error.

**Why.** Without `cause`, the stack of the real failure is lost.

**Example.** (illustrative)

```ts
// ✅
try {
  await store.append(event);
} catch (err) {
  throw new AppendFailedError("append failed", { cause: err });
}
```

```ts
// ❌ the original error is dropped
catch (err) {
  throw new AppendFailedError("append failed");
}
```

**Enforced by.** Review only (planned: `Biome: style/useErrorCause`; it exists in Biome 2.6.8 but is
not in `recommended`).

**Source.** [nbp 2.2](https://github.com/goldbergyoni/nodebestpractices#-22-extend-the-built-in-error-object),
TRK-16 decision,
[MDN, Error: `cause`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause).

### NODE-03: Keep operational errors apart from programmer errors

**MUST** mark errors as operational (expected at runtime: bad input, a timeout, a down database) or
as programmer errors (bugs). Mark them with a class or an `isOperational` flag.

**Why.** Operational errors are handled and the process goes on. A programmer error means the
process state is unknown, so the process must restart (NODE-05).

**Example.** (illustrative)

```ts
// ✅
export class AppError extends Error {
  constructor(message: string, readonly isOperational: boolean, options?: ErrorOptions) {
    super(message, options);
  }
}
throw new AppError("bus unavailable", true, { cause: err });
```

```ts
// ❌ every failure looks the same, so the handler cannot choose
throw new Error("something failed");
```

**Enforced by.** Review only.

**Source.** [nbp 2.3, Distinguish catastrophic errors from operational errors](https://github.com/goldbergyoni/nodebestpractices#-23-distinguish-catastrophic-errors-from-operational-errors).

### NODE-04: Handle errors in one central handler

**MUST** handle errors in one central handler per process (log, classify, respond or exit). Code
elsewhere **MUST NOT** log-and-swallow errors.

**Why.** Scattered handling gives inconsistent logs and lost errors.

**Example.** (illustrative)

```ts
// ✅ the HTTP entry point and the projector loop both call it
export const handleError = (err: unknown): void => {
  logger.error({ err }, "unhandled error");
  if (!isOperational(err)) process.exitCode = 1; // see NODE-05
};
```

```ts
// ❌ swallowed in the middle of the call stack
try {
  await bus.publish(e);
} catch {}
```

**Enforced by.** Review only.

**Source.** [nbp 2.4, Handle errors centrally, not within a middleware](https://github.com/goldbergyoni/nodebestpractices#-24-handle-errors-centrally-not-within-a-middleware)
(adapted, see Deviations).

### NODE-05: Exit on uncaught exceptions and unhandled rejections

**MUST** register `uncaughtException` and `unhandledRejection` handlers that log the error, run the
graceful shutdown (NODE-17) and exit non-zero. A programmer error **MUST** end the process the same
way.

**Why.** After a bug the process state is unreliable. Cloud Run and Docker restart a crashed
process.

**Example.** (illustrative)

```ts
// ✅
process.on("unhandledRejection", (reason) => {
  throw reason; // becomes uncaughtException
});
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "uncaught exception");
  void shutdown(1);
});
```

```ts
// ❌ keep running after an uncaught exception
process.on("uncaughtException", (err) => logger.error({ err }));
```

**Enforced by.** Review only.

**Source.** [nbp 2.6, Exit the process gracefully when a stranger comes to town](https://github.com/goldbergyoni/nodebestpractices#-26-exit-the-process-gracefully-when-a-stranger-comes-to-town),
[nbp 2.10, Catch unhandled promise rejections](https://github.com/goldbergyoni/nodebestpractices#-210-catch-unhandled-promise-rejections),
[ADR-0010](../adr/0010-gcp-target-local-m0.md).

## Async

### NODE-06: Never leave a promise floating

**MUST NOT** leave a promise floating. Every promise is `await`ed, returned, or explicitly
discarded with `void` and a `.catch`.

**Why.** A rejection nobody handles ends in `unhandledRejection` far from its cause, and ordering
bugs appear.

**Example.** (illustrative)

```ts
// ✅
await bus.publish(event);
void flush().catch((err) => handleError(err));
```

```ts
// ❌
bus.publish(event);
```

**Enforced by.** Review only (planned: `Biome: nursery/noFloatingPromises`; it exists in Biome 2.6.8
but is not active, because it is outside `recommended` and needs the `types` domain).

**Source.** [nbp 2.1, Use Async-Await or promises for async error handling](https://github.com/goldbergyoni/nodebestpractices#-21-use-async-await-or-promises-for-async-error-handling),
[nbp 2.10](https://github.com/goldbergyoni/nodebestpractices#-210-catch-unhandled-promise-rejections).

### NODE-07: Await before returning inside try

**SHOULD** use `return await` when returning a promise inside `try`/`catch`.

**Why.** A bare `return promise` skips the catch block and gives a partial stack trace.

**Example.**

```ts
// ✅
try {
  return await store.read(position);
} catch (err) {
  throw new ReadFailedError("read failed", { cause: err });
}
```

```ts
// ❌ the catch never sees the rejection
try {
  return store.read(position);
} catch (err) {
  /* never runs */
}
```

**Enforced by.** Review only.

**Source.** [nbp 2.12, Always await promises before returning to avoid a partial stacktrace](https://github.com/goldbergyoni/nodebestpractices#-212-always-await-promises-before-returning-to-avoid-a-partial-stacktrace).

### NODE-08: Handle error events on emitters and streams

**MUST** attach an `'error'` listener to every event emitter and stream. Streams **SHOULD** be
connected with `pipeline` from `node:stream/promises`.

**Why.** An `'error'` event with no listener throws and crashes the process. `pipeline` forwards
errors and destroys all streams.

**Example.** (illustrative)

```ts
// ✅
import { pipeline } from "node:stream/promises";
await pipeline(source, transform, destination);
```

```ts
// ❌ no error handling, no cleanup
source.pipe(destination);
```

**Enforced by.** Review only.

**Source.** [nbp 2.13, Subscribe to event emitters and streams 'error' event](https://github.com/goldbergyoni/nodebestpractices#-213-subscribe-to-event-emitters-and-streams-error-event),
[Node.js, `stream.pipeline`](https://nodejs.org/api/stream.html#streampipelinesource-transforms-destination-options).

### NODE-09: Put a timeout on every outbound call

**MUST** give every outbound I/O call (database, HTTP, bus) a timeout or an `AbortSignal`.

**Why.** Without a limit, a hung dependency holds requests, pool connections and the shutdown
(NODE-17) open forever.

**Example.** (illustrative)

```ts
// ✅
const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
```

```ts
// ❌ can wait forever
const res = await fetch(url);
```

**Enforced by.** Review only.

**Source.** [Node.js, `AbortSignal.timeout()`](https://nodejs.org/api/globals.html#static-method-abortsignaltimeoutdelay).
nbp has no section on this (see Deviations).

## Config and secrets

### NODE-10: Read the environment in one config module

**MUST** read `process.env` only in one config module. It parses the values with zod at startup and
fails fast on an invalid value. The rest of the code receives the typed config object.

**Why.** A missing variable should stop the process at boot, not fail in the middle of a request.
One module makes the full list of settings visible.

**Example.** (illustrative)

```ts
// ✅ config.ts
const Config = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().default(8080),
});
export const loadConfig = () => Config.parse(process.env); // throws at startup
```

```ts
// ❌ scattered, unvalidated
const port = Number(process.env.PORT);
```

**Enforced by.** Review only (planned: `Biome: style/noProcessEnv`, with an override for the config
module; the rule exists in Biome 2.6.8 but is not in `recommended`).

**Source.** [nbp 1.4, Use environment aware, secure and hierarchical config](https://github.com/goldbergyoni/nodebestpractices#-14-use-environment-aware-secure-and-hierarchical-config),
[nbp 2.11, Fail fast, validate arguments using a dedicated library](https://github.com/goldbergyoni/nodebestpractices#-211-fail-fast-validate-arguments-using-a-dedicated-library),
[ADR-0001](../adr/0001-node-typescript-shared-schemas.md).

### NODE-11: Keep secrets out of the repo and logs

**MUST NOT** put secrets (database URLs with passwords, per-app HMAC keys) in the repo or in logs.
They come from the environment or from Secret Manager.

**Why.** Git history and logs outlive any rotation. A leaked HMAC key lets anyone forge `signed`
conversions.

**Example.** (illustrative)

```ts
// ✅ the value comes from the validated config (NODE-10)
const key = config.APP_HMAC_KEY;
logger.info({ appId }, "hmac key loaded");
```

```ts
// ❌
const key = "5f2b-hardcoded";
logger.info({ key }, "hmac key loaded");
```

**Enforced by.** Review only.

**Source.** [nbp 6.3, Extract secrets from config files or use packages to encrypt them](https://github.com/goldbergyoni/nodebestpractices#-63-extract-secrets-from-config-files-or-use-packages-to-encrypt-them),
[ADR-0008](../adr/0008-conversion-source-dedup.md),
[ADR-0010](../adr/0010-gcp-target-local-m0.md).

## Logging

### NODE-12: Log structured JSON to stdout through one logger

**MUST** log through one shared logger that writes structured JSON to stdout. Code **MUST NOT** use
ad-hoc `console.*` calls or choose a log destination itself.

**Why.** The platform collects stdout. Structured fields can be filtered and queried, and free text
cannot.

**Example.** (illustrative)

```ts
// ✅
logger.info({ eventId, position }, "event appended");
```

```ts
// ❌
console.log(`appended ${eventId}`);
```

**Enforced by.** Review only (planned: `Biome: suspicious/noConsole`; it exists in Biome 2.6.8 but is
not in `recommended`).

**Source.** [nbp 2.7, Use a mature logger to increase errors visibility](https://github.com/goldbergyoni/nodebestpractices#-27-use-a-mature-logger-to-increase-errors-visibility),
[nbp 5.2, Increase the observability using smart logging](https://github.com/goldbergyoni/nodebestpractices#-52-increase-the-observability-using-smart-logging),
[nbp 5.18, Log to stdout, avoid specifying log destination within the app](https://github.com/goldbergyoni/nodebestpractices#-518-log-to-stdout-avoid-specifying-log-destination-within-the-app).

### NODE-13: Keep personal data out of logs

**MUST NOT** log personal data: full IP addresses, raw cookies, request bodies, emails. Log ids and
truncated values.

**Why.** Logs are copied to more places than the database and are hard to erase. ADR-0009 sets the
privacy limits.

**Example.** (illustrative)

```ts
// ✅
logger.info({ eventId, ip: truncateIp(req.ip) }, "event received");
```

```ts
// ❌
logger.info({ body: req.body, cookie: req.headers.cookie }, "event received");
```

**Enforced by.** Review only.

**Source.** [ADR-0009](../adr/0009-first-party-cookie-consent.md), AGENTS.md invariant 7,
[ES-09](event-sourcing.md#es-09-keep-personal-data-out-of-payloads).

### NODE-14: Attach a correlation id to every log line

**SHOULD** attach a correlation id to every log line: the request id in the collector and API, the
batch or `position` range in the projector. Use a child logger.

**Why.** It lets you follow one request or batch across log lines.

**Example.** (illustrative)

```ts
// ✅
const log = logger.child({ requestId });
log.info("batch accepted");
```

```ts
// ❌ no way to tell which request this line belongs to
logger.info("batch accepted");
```

**Enforced by.** Review only.

**Source.** [nbp 5.14, Assign a transaction id to each log statement](https://github.com/goldbergyoni/nodebestpractices#-514-assign-a-transaction-id-to-each-log-statement).

## Input and security

### NODE-15: Validate external input at the boundary

**MUST** validate all external input (HTTP bodies, query strings, messages from the bus, rows read
from storage that cross a trust boundary) with the shared zod schemas from `packages/event-schemas`
before use. Invalid input **MUST** be rejected as an operational error.

**Why.** Everything past the boundary can then trust its types. The same schemas serve SDKs,
collector and projectors (ADR-0001).

**Example.** (illustrative)

```ts
// ✅
const parsed = PageViewedV1.safeParse(req.body);
if (!parsed.success) throw new InvalidEventError("invalid event", { cause: parsed.error });
```

```ts
// ❌ trusts the body
const event = req.body as PageViewed;
```

**Enforced by.** Review only.

**Source.** [nbp 6.10, Validate incoming JSON schemas](https://github.com/goldbergyoni/nodebestpractices#-610-validate-incoming-json-schemas),
[nbp 2.11](https://github.com/goldbergyoni/nodebestpractices#-211-fail-fast-validate-arguments-using-a-dedicated-library),
[ADR-0001](../adr/0001-node-typescript-shared-schemas.md).

### NODE-16: Use parameterised SQL only

**MUST** pass values to SQL as bind parameters. Code **MUST NOT** interpolate values into query
text.

**Why.** String-built queries are open to SQL injection. Identifiers that cannot be parameters come
from a fixed allow-list, never from input.

**Example.** (illustrative)

```ts
// ✅
await db.query("SELECT * FROM events WHERE position > $1 ORDER BY position LIMIT $2", [from, limit]);
```

```ts
// ❌
await db.query(`SELECT * FROM events WHERE app_id = '${appId}'`);
```

**Enforced by.** Review only (planned: integration test that sends a hostile value through the
store).

**Source.** [nbp 6.4, Prevent query injection vulnerabilities with ORM/ODM libraries](https://github.com/goldbergyoni/nodebestpractices#-64-prevent-query-injection-vulnerabilities-with-ormodm-libraries)
(adapted, see Deviations),
[ADR-0014](../adr/0014-unpartitioned-event-store-global-event-id.md).

## Lifecycle and modules

### NODE-17: Shut down gracefully on SIGTERM and SIGINT

**MUST** handle `SIGTERM` and `SIGINT`: stop accepting work, drain in-flight work, save the
projection checkpoint, close the database and bus connections, then exit. A shutdown timer
**SHOULD** force the exit if draining hangs.

**Why.** Cloud Run sends `SIGTERM` before it stops a container. Dropped requests and unsaved
checkpoints cost lost events or repeated work.

**Example.** (illustrative)

```ts
// ✅
process.once("SIGTERM", () => void shutdown(0));
const shutdown = async (code: number) => {
  server.close();
  await runner.stop(); // saves the checkpoint
  await pool.end();
  process.exit(code);
};
```

```ts
// ❌ no handler: the process is killed in the middle of a batch
```

**Enforced by.** Review only (planned: process-level integration test that sends `SIGTERM` and
checks the exit code and checkpoint).

**Source.** [nbp 8.6, Shutdown smartly and gracefully](https://github.com/goldbergyoni/nodebestpractices#-86-shutdown-smartly-and-gracefully),
[ADR-0010](../adr/0010-gcp-target-local-m0.md),
[Node.js, Signal events](https://nodejs.org/api/process.html#signal-events).

### NODE-18: Import built-ins with the node: protocol

**MUST** import Node built-in modules with the `node:` prefix.

**Why.** It makes built-ins unmistakable from npm packages and prevents a package named like a
built-in from taking its place.

**Example.**

```ts
// ✅
import { readFile } from "node:fs/promises";
```

```ts
// ❌
import { readFile } from "fs/promises";
```

**Enforced by.** Biome: style/useNodejsImportProtocol (recommended; default severity is `info`, so
it reports but does not fail `biome check`).

**Source.** [nbp 6.27, Import built-in modules using the 'node:' protocol](https://github.com/goldbergyoni/nodebestpractices#-627-import-built-in-modules-using-the-node-protocol).

## Signatures

### NODE-19: Compare signatures in constant time

**MUST** compare HMAC signatures with `crypto.timingSafeEqual` on buffers of equal length. Code
**MUST NOT** use `===` on signatures.

**Why.** A plain comparison leaks, through timing, how many leading bytes matched. Server
conversions depend on the signature to be trusted (ADR-0008).

**Example.** (illustrative)

```ts
// ✅
import { timingSafeEqual } from "node:crypto";
const ok = expected.length === given.length && timingSafeEqual(expected, given);
```

```ts
// ❌
const ok = expectedHex === givenHex;
```

**Enforced by.** Review only.

**Source.** [ADR-0008](../adr/0008-conversion-source-dedup.md),
[Node.js, `crypto.timingSafeEqual`](https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b).

---

## Deviations from sources

- **No Express.** nbp 2.4 centralises error handling in Express middleware. We have no framework
  assumption, so NODE-04 asks for one handler per process entry point.
- **No ESLint.** nbp 6.1 (security linter plugins) is dropped. Biome is the linter (ADR-0013 §7).
  Where Biome has a matching rule outside `recommended`, the rule says so under "Enforced by".
- **No ORM.** nbp 6.4 recommends ORM/ODM libraries. The event store uses plain SQL, so NODE-16
  asks for bind parameters instead.
- **No logger named.** nbp 2.7 recommends a mature logger without picking one. Choosing it is left
  to an implementation issue.
- **Dropped as out of scope.** APM (2.9), PM2 and cluster, and `NODE_ENV` handling (5.15) do not
  apply to Cloud Run containers in M0.
- **Timeouts have no nbp section.** NODE-09 and NODE-19 take their source from the Node.js docs and
  ADR-0008.
- **Overlap with `typescript.md`.** NODE-01 and NODE-02 own the `Error`/`cause` rules.
  `typescript.md` links to them. Errors-as-values typing, `any` and exports stay there.
