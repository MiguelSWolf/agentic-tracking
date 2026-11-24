# Event envelope

## Purpose

One shared contract for every event the system records. All producers and consumers validate against
the zod schemas in `packages/event-schemas`.

## Behaviour

**Envelope v1** (strict: unknown keys are rejected). Fields: `event_id` (UUIDv7, idempotency key),
`type`, `version`, `occurred_at`, `received_at?`, `attribution_key`, `session_id`, `seq` (integer ≥ 0),
`user_id?`, `app_id`, `source` (`client` | `server`), `trust` (`unverified` | `signed`), `context`, `payload`.
`context` has `url` and optional `referrer`, `utm_*`, `click_ids`, `ua`, `ip_trunc`.

**Trust rule.** `source = client` requires `trust = unverified`. The issue is reported at path `trust`.

**Event types (all version 1).**

| Type | Payload |
| --- | --- |
| `SessionStarted` | empty |
| `PageViewed` | `title?` (≤ 300) |
| `ElementClicked` | `selector` (≤ 500), `label?` (≤ 100, from `data-track-label`), `href?` |
| `CustomEventTracked` | `name` (≤ 100), `properties?` (flat string, number, boolean or null values; the schema checks shape only, the collector admits keys and values per [collector-property-policy.md](collector-property-policy.md)) |
| `Identified` | empty; envelope `user_id` is required |
| `ConversionRecorded` | `conversion_id`, `value?` (≥ 0), `currency?` (three upper-case letters, format check only; ISO 4217 membership is not validated); `currency` is required when `value` is present |

**Parsing.** `parseEvent(unknown)` returns `{ ok: true, event }` or `{ ok: false, error }` (a `ZodError`). It
never throws for invalid input. An unknown `type` or an unregistered `version` fails at `type` or `version`.

**Fixtures.** `packages/event-schemas/fixtures/<Type>.v<N>/` holds flat `valid-*.json` (an event) and
`invalid-*.json` (`{ "expected_path": [...], "input": {...} }`) files. Each invalid fixture breaks exactly one
thing. A contract test runs every file; a new fixture needs no code change.

**Versioning.** Published versions are frozen. A change adds a new version plus an upcaster (ES-07).

**Out of scope here.** HMAC verification of `signed`, IP truncation and PII in `context.url` query strings
belong to the collector. So does admission of custom event properties
([collector-property-policy.md](collector-property-policy.md)).

## Related ADRs and schemas

- ADR-0001 (shared zod contract), ADR-0007 (`seq` ordering), ADR-0008 (conversions, trust), ADR-0009 (PII).
- Code: `packages/event-schemas/src/envelope.ts`, `src/events/`, `src/registry.ts`, `src/parse-event.ts`.
