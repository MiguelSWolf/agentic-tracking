# AGENTS.md — agentic-tracking

Single source of rules for every agent working in this repo (Claude Code, Codex, CodeRabbit).
`CLAUDE.md` imports this file. Skills live in `.agents/skills/` (`.claude/skills` is a symlink to it).

## What this project is

A small event-sourced tracking system: it records how visitors arrive (UTMs, referrer, click IDs)
and what they do (page views, clicks, custom events, conversions), linked by an `attribution_key`
until conversion. It is a learning project for event sourcing and agentic development, designed
for ~50k events/day.

- Event store: **PostgreSQL** (append-only `events` table, global `position`). Source of truth.
- Projections (read models): **MongoDB**, rebuildable from the log at any time.
- Transport: `EventBus` port. Postgres polling now, Redpanda/Kafka later (ADR-006).
- Stack: Node 24 + TypeScript (strict), pnpm workspaces + Turborepo, Vitest, Biome, zod.
- Decisions: `docs/adr/`. See "Decisions, specs and docs" below.

## Decisions, specs and docs (read before planning)

1. **Before planning any issue, read `docs/adr/README.md`**, the ADR index. Open every ADR whose tags or title touch the change, and cite them in the plan and the PR. Only `Accepted` ADRs are in force.
2. **A new or changed decision follows the `write-adr` skill.** Never contradict an accepted ADR silently. Propose a superseding ADR instead (ADR-0012).
3. **Behaviour and docs change together (ADR-0012).** The plan lists the specs (`docs/specs/`), docs and ADRs it will create or change. The PR updates them in the same change, or states "Docs: none, because …".
4. **Code standards (ADR-0013)** live in `docs/code-standards/` and use rule IDs (`TS-nn`, `NODE-nn`, `TEST-nn`, `ES-nn`). Cite the IDs when relevant.

## Repository layout

```
apps/        collector, projector, api, demo-landing, demo-shop
packages/    event-schemas, event-store, event-bus, sdk-browser, sdk-node
infra/       docker-compose (postgres, mongo, n8n, metabase)
docs/        all documentation; start at docs/README.md
  adr/             architecture decision records (index: adr/README.md)
  specs/           living specs per capability (ADR-0012)
  code-standards/  TS-nn / NODE-nn / TEST-nn / ES-nn rules (ADR-0013)
  infra/           how to run and operate infra/
  workflow/        agent workflow, gates G0-G5, skills
  audits/          milestone audit reports (Codex)
  retros/          milestone retrospectives
scripts/     repo tooling (linear.mjs, adr-index.mjs)
.agents/     shared skills
```

## Domain invariants (never break these)

1. Events are **immutable**. Never update or delete a row in `events`. Fixes are new events or upcasters.
2. Every event type has a **zod schema with an explicit `version`** in `packages/event-schemas`,
   plus valid and invalid fixtures and a contract test. No schema, no event.
3. `event_id` is a client-generated UUIDv7 and is the **idempotency key** (unique constraint).
4. Ordering inside a session uses the client `seq`, never `occurred_at` (ADR-007).
5. Every projection must be **rebuildable from position 0** and keep its own checkpoint.
   A replay test (rebuild == incremental) is mandatory for each projection.
6. Conversions carry `source` (`client` | `server`), `app_id`, `trust` and `conversion_id`.
   Server conversions win on dedup (ADR-008).
7. No PII beyond what ADR-009 allows. IPs are truncated before storage. Respect consent.

## Commands

```
pnpm install
pnpm dev              # infra up + apps in watch mode
pnpm lint             # biome
pnpm typecheck
pnpm test             # vitest (unit + contract)
pnpm test:integration # needs postgres + mongo (docker or CI services)
```

Run `pnpm lint && pnpm typecheck && pnpm test` before every commit. Never commit with failing checks.

## Conventions

- Everything in **English**: code, identifiers, commits, PRs, ADRs, docs, audit reports.
- Commits: Conventional Commits (`feat(event-schemas): add PageViewed v1`).
- Agent branches: `agent/trk-<n>-<short-slug>`.
- One issue = one PR. PR body uses the template and contains `Fixes TRK-<n>`.
- Small, reviewable diffs. If an issue needs more than ~400 changed lines, stop and propose a split.
- Tests live next to code (`*.test.ts`); integration tests use `*.int.test.ts`.

## Code standards

Rules have stable IDs (`ES-nn`, `TS-nn`, `NODE-nn`, `TEST-nn`). Cite them in plans, PRs and
reviews. A MUST violation blocks the PR; a SHOULD deviation needs a stated reason. Start at
[docs/code-standards/README.md](docs/code-standards/README.md).

