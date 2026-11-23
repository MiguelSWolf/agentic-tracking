# Collector property policy

## Purpose

`CustomEventTracked.v1` checks the shape of `payload.properties` only (flat string, number, boolean or null
values). It cannot tell approved tracking metadata from free visitor input. Events are immutable (ES-01), so
personal data that reaches the log cannot be removed (ES-09, ADR-0009). The collector therefore admits
properties through a deny-by-default policy before append. The wire schema is not changed (ES-07).

## Behaviour

`applyPropertyPolicy(event, policy = DEFAULT_PROPERTY_POLICY)` in `apps/collector/src/privacy/property-policy.ts`.
It is pure: it never throws and never mutates the input. It returns `{ event, redacted }`, where `redacted` is a count per reason.

Keys are processed in sorted order, so the result is deterministic. For each property:

1. **Key not on the allowlist** is dropped (`key_not_allowed`). This is the primary control.
2. **String value that looks personal** is dropped (`value_looks_personal`). Two detectors:
   an email-like value (`local@domain.tld`), and a run of 9 or more digits after removing spaces, dashes,
   dots and parentheses.
3. **String longer than `maxStringLength`** (default 200) is dropped (`value_too_long`).
4. **Admitted keys beyond `maxProperties`** (default 20) are dropped (`too_many_properties`).
5. Numbers, booleans and `null` on allowed keys pass unchanged.

If no property is left, `properties` is omitted. The result still satisfies `CustomEventTrackedV1`.
The policy redacts fields and keeps the event. It does not reject the event.

`redacted` holds a count of dropped properties per fixed reason (all four reasons are always present, zero
when unused). It contains no key names and no values: both are caller-controlled and can carry personal data
(for example a property named `jane.doe@example.com`). It is therefore safe to log (NODE-13, ADR-0009).

**Default allowlist** (global, in code): `category`, `variant`, `step`, `plan`, `experiment_id`, `position`,
`component`. Per-`app_id` allowlists are a later change and need the collector config module (NODE-10).

**What the detectors do not cover.** They are heuristics. They do not catch names, addresses or free text in
short strings. They can also drop legitimate values, for example a numeric `experiment_id` with 9 or more
digits. Admission relies on the allowlist; the detectors are a second line of defence on allowed keys.

**Not covered here.** `payload.name`, `context.url` and other envelope free text are not touched by this
policy. Nothing calls the policy yet: the ingestion handler does not exist. It must call
`applyPropertyPolicy` after schema parsing and before `append`.

## Related ADRs and schemas

- ADR-0009 (PII), ADR-0001 (shared zod contract), ADR-0012 (docs with behaviour).
- ES-07, ES-09, NODE-13.
- Code: `apps/collector/src/privacy/property-policy.ts`. Schema: `packages/event-schemas/src/events/custom-event-tracked.ts`.
- See also [event-envelope.md](event-envelope.md).
