# Collector privacy policies

Covers custom event properties, `payload.name` and `context.url`. The file keeps its name to keep links stable.

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

**Not covered by this section.** `payload.name` and `context.url` have their own policies below. Other
envelope free text is not covered (see "Not covered" at the end).

## Event name policy

`applyEventNamePolicy(event)` in `apps/collector/src/privacy/event-name-policy.ts`. Pure, never throws, never
mutates. Returns `{ event, redacted }`.

1. A name must match `^[A-Za-z][A-Za-z0-9_.:-]{0,63}$` (identifier-like, at most 64 characters, no spaces, no `@`).
   Otherwise it is replaced with `redacted_name` (`name_invalid`). This is stricter than the schema limit of
   100 characters, which stays unchanged (ES-07).
2. A matching name with a run of 9 or more digits is replaced with `redacted_name` (`name_looks_personal`),
   for example `order_4915123456789`.

The name is required by the schema, so it is replaced, not dropped. Reports show all replaced names as one
`redacted_name` bucket. `redacted` has both reasons, always present, as integer counts. It never contains the name.

## URL policy

`applyUrlPolicy(event, policy = DEFAULT_URL_POLICY)` in `apps/collector/src/privacy/url-policy.ts`. Generic over
any event with a `context`, so it applies to all event types. Pure, never throws, never mutates.

1. The fragment is removed (`fragment_dropped`).
2. User and password are removed (`credentials_dropped`).
3. Only query parameters on the allowlist are kept: the exact names `utm_source`, `utm_medium`,
   `utm_campaign`, `utm_term`, `utm_content`, `utm_id`, `utm_source_platform`, `utm_creative_format`,
   `utm_marketing_tactic`, and the click IDs `gclid`, `gbraid`, `wbraid`, `dclid`, `fbclid`, `msclkid`, `ttclid`, `twclid`, `li_fat_id`. Other parameters are
   removed, one count each (`query_param_dropped`). Kept parameters keep their order. Other `utm_*` names are removed, because a name
   is caller-controlled text. A custom policy may set `allowedParamPrefixes`; a prefixed name that looks personal
   is still removed, but names without an email or 9+ digits (for example a person's name) would pass, so the
   default has no prefixes.
4. An allowed parameter whose decoded value looks personal (same detectors as above) is removed
   (`query_value_looks_personal`).
5. A path segment that looks personal after URL-decoding is replaced with `redacted` (`path_segment_redacted`).
6. Scheme, host, port and the other path segments stay. If no parameter is left, the `?` is removed.
7. If the URL cannot be parsed, it is replaced with `about:blank` (`url_unparseable`). Parsed events always hold
   a valid URL, so this is a safety net.
8. Only `http:` and `https:` URLs are rewritten. Any other scheme (`mailto:`, `data:`, `javascript:`) has an
   opaque path that cannot be redacted by segment, so it is replaced with `about:blank`
   (`url_scheme_unsupported`).

A URL that needs no change is returned as the same event object. The result still satisfies the event's v1 schema.
`redacted` holds counts per fixed reason, never parameter names or values (NODE-13).

## Not covered

The detectors are heuristics (see above). Not covered by any policy yet: `context.referrer` (a URL that can carry
another site's query string), `context.click_ids` and envelope `utm_*` values (the schema checks shape only),
`PageViewed.title` and `ElementClicked.href`.

Nothing calls the policies yet: the ingestion handler does not exist. It must call `applyPropertyPolicy`,
`applyEventNamePolicy` and `applyUrlPolicy` after schema parsing and before `append`.

## Related ADRs and schemas

- ADR-0009 (PII), ADR-0001 (shared zod contract), ADR-0012 (docs with behaviour).
- ES-07, ES-09, NODE-13.
- Code: `apps/collector/src/privacy/` (`property-policy.ts`, `event-name-policy.ts`, `url-policy.ts`, `detectors.ts`). Schema: `packages/event-schemas/src/events/custom-event-tracked.ts`.
- See also [event-envelope.md](event-envelope.md).