- **Event sourcing** ([event-sourcing.md](docs/code-standards/event-sourcing.md)):
  ES-01 never update or delete events; ES-02 read and replay in `position` order; ES-03 advisory
  lock on every append; ES-04 client UUIDv7 `event_id` is the idempotency key; ES-05 versioned zod
  schema per event; ES-06 fixtures and contract test per version; ES-07 never change a published
  version; ES-08 past-tense event names; ES-09 no personal data in payloads; ES-10 conversions carry
  `source`, `app_id`, `trust`, `conversion_id`; ES-11 order a session by `seq`; ES-12 pure
  handlers; ES-13 idempotent projection writes; ES-14 the runner owns the checkpoint; ES-15 replay
  test per projection; ES-16 blue/green version bump; ES-17 depend on the `EventBus` port only;
  ES-18 bounded projection documents.
- **TypeScript** ([typescript.md](docs/code-standards/typescript.md)):
  TS-01 strict options on; TS-02 no `any`; TS-03 no `@ts-ignore`/`@ts-nocheck`; TS-04 named
  exports; TS-05 `import type`/`export type`; TS-06 `.js` in relative imports; TS-07 no `enum`;
  TS-08 no `namespace` or `require`; TS-09 naming conventions; TS-10 `const` by default; TS-11
  prefer immutable data; TS-12 derive types with `z.infer`; TS-13 no `!`; TS-14 avoid `as`; TS-15
  exhaustive `switch`; TS-16 expected failures as a union; TS-17 caught values are `unknown`.
- **Node runtime** ([node.md](docs/code-standards/node.md)):
  NODE-01 throw only `Error`; NODE-02 pass `cause`; NODE-03 operational vs programmer errors;
  NODE-04 one central error handler; NODE-05 exit on uncaught errors; NODE-06 no floating promises;
  NODE-07 `return await` in `try`; NODE-08 handle `'error'` events; NODE-09 timeout on outbound
  calls; NODE-10 `process.env` in one config module; NODE-11 no secrets in repo or logs; NODE-12
  structured JSON logger; NODE-13 no personal data in logs; NODE-14 correlation id; NODE-15
  validate external input with zod; NODE-16 parameterised SQL only; NODE-17 graceful shutdown;
  NODE-18 `node:` import protocol; NODE-19 constant-time signature compare.
- **Testing** ([testing.md](docs/code-standards/testing.md)):
  TEST-01 three-part test names; TEST-02 Arrange/Act/Assert; TEST-03 `*.test.ts` vs
  `*.int.test.ts`; TEST-04 test public behaviour; TEST-05 prefer fakes and stubs to mocks; TEST-06
  realistic data; TEST-07 expect errors, do not catch; TEST-08 avoid snapshots; TEST-09 no `.only`,
  and never weaken a test to pass CI; TEST-10 real Postgres and Mongo; TEST-11 production
  migrations build the test schema; TEST-12 each test owns its records; TEST-13 one clean-up
  strategy, never delete from `events`; TEST-14 assert every outcome; TEST-15 contract tests from
  fixture folders; TEST-16 replay tests on one fixture stream; TEST-17 concurrent-append test;
  TEST-18 shared `EventBus` contract suite; TEST-19 no sleeping or polling; TEST-20 inject clock
  and ID generator.

## Scope discipline

- Do exactly what the issue's acceptance criteria ask. No drive-by refactors.
- If something outside the scope looks wrong, mention it in the PR under "Out of scope findings".
- If the issue is ambiguous, stop and ask in the issue instead of guessing.

## Protected zones (G5)

Agents must **not** modify these paths. CI fails any `agent/*` branch that touches them,
and CODEOWNERS requires the owner's review:

```
.github/   .agents/   .claude/   AGENTS.md   CLAUDE.md   docs/adr/   **/migrations/
scripts/linear.mjs   scripts/linear-lib.mjs   scripts/cancel-waiting-ci.mjs   docs/code-standards/
```

To change a protected file, describe the proposed change in the PR or issue and let the owner apply it.

## Review guidance (for CodeRabbit and Codex)

Prioritise, in order: violations of the invariants above, missing contract/replay tests,
ADR violations (check `docs/adr/README.md`), behaviour changes without the matching spec/doc update
(ADR-0012), correctness bugs, security/privacy issues, code-standard violations (cite the rule ID).
Skip style nits that Biome already enforces.
Follow the `review-pr` skill (`.agents/skills/review-pr/`) for the order, the `[P1–P3]` comment format and the summary.
