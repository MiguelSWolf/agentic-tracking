# Testing standards (`TEST-nn`)

Rules for how to write tests: structure, doubles, data, integration tests with Postgres and
Mongo, and the shape of the contract, replay, ordering and bus tests. Tests run on Vitest. Unit
tests are `*.test.ts` next to the code. Tests that need Postgres or Mongo are `*.int.test.ts`.
How to read the rules: [README](README.md). Policy:
[ADR-0013](../adr/0013-code-standards-foundation.md).

**What is required vs how to write it.** [ES-06](event-sourcing.md#es-06-ship-fixtures-and-a-contract-test-per-version)
and [ES-15](event-sourcing.md#es-15-prove-replay-equals-incremental) already require contract and
replay tests. TEST-15 and TEST-16 only say how to write them. `as` in tests is covered by
[TS-14](typescript.md#ts-14-avoid-as-type-assertions).

Base references (section numbers are their README numbering):

- "JS": [goldbergyoni/javascript-testing-best-practices](https://github.com/goldbergyoni/javascript-testing-best-practices).
- "Node": [testjavascript/nodejs-integration-tests-best-practices](https://github.com/testjavascript/nodejs-integration-tests-best-practices),
  the Node.js integration-tests guide named in ADR-0013 §5.

The code under `packages/` and `apps/` is still stubs, so the examples are **illustrative**. Names
such as `appendEvent` and `makeClickedEvent` show the intended shape, not an existing API.

**Biome severity.** Biome reports the recommended rule `suspicious/noFocusedTests` at `warn`. It is
on because `vitest` is a dependency. The package `lint` scripts do not pass `--error-on-warnings`,
so it flags code but does not fail CI (TRK-21 tracks making warnings blocking). It is listed as
"Biome: …" below. `suspicious/noSkippedTests` exists in Biome 2.6.8 but is not in `recommended`.

## Summary

| ID | Level | Rule | Enforced by |
| --- | --- | --- | --- |
| [TEST-01](#test-01-name-tests-in-three-parts) | SHOULD | Name each test in three parts: unit, scenario, expected result | Review only |
| [TEST-02](#test-02-structure-tests-as-arrange-act-assert) | SHOULD | Structure tests as Arrange / Act / Assert | Review only |
| [TEST-03](#test-03-keep-unit-and-integration-tests-in-separate-files) | MUST | Unit tests in `*.test.ts`, DB-backed tests in `*.int.test.ts`, next to the code | Review only (the Vitest include/exclude split runs the two kinds separately) |
| [TEST-04](#test-04-test-public-behaviour-not-internals) | MUST | Test public behaviour, not internals; cover features, not functions | Review only |
| [TEST-05](#test-05-prefer-fakes-stubs-and-spies-to-mocks) | SHOULD | Prefer fakes, stubs and spies to mocks; double only at boundaries | Review only |
| [TEST-06](#test-06-use-realistic-data) | SHOULD | Use realistic data, preferably the event-schemas fixtures | Review only |
| [TEST-07](#test-07-expect-errors-do-not-catch-them) | MUST | Assert errors with `toThrow` / `rejects`, never `try/catch` | Review only |
| [TEST-08](#test-08-avoid-snapshots) | SHOULD NOT | Use snapshots, except short inline ones | Review only |
| [TEST-09](#test-09-never-weaken-a-test-to-make-ci-pass) | MUST NOT | Commit `.only` or unexplained `.skip`; weaken a test to make CI pass | Biome: `suspicious/noFocusedTests` (`.only` only); rest Review only (planned: `Biome: suspicious/noSkippedTests`) |
| [TEST-10](#test-10-use-the-real-databases-in-integration-tests) | MUST | Integration tests use real Postgres and Mongo, never an in-memory fake of the DB | Review only |
| [TEST-11](#test-11-build-the-test-schema-with-the-production-migrations) | MUST | Build the test schema with the production migrations | Review only |
| [TEST-12](#test-12-let-each-test-own-its-records) | MUST | Each test creates and acts on its own records; seed only metadata | Review only |
| [TEST-13](#test-13-pick-one-clean-up-strategy-per-suite) | SHOULD | One explicit clean-up strategy per suite; never delete from `events` in shared data | Review only |
| [TEST-14](#test-14-assert-every-outcome) | SHOULD | Assert every outcome: response, new state, outgoing messages, logs | Review only |
| [TEST-15](#test-15-write-contract-tests-from-the-fixture-folders) | MUST | Contract tests are table-driven over the fixture folders (how to meet ES-06) | Review only (planned: registry ↔ fixtures test, same as ES-06) |
| [TEST-16](#test-16-write-replay-tests-with-one-fixture-stream) | MUST | Replay tests compare incremental and rebuild-from-0 on one fixture stream (how to meet ES-15) | Review only (planned: same CI check as ES-15) |
| [TEST-17](#test-17-test-that-concurrent-appends-leave-no-position-gap) | MUST | Concurrent appends never expose a position gap to a reader | Review only (planned: `event-store` integration test) |
| [TEST-18](#test-18-run-one-contract-suite-against-every-eventbus) | MUST | One shared `EventBus` contract suite runs against every implementation | Review only (planned: shared suite in `packages/event-bus`) |
| [TEST-19](#test-19-never-sleep-or-poll-in-tests) | MUST NOT | Sleep or poll for async results; await, and use fake timers for time | Review only |
| [TEST-20](#test-20-inject-the-clock-and-the-id-generator) | MUST | Inject the clock and the ID generator; tests pass fixed ones | Review only |

---

## Test structure

### TEST-01: Name tests in three parts

**SHOULD** name each test with the unit under test, the scenario and the expected result.

**Why.** A failing name then tells the reader what broke without opening the file.

**Example.** (illustrative)

```ts
// ✅
describe("appendEvent", () => {
  it("when event_id already exists, returns the stored position without a new row", () => {});
});
```

```ts
// ❌
it("works", () => {});
```

**Enforced by.** Review only.

**Source.** [JS 1.1, Include 3 parts in each test name](https://github.com/goldbergyoni/javascript-testing-best-practices#-%EF%B8%8F-11-include-3-parts-in-each-test-name).

### TEST-02: Structure tests as Arrange Act Assert

**SHOULD** separate the three phases of a test with blank lines, in the order Arrange, Act, Assert.

**Why.** The reader finds the setup, the action and the check at a glance.

**Example.** (illustrative)

```ts
// ✅
it("PageViewed v1, with a negative seq, fails validation", () => {
  const input = { ...validPageViewed, seq: -1 };

  const result = PageViewedV1.safeParse(input);

  expect(result.success).toBe(false);
});
```

```ts
// ❌ setup and assertion are mixed
it("fails", () => {
  expect(PageViewedV1.safeParse({ ...validPageViewed, seq: -1 }).success).toBe(false);
});
```

**Enforced by.** Review only.

**Source.** [JS 1.2, Structure tests by the AAA pattern](https://github.com/goldbergyoni/javascript-testing-best-practices#-%EF%B8%8F-12-structure-tests-by-the-aaa-pattern).

### TEST-03: Keep unit and integration tests in separate files

**MUST** put unit tests in `*.test.ts` and tests that need Postgres or Mongo in `*.int.test.ts`,
next to the code they test.

**Why.** `pnpm test` runs without any infrastructure. `pnpm test:integration` runs the rest.

**Example.**

```ts
// ✅
// packages/event-store/src/append.test.ts       (no I/O)
// packages/event-store/src/append.int.test.ts   (Postgres)
```

```ts
// ❌ a DB-backed test in a *.test.ts file breaks `pnpm test` on a machine without Postgres
// packages/event-store/src/append.test.ts
```

**Enforced by.** Review only. Each package's `vitest.config.ts` includes `src/**/*.test.ts` and excludes
`src/**/*.int.test.ts`; `vitest.int.config.ts` includes only `src/**/*.int.test.ts`. A DB test in
the wrong file fails `pnpm test` without infrastructure, but that is a side effect, not a check.

**Source.** [AGENTS.md, Conventions](../../AGENTS.md),
[JS 1.12, Categorize tests under at least 2 levels](https://github.com/goldbergyoni/javascript-testing-best-practices#-%EF%B8%8F-112-categorize-tests-under-at-least-2-levels).

### TEST-04: Test public behaviour, not internals

**MUST** test through the public API of the unit (a package export, an HTTP route, a bus message).
Tests **MUST NOT** reach into private state or call private helpers. Cover a feature end to end
rather than each function alone.

**Why.** Tests of internals break on every refactor and prove nothing about behaviour.

**Example.** (illustrative)

```ts
// ✅
const view = await runProjection(sessionProjection, events);
expect(view.sessions[0]?.pageViews).toBe(2);
```

```ts
// ❌
expect(sessionProjection._cache.size).toBe(1);
```

**Enforced by.** Review only.

**Source.** [JS 1.4, Stick to black-box testing](https://github.com/goldbergyoni/javascript-testing-best-practices#-%EF%B8%8F-14-stick-to-black-box-testing-test-only-public-methods),
[Node 1.3, Cover features, not functions](https://github.com/testjavascript/nodejs-integration-tests-best-practices#-13-cover-features-not-functions).

### TEST-05: Prefer fakes, stubs and spies to mocks

**SHOULD** prefer a fake, a stub or a spy to a mock that asserts on call sequences. Tests **SHOULD**
double only boundaries (clock, network, bus). A partial double that needs `as` follows
[TS-14](typescript.md#ts-14-avoid-as-type-assertions): **SHOULD NOT**, and give the reason when you do.

**Why.** Mocks that verify calls couple the test to the implementation.

**Example.** (illustrative)

```ts
// ✅ in-memory fake that implements the port
const bus = new InMemoryEventBus();
await handle(bus, event);
expect(bus.published).toEqual([expected]);
```

```ts
// ❌ asserts how the code talks to its collaborator
expect(mockBus.publish).toHaveBeenNthCalledWith(1, expected);
```

**Enforced by.** Review only.

**Source.** [JS 1.5, Choose the right test doubles](https://github.com/goldbergyoni/javascript-testing-best-practices#-%EF%B8%8F-15-choose-the-right-test-doubles-avoid-mocks-in-favor-of-stubs-and-spies),
[Node 8.1, Spot the Good Mocks from the Evil Ones](https://github.com/testjavascript/nodejs-integration-tests-best-practices#-81-spot-the-good-mocks-from-the-evil-ones).

### TEST-06: Use realistic data

**SHOULD** build test input from the `packages/event-schemas` valid fixtures
([ES-06](event-sourcing.md#es-06-ship-fixtures-and-a-contract-test-per-version)), or from a builder
that produces realistic values. Tests **SHOULD NOT** use placeholders such as `"foo"`.

**Why.** Realistic data finds the bugs that real traffic finds (URLs, UTMs, UUIDv7 ids).

**Example.** (illustrative)

```ts
// ✅
const event = makeClickedEvent({ url: "https://shop.example/pricing?utm_source=newsletter" });
```

```ts
// ❌
const event = { type: "foo", url: "bar" };
```

**Enforced by.** Review only.

**Source.** [JS 1.6, Don't "foo", use realistic input data](https://github.com/goldbergyoni/javascript-testing-best-practices#-%EF%B8%8F-16-dont-foo-use-realistic-input-data).

### TEST-07: Expect errors, do not catch them

**MUST** assert a failure with `expect(...).toThrow(...)` or `await expect(...).rejects...`. A test
**MUST NOT** use `try/catch` for this.

**Why.** With `try/catch`, a test passes silently when nothing is thrown.

**Example.** (illustrative)

```ts
// ✅
await expect(store.append(invalidEvent)).rejects.toThrow(InvalidEventError);
```

```ts
// ❌ passes when append() does not throw
try {
  await store.append(invalidEvent);
} catch (err) {
  expect(err).toBeInstanceOf(InvalidEventError);
}
```

**Enforced by.** Review only.

**Source.** [JS 1.10, Don't catch errors, expect them](https://github.com/goldbergyoni/javascript-testing-best-practices#-%EF%B8%8F-110-dont-catch-errors-expect-them).

### TEST-08: Avoid snapshots

**SHOULD NOT** use snapshots. A short inline snapshot is allowed.

**Why.** Large snapshots get approved without being read, so they stop protecting anything.

**Example.** (illustrative)

```ts
// ✅
expect(truncateIp("203.0.113.77")).toMatchInlineSnapshot(`"203.0.113.0"`);
```

```ts
// ❌ a large external snapshot of a whole projection document
expect(doc).toMatchSnapshot();
```

**Enforced by.** Review only.

**Source.** [JS 1.8, If needed, use only short & inline snapshots](https://github.com/goldbergyoni/javascript-testing-best-practices#-%EF%B8%8F-18-if-needed-use-only-short--inline-snapshots).

### TEST-09: Never weaken a test to make CI pass

**MUST NOT** commit focused tests (`.only`). A skipped test (`.skip`, `xit`, `.todo` standing in for
a real test) **MUST** carry a comment with a link to an issue. Agents and humans **MUST NOT** weaken
a test to make CI pass: deleting an assertion, loosening an `expect`, widening a fixture or lowering
a threshold. Changing an existing assertion **MUST** be called out in the PR under "Decisions", with
the reason.

**Why.** A green run that was reached by weakening the test hides the bug it was written to catch.
The test is the specification. If the specification is wrong, say so in the PR.

**Example.** (illustrative)

```ts
// ✅ the expectation changed because the spec changed, and the PR says so
expect(result.position).toBe(2n); // Decisions: positions now start at 1 (ADR-0003 update)
```

```ts
// ❌ loosened until it passes
expect(result.position).toBeGreaterThan(0n); // was: toBe(2n)
it.skip("replay equals incremental", () => {});
```

**Enforced by.** Biome: `suspicious/noFocusedTests` (`.only` only, warn severity, see the note
above). Skipped and weakened tests are Review only (planned: `Biome: suspicious/noSkippedTests`;
it exists in Biome 2.6.8 but is not in `recommended`).

**Source.** [JS 4.4, Preventing test code issues with Test linters](https://github.com/goldbergyoni/javascript-testing-best-practices#-%EF%B8%8F-44-preventing-test-code-issues-with-test-linters),
TRK-20 owner decision.

---

## Integration tests with real infrastructure

### TEST-10: Use the real databases in integration tests

**MUST** run integration tests against real Postgres and MongoDB, started from
`infra/docker-compose.yml` locally and from CI services. Tests **MUST NOT** use an in-memory
stand-in for either database.

**Why.** SQL locking, `jsonb`, unique constraints and Mongo upserts behave differently in fakes. The
append lock (ADR-0003) and idempotent writes (ADR-0004) cannot be tested on a fake.

**Example.** (illustrative)

```ts
// ✅
const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
```

```ts
// ❌
const db = newDb(); // in-memory Postgres emulator
```

**Enforced by.** Review only.

**Source.** [Node 2.1, Use Docker-Compose to host the database](https://github.com/testjavascript/nodejs-integration-tests-best-practices#-21-use-docker-compose-to-host-the-database-and-other-infrastructure),
[Node 2.4, Optimize your real DB for testing, Don't fake it](https://github.com/testjavascript/nodejs-integration-tests-best-practices#-24-optimize-your-real-db-for-testing-dont-fake-it),
[ADR-0014](../adr/0014-unpartitioned-event-store-global-event-id.md), [ADR-0004](../adr/0004-mongo-projections.md).

### TEST-11: Build the test schema with the production migrations

**MUST** create the test schema by running the same migrations that production runs. Tests
**MUST NOT** keep a second copy of the DDL.

**Why.** A hand-written test schema drifts, and then tests pass against a schema that does not exist.

**Example.** (illustrative)

```ts
// ✅ in the global setup
await runMigrations(testDatabaseUrl);
```

```ts
// ❌
await pool.query("CREATE TABLE events (...)");
```

**Enforced by.** Review only.

**Source.** [Node 2.6, Build the DB schema using migrations](https://github.com/testjavascript/nodejs-integration-tests-best-practices#-26-build-the-db-schema-using-migrations-ensure-it-happens-only-once-in-dev),
[Node 6.7, Install the DB schema using the same technique like production](https://github.com/testjavascript/nodejs-integration-tests-best-practices#-67-install-the-db-schema-using-the-same-technique-like-production).

### TEST-12: Let each test own its records

**MUST** have each test create the records it acts on, with a fresh UUIDv7 `event_id` and a unique
`attribution_key`, and assert only on those. Seeding **MUST** be limited to metadata and context
data. A test **MUST NOT** depend on rows left by another test.

**Why.** Shared data makes tests order-dependent, and they cannot run in parallel.

**Example.** (illustrative)

```ts
// ✅
const attributionKey = `attr-${newId()}`;
await store.append(makeEvent({ eventId: newId(), attributionKey }));
const rows = await store.readByAttributionKey(attributionKey);
expect(rows).toHaveLength(1);
```

```ts
// ❌ counts every row in the table
expect(await store.countAll()).toBe(1);
```

**Enforced by.** Review only.

**Source.** [Node 6.1, Each test should act on its own records only](https://github.com/testjavascript/nodejs-integration-tests-best-practices#-61-important-each-test-should-act-on-its-own-records-only),
[Node 6.2, Only metadata and context data should get pre-seeded](https://github.com/testjavascript/nodejs-integration-tests-best-practices#-62-only-metadata-and-context-data-should-get-pre-seeded-to-the-database),
[Node 6.5, Add some randomness to unique fields](https://github.com/testjavascript/nodejs-integration-tests-best-practices#-65-add-some-randomness-to-unique-fields),
[JS 2.7, Avoid global test fixtures and seeds](https://github.com/goldbergyoni/javascript-testing-best-practices#-%EF%B8%8F-27-avoid-global-test-fixtures-and-seeds-add-data-per-test).

### TEST-13: Pick one clean-up strategy per suite

**SHOULD** state one clean-up strategy per suite (after-all is preferred) in the suite's setup
file. Clean-up **MUST NOT** `DELETE` or `UPDATE` rows in `events` in a shared database
([ES-01](event-sourcing.md#es-01-never-update-or-delete-events)). Use a throwaway database or
schema per run and drop it whole.

**Why.** Per-row deletes in `events` break the append-only invariant, even in tests, and mixed
strategies leave data behind.

**Example.** (illustrative)

```ts
// ✅
afterAll(async () => {
  await dropDatabase(runDatabaseName);
});
```

```ts
// ❌
afterEach(() => pool.query("DELETE FROM events"));
```

**Enforced by.** Review only.

**Source.** [Node 6.4, Choose a clear data clean-up strategy](https://github.com/testjavascript/nodejs-integration-tests-best-practices#-64-important-choose-a-clear-data-clean-up-strategy-after-all-recommended-or-after-each),
[JS 2.8, Choose a clear data clean-up strategy](https://github.com/goldbergyoni/javascript-testing-best-practices#-%EF%B8%8F-28-choose-a-clear-data-clean-up-strategy-after-all-recommended-or-after-each),
[ES-01](event-sourcing.md#es-01-never-update-or-delete-events).

### TEST-14: Assert every outcome

**SHOULD** assert every outcome of the behaviour under test: the response, the new state (read
through the public API), the outgoing messages and the logs or metrics that matter.

**Why.** A test that checks only the response misses the missing event or the missing log line.

**Example.** (illustrative)

```ts
// ✅ collector accepts a batch
expect(res.status).toBe(202);
expect(await store.readByAttributionKey(key)).toHaveLength(2);
expect(bus.published).toHaveLength(2);
```

```ts
// ❌
expect(res.status).toBe(202);
```

**Enforced by.** Review only.

**Source.** [Node 1.5, Test the five known backend exit doors](https://github.com/testjavascript/nodejs-integration-tests-best-practices#-15-test-the-five-known-backend-exit-doors-outcomes),
[Node 4.6, Test the five potential outcomes](https://github.com/testjavascript/nodejs-integration-tests-best-practices#-46-test-the-five-potential-outcomes),
[JS 2.12, Test the five potential outcomes](https://github.com/goldbergyoni/javascript-testing-best-practices#-%EF%B8%8F-212-test-the-five-potential-outcomes).

---

## Event-sourcing tests

These rules say how to write the tests that other rules require.

### TEST-15: Write contract tests from the fixture folders

**MUST** write the contract test of an event version as a table over its fixture folder
(`fixtures/<Type>.v<N>/`): every `valid-*.json` parses, every `invalid-*.json` fails, and the invalid
case asserts the failing path (`issues[0].path`), not only `success === false`. An invalid fixture
holds `{ "expected_path": [...], "input": {...} }` and breaks exactly one thing, so the first issue
is deterministic. This is how to satisfy
[ES-06](event-sourcing.md#es-06-ship-fixtures-and-a-contract-test-per-version).

**Why.** A table over the folder makes a new fixture a test without code. Asserting the path proves the
schema rejects the input for the right reason.

**Example.** (illustrative)

```ts
// ✅
it.each(invalidFixtures("PageViewed", 1))("rejects $name at $expectedPath", ({ input, expectedPath }) => {
  const result = PageViewedV1.safeParse(input);

  expect(result.success).toBe(false);
  expect(result.error?.issues[0]?.path).toEqual(expectedPath);
});
```

```ts
// ❌ passes for any failure, including a typo in the fixture
expect(PageViewedV1.safeParse(input).success).toBe(false);
```

**Enforced by.** Review only (planned: the registry ↔ fixtures test planned for ES-06).

**Source.** [JS 2.3, Ensure new releases don't break the API using contract tests](https://github.com/goldbergyoni/javascript-testing-best-practices#-%EF%B8%8F-23-ensure-new-releases-dont-break-the-api-using-contract-tests),
[ADR-0001](../adr/0001-node-typescript-shared-schemas.md),
[ES-06](event-sourcing.md#es-06-ship-fixtures-and-a-contract-test-per-version).

### TEST-16: Write replay tests with one fixture stream

**MUST** write a projection's replay test with one fixture stream: apply it incrementally in one
run, rebuild from position 0 in another, dump both through one deterministic function (sorted keys,
no timestamps of the run) and compare with deep equality. The stream **MUST** also be delivered
with a duplicated event and with shuffled batches, and the result **MUST** be the same
([ES-13](event-sourcing.md#es-13-make-projection-writes-idempotent),
[ES-11](event-sourcing.md#es-11-order-a-session-by-client-seq)). This is how to satisfy
[ES-15](event-sourcing.md#es-15-prove-replay-equals-incremental).

**Why.** Equality over a deterministic dump is the cheapest proof that the projection is rebuildable
(ADR-0004). Duplicates and shuffles are the two inputs a real bus produces.

**Example.** (illustrative)

```ts
// ✅
const incremental = await dump(await applyIncrementally(projection, stream));
const rebuilt = await dump(await rebuildFromZero(projection, stream));
const duplicated = await dump(await rebuildFromZero(projection, withDuplicate(stream)));
const shuffled = await dump(await rebuildFromZero(projection, shuffleBatches(stream, seed)));

expect(rebuilt).toEqual(incremental);
expect(duplicated).toEqual(incremental);
expect(shuffled).toEqual(incremental); // ordering by seq, not delivery order (ES-11)
```

```ts
// ❌ only counts documents, so wrong content passes
expect(await col.countDocuments()).toBe(expectedCount);
```

**Enforced by.** Review only (planned: the CI check planned for ES-15).

**Source.** [ADR-0004](../adr/0004-mongo-projections.md),
[Node 7.4, Test processing of messages batch](https://github.com/testjavascript/nodejs-integration-tests-best-practices#-74-test-processing-of-messages-batch),
[Node 7.6, Test for idempotency](https://github.com/testjavascript/nodejs-integration-tests-best-practices#-76-test-for-idempotency),
[ES-15](event-sourcing.md#es-15-prove-replay-equals-incremental).

### TEST-17: Test that concurrent appends leave no position gap

**MUST** cover the event store with an integration test that holds the first append's transaction
open on one connection, appends on a second connection, and checks that the reader does not see
position 2 (or advance its checkpoint past 1) until the first transaction commits. The test
**MUST** keep a final check that the positions have no gap. Wait for the second append to block on
the lock with an event-driven signal, not a sleep ([TEST-19](#test-19-never-sleep-or-poll-in-tests)).

**Why.** This is the failure the advisory lock prevents
([ES-03](event-sourcing.md#es-03-take-the-advisory-lock-on-every-append)). ADR-0003 lists the test
as a consequence of the design.

**Example.** (illustrative)

```ts
// ✅ observe the reader while the first append is still in progress
const first = await connectionA.begin();
await appendInTransaction(first, makeEvent({ eventId: newId() })); // position 1, not committed

const second = store.appendOn(connectionB, makeEvent({ eventId: newId() })); // not awaited
await waitUntilBlockedOnAdvisoryLock(connectionB); // event-driven, no sleep

expect(await reader.readFrom(0n)).toEqual([]); // position 2 must not be visible early

await first.commit();
await second;

const positions = (await reader.readFrom(0n)).map((e) => e.position);
expect(positions).toEqual([1n, 2n]); // final no-gap check
```

```ts
// ❌ checks only the end state: passes even if position 2 was visible before position 1 committed
await Promise.all(Array.from({ length: 50 }, () => store.append(makeEvent({ eventId: newId() }))));
const positions = (await store.readFrom(0n)).map((e) => e.position);
expect(positions.at(-1)! - positions[0]! + 1n).toBe(BigInt(positions.length));
```

**Enforced by.** Review only (planned: this `event-store` integration test).

**Source.** [ADR-0003](../adr/0003-serialized-appends.md),
[ES-03](event-sourcing.md#es-03-take-the-advisory-lock-on-every-append).

### TEST-18: Run one contract suite against every EventBus

**MUST** write the `EventBus` behaviour tests once, as a suite parameterised by a factory, and run
it against every implementation (the in-memory fake and Postgres polling now, Redpanda later).
Projector unit tests **MUST** use the in-memory fake bus.

**Why.** The port is only a port if implementations are interchangeable
([ES-17](event-sourcing.md#es-17-depend-on-the-eventbus-port-only), ADR-0006). A shared suite shows
that a new transport behaves like the old one.

**Example.** (illustrative)

```ts
// ✅ packages/event-bus/src/contract.ts
export const eventBusContract = (name: string, makeBus: () => Promise<EventBus>) => {
  describe(`EventBus contract: ${name}`, () => {
    it("delivers events in position order", async () => {});
    it("redelivers from the checkpoint after a restart", async () => {});
  });
};
```

```ts
// ❌ the Postgres bus has its own tests, and a new transport starts from nothing
```

**Enforced by.** Review only (planned: shared suite in `packages/event-bus`).

**Source.** [ADR-0006](../adr/0006-eventbus-port.md),
[Node 7.1, Use a fake MQ for the majority of testing](https://github.com/testjavascript/nodejs-integration-tests-best-practices#-71-important-use-a-fake-mq-for-the-majority-of-testing),
[Node 7.3, Test message acknowledgment](https://github.com/testjavascript/nodejs-integration-tests-best-practices#-73-test-message-acknowledgment-and-nack-cknowledgment).

---

## Async and time

### TEST-19: Never sleep or poll in tests

**MUST NOT** wait for async results with `setTimeout`, sleep helpers or polling loops. Tests
**MUST** await a promise that resolves when the work is done (for example, a "processed" signal from
the fake bus). Time-based behaviour **MUST** use Vitest fake timers. For injecting the clock, see
[TEST-20](#test-20-inject-the-clock-and-the-id-generator).

**Why.** Sleeps make tests slow and flaky at the same time.

**Example.** (illustrative)

```ts
// ✅
vi.useFakeTimers();
const done = runner.processNextBatch();
await vi.advanceTimersByTimeAsync(1000);
await done;
```

```ts
// ❌
await new Promise((r) => setTimeout(r, 2000));
expect(await readModel()).toBeDefined();
```

**Enforced by.** Review only.

**Source.** [Node 7.2, Promisify the test. Avoid polling](https://github.com/testjavascript/nodejs-integration-tests-best-practices#-72-promisify-the-test-avoid-polling-indentation-and-callbacks),
[Node 5.9, Fake the time](https://github.com/testjavascript/nodejs-integration-tests-best-practices#-59-fake-the-time-to-minimize-network-call-duration).

### TEST-20: Inject the clock and the ID generator

**MUST** give code that needs the current time or a new id a parameter for it, for example
`clock: () => Date` and `newId: () => string`. Production wires the real ones. Tests pass fixed
versions. Code under test **MUST NOT** call `Date.now()`, `new Date()` or a UUID generator directly.

**Why.** `event_id` is a UUIDv7, and a UUIDv7 embeds a timestamp. A test that uses the real clock or
a random id cannot compare outputs exactly, and cannot reproduce a failure. Fake timers (TEST-19)
help with timers. They do not replace injection for ids.

**Example.** (illustrative)

```ts
// ✅
export const makeCollector = (deps: { clock: () => Date; newId: () => string }) => { /* … */ };

const collector = makeCollector({
  clock: () => new Date("2026-01-15T10:00:00.000Z"),
  newId: () => "0194f3a0-0000-7000-8000-000000000001",
});
```

```ts
// ❌ output differs on every run
const receivedAt = new Date();
const id = crypto.randomUUID();
```

**Enforced by.** Review only.

**Source.** TRK-20 owner decision,
[ADR-0004](../adr/0004-mongo-projections.md) (rebuild must give the same result),
[ES-04](event-sourcing.md#es-04-use-a-client-uuidv7-event_id-as-the-idempotency-key),
[TEST-19](#test-19-never-sleep-or-poll-in-tests).

---

## Deviations from sources

- **Unit tests are allowed.** Node 1.1 and 1.2 say to start with integration tests and use few unit
  tests. Pure handlers (ES-12) and zod schemas are cheap to test as units, so unit tests stay
  first-class here (TEST-03).
- **No HTTP-client guidance.** Node section 3 and 4.2 to 4.4 (server lifecycle, axios vs supertest,
  whole-response assertions) and section 5 (HTTP interceptors) are not adopted. There is no HTTP
  surface yet. Add them with the first HTTP test.
- **Docker is not started from the global setup.** Node 2.2 and 2.3 start and stop Docker Compose
  from test code. Here `pnpm dev` and the CI services own the infrastructure (TEST-10).
- **No coverage targets or property-based tests.** JS 4.1 (coverage) and 1.7 (property-based
  testing) are not adopted for now.
- **Not adopted.** JS tag-based test selection (1.11) and Node 2.5 (data in a RAM folder) add
  tooling without a need at ~50k events/day.
- **Other test-quality rules.** TEST-09 is wider than JS 4.4: it also forbids weakening a test to
  pass CI. That comes from the owner, not from the sources.
- **Dropped Node 6.3 / 6.6 / 6.8.** They concern an HTTP API response contract. They return when an
  API exists.
- **Overlap with other files.** TEST-15 and TEST-16 only describe how to write the tests that ES-06
  and ES-15 require. `as` in tests stays in TS-14.
