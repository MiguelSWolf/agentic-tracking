---
name: new-event-type
description: Use when adding a new event type or a new version of an existing event type in packages/event-schemas.
---

# New event type / new version

Events are immutable contracts. A new version never replaces the old one: it adds a schema and an upcaster.

## New type

1. `packages/event-schemas/src/events/<kebab-name>.ts`: export a zod schema for the payload and a
   discriminated envelope with `type: '<PascalName>'` and `version: 1`.
2. Register it in the `eventRegistry` (type + version → schema).
3. Fixtures in `packages/event-schemas/fixtures/<PascalName>.v1/`:
   at least `valid-minimal.json`, `valid-full.json` and 2 invalid cases named after what breaks
   (`invalid-missing-attribution-key.json`).
4. Contract test `<kebab-name>.test.ts`: every valid fixture parses, every invalid fixture fails
   with the expected path in the zod error.
5. Export the inferred TS types.

## New version (vN → vN+1)

1. Add the `vN+1` schema. Keep `vN` untouched.
2. Add an upcaster `upcast<Name>V<N>ToV<N+1>(e): EventV<N+1>` in `src/upcasters/`. It must be pure.
3. Test: every `vN` valid fixture upcasts into a valid `vN+1` event.
4. Readers (projections) consume only the latest version. Upcasting happens on read.

## Checklist

- [ ] `version` is explicit
- [ ] Fixtures (valid + invalid) present
- [ ] Contract test green
- [ ] No PII beyond ADR-009
