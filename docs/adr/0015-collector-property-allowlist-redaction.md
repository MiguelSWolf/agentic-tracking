# ADR-0015: Custom event properties are admitted by a deny-by-default allowlist and redacted at the collector before append

- Status: Accepted
- Date: 2026-11-24
- Tags: privacy, pii, collector, contracts, event-sourcing

## Context

`CustomEventTracked.v1` accepts any property key with any primitive value. The schema checks shape only (ADR-0001). It cannot tell approved tracking metadata from free visitor input such as emails, phone numbers or typed text. Events are immutable (ES-01), so personal data that reaches the log can never be removed. ES-09 and ADR-0009 forbid personal data beyond what ADR-0009 allows. The frozen v1 wire schema must not change (ES-07). Raised by audit M0-06 (TRK-27).

## Decision

1. The collector admits `payload.properties` through a deny-by-default policy, after schema parsing and before `append`.
2. The allowlist is global and lives in code: `category`, `variant`, `step`, `plan`, `experiment_id`, `position`, `component`. A key not on it is dropped. The allowlist is the primary control.
3. Heuristic value detectors are a second line on allowed keys: an email-like string, or a run of 9 or more digits. Over-long strings (default 200 characters) and admitted keys beyond a limit (default 20) are also dropped.
4. The policy redacts the field and keeps the event. It never rejects the whole event.
5. The redaction result never carries property values. In the merged implementation it holds only a count per fixed reason, with no key names, because keys are caller-controlled too. It is safe to log (NODE-13).
6. Out: per-`app_id` allowlists, and free text in `payload.name` and `context.url`.

Behaviour details: [collector-property-policy.md](../specs/collector-property-policy.md).

## Alternatives considered

- **Denylist of known personal keys** — fails open for every key nobody thought of.
- **Reject the whole event** — one bad key loses the analytics of the whole event and pushes SDK users to retry with the same `event_id`.
- **New schema version with a closed property set** — breaks the frozen v1 contract (ES-07) and moves a privacy rule into the wire contract.
- **Per-`app_id` allowlists from config now** — needs the collector config module (NODE-10), which does not exist yet.
- **Broader NER-style detection** — costly and non-deterministic. The allowlist already does the main job.

## Consequences

- The ingestion handler MUST call `applyPropertyPolicy` after parsing and before `append`. Nothing calls it yet; a follow-up issue wires it. Only then can ES-09 "Enforced by" cite it.
- Detectors can drop legitimate values, for example a numeric `experiment_id` with 9 or more digits. New keys need a code change and review.
- Per-`app_id` allowlists come later, with collector config (NODE-10).
- Related: ADR-0009, ADR-0001, ES-07, ES-09, TRK-27.
