# TypeScript standards (`TS-nn`)

Rules for TypeScript in `packages/` and `apps/`. How to read them: [README](README.md). Policy:
[ADR-0013](../adr/0013-code-standards-foundation.md).

The code is still mostly stubs, so the examples are **illustrative**. Names such as `parseEvent` show
the intended shape, not an existing API. Runtime error rules (throw `Error` subclasses, pass `cause`)
live in [node.md](node.md) and are linked, not repeated.

**Biome severity.** Biome reports the recommended rules `noExplicitAny`, `noNonNullAssertion`,
`useImportType`, `useExportType`, `useConst`, `noTsIgnore` and `noConstEnum` at `warn`. The package `lint` scripts do not pass
`--error-on-warnings`, so these checks flag code but do not fail CI. They are active, so they are
listed as "Biome: …" below. Making them blocking is a separate follow-up.

## Summary

| ID                                                                | Level      | Rule                                                                  | Enforced by                                                                                          |
| ----------------------------------------------------------------- | ---------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [TS-01](#ts-01-keep-strict-compiler-options-on)                   | MUST       | Keep `strict` and `noUncheckedIndexedAccess` on                       | TypeScript: `strict`, `noUncheckedIndexedAccess`                                                     |
| [TS-02](#ts-02-never-use-any)                                     | MUST NOT   | Use `any`; use `unknown` and narrow                                   | Biome: `suspicious/noExplicitAny`                                                                    |
| [TS-03](#ts-03-never-silence-the-compiler)                        | MUST NOT   | Use `@ts-ignore` or `@ts-nocheck`                                     | Biome: `suspicious/noTsIgnore` (`@ts-ignore` only) + review                                          |
| [TS-04](#ts-04-use-named-exports)                                 | MUST       | Use named exports; Vitest configs are the only default exports        | Review only (planned: `Biome: style/noDefaultExport` with an override for `vitest*.config.ts`)      |
| [TS-05](#ts-05-mark-type-only-imports-and-exports)                | MUST       | Use `import type` / `export type` for type-only symbols               | TypeScript: `verbatimModuleSyntax`; Biome: `style/useImportType`, `style/useExportType`              |
| [TS-06](#ts-06-write-relative-imports-with-the-js-extension)      | MUST       | Write relative imports with the `.js` extension                       | TypeScript: `module`/`moduleResolution` `NodeNext`                                                   |
| [TS-07](#ts-07-never-use-enum)                                    | MUST NOT   | Use `enum` or `const enum`                                            | Biome: `suspicious/noConstEnum` (`const enum` only); rest Review only (planned: `erasableSyntaxOnly`) |
| [TS-08](#ts-08-never-use-namespace-or-require)                    | MUST NOT   | Use `namespace` or `require`                                          | Review only (planned: TypeScript `erasableSyntaxOnly`)                                               |
| [TS-09](#ts-09-follow-the-naming-conventions)                     | SHOULD     | `camelCase` values, `PascalCase` types, `CONSTANT_CASE` constants     | Review only (planned: `Biome: style/useNamingConvention`)                                            |
| [TS-10](#ts-10-use-const-by-default)                              | MUST       | `const` by default, `let` only when reassigned, never `var`           | Biome: `style/useConst`; `var` Review only (planned: `Biome: suspicious/noVar`)                      |
| [TS-11](#ts-11-prefer-immutable-data)                             | SHOULD     | Prefer `readonly`; do not mutate arguments; no `export let`           | Review only                                                                                          |
| [TS-12](#ts-12-derive-event-types-with-zinfer)                    | MUST       | Derive event types with `z.infer`                                     | Review only                                                                                          |
| [TS-13](#ts-13-never-use-the-non-null-assertion)                  | MUST NOT   | Use the non-null assertion `!`                                        | Biome: `style/noNonNullAssertion`                                                                    |
| [TS-14](#ts-14-avoid-as-type-assertions)                          | MUST NOT   | Use `as` in production code (`as const` allowed); SHOULD NOT in tests | Review only                                                                                          |
| [TS-15](#ts-15-make-switches-over-unions-exhaustive)              | MUST       | Make a `switch` over a union exhaustive with a `never` check          | Review only (planned: `Biome: nursery/useExhaustiveSwitchCases`)                                     |
| [TS-16](#ts-16-return-expected-failures-as-a-union)               | SHOULD     | Return expected failures as a locally declared union                  | Review only                                                                                          |
| [TS-17](#ts-17-treat-caught-values-as-unknown)                    | MUST       | Treat caught values as `unknown` and narrow                           | TypeScript: `strict` (`useUnknownInCatchVariables`)                                                  |

---

## Compiler and types

### TS-01: Keep strict compiler options on

**MUST** keep `strict` and `noUncheckedIndexedAccess` enabled. Packages extend
`tsconfig.base.json` and **MUST NOT** loosen these options.

**Why.** Strict mode is what makes the other rules checkable. Indexed access returns
`T | undefined`, so a missing array item or record key is handled, not assumed.

**Example.** (illustrative)

```jsonc
// ✅ packages/x/tsconfig.json
{ "extends": "../../tsconfig.base.json" }
```

```jsonc
// ❌ loosening the base
{ "extends": "../../tsconfig.base.json", "compilerOptions": { "strict": false } }
```

**Enforced by.** TypeScript: `strict`, `noUncheckedIndexedAccess` (in `tsconfig.base.json`). A
package that overrides them is caught in review.

**Source.** [ADR-0001](../adr/0001-node-typescript-shared-schemas.md).

### TS-02: Never use `any`

**MUST NOT** use `any`. Use `unknown` and narrow it, or a precise type.

**Why.** `any` turns off checking for everything it touches and spreads through inferred types.
`unknown` forces the caller to narrow first.

**Example.** (illustrative)

```ts
// ✅
function parsePayload(input: unknown): Payload {
  return PayloadSchema.parse(input);
}
```

```ts
// ❌
function parsePayload(input: any): Payload {
  return input;
}
```

**Enforced by.** Biome: `suspicious/noExplicitAny` (warn severity, see the note above).

**Source.** [Google, any type](https://google.github.io/styleguide/tsguide.html#any-type),
[Google, using unknown over any](https://google.github.io/styleguide/tsguide.html#using-unknown-over-any).

### TS-03: Never silence the compiler

**MUST NOT** use `@ts-ignore` or `@ts-nocheck`. `@ts-expect-error` is allowed only in tests, with a
reason on the same line.

**Why.** These directives hide the error and anything else on that line. The real cause is usually
fixable with a type or a guard.

**Example.** (illustrative)

```ts
// ✅ in a *.test.ts file
// @ts-expect-error: testing the runtime guard with a wrong type
parseEvent({ type: 42 });
```

```ts
// ❌ production code
// @ts-ignore
const id = event.payload.id;
```

**Enforced by.** Biome: `suspicious/noTsIgnore` (flags `@ts-ignore` only, warn severity). The other
directives are caught in review.

**Source.** [Google, @ts-ignore](https://google.github.io/styleguide/tsguide.html#ts-ignore).

## Modules

### TS-04: Use named exports

**MUST** use named exports. **MUST NOT** use `export default`, except in Vitest config files
(`vitest*.config.ts`), where the tool expects a default export.

**Why.** Named exports keep one name per symbol across the repo, so rename and search work and
imports cannot drift.

**Example.** (illustrative)

```ts
// ✅
export const PageViewedV1 = z.object({ /* ... */ });
```

```ts
// ❌
export default z.object({ /* ... */ });
```

**Enforced by.** Review only (planned: `Biome: style/noDefaultExport` with an override for
`vitest*.config.ts`).

**Source.** [Google, exports](https://google.github.io/styleguide/tsguide.html#exports).

### TS-05: Mark type-only imports and exports

**MUST** use `import type` and `export type` for symbols that are only types.

**Why.** Type-only imports are erased, so they cannot create runtime import cycles or load a module
for nothing. `verbatimModuleSyntax` makes the compiler enforce it.

**Example.** (illustrative)

```ts
// ✅
import type { EventEnvelope } from "@tracking/event-schemas";
```

```ts
// ❌ a type imported as a value
import { EventEnvelope } from "@tracking/event-schemas";
```

**Enforced by.** TypeScript: `verbatimModuleSyntax`; Biome: `style/useImportType`,
`style/useExportType`.

**Source.** [Google, import type](https://google.github.io/styleguide/tsguide.html#import-type),
[Google, export type](https://google.github.io/styleguide/tsguide.html#export-type).

### TS-06: Write relative imports with the `.js` extension

**MUST** write the `.js` extension in relative imports, even though the source file is `.ts`.

**Why.** The project runs as native ESM on Node (`NodeNext`), which does not resolve extensionless
paths. The `.js` name is what exists at runtime.

**Example.** (illustrative)

```ts
// ✅
import { parseEvent } from "./parse-event.js";
```

```ts
// ❌ fails under NodeNext
import { parseEvent } from "./parse-event";
```

**Enforced by.** TypeScript: `module` and `moduleResolution` set to `NodeNext`.

**Source.** [ADR-0001](../adr/0001-node-typescript-shared-schemas.md),
[Google, import paths](https://google.github.io/styleguide/tsguide.html#import-paths).

## Language features

### TS-07: Never use `enum`

**MUST NOT** declare `enum` or `const enum`. Use a string-literal union, or an `as const` object
when you need the values at runtime.

**Why.** Enums are runtime syntax that does not erase, and they do not match zod literals. String
unions are plain data and serialize as-is.

**Example.** (illustrative)

```ts
// ✅
export const TRUST_LEVELS = ["low", "high"] as const;
export type Trust = (typeof TRUST_LEVELS)[number];
```

```ts
// ❌
export enum Trust {
  Low = "low",
  High = "high",
}
```

**Enforced by.** Biome: `suspicious/noConstEnum` (`const enum` only, warn severity). Plain `enum`
is Review only (planned: TypeScript `erasableSyntaxOnly`).

**Source.** [Google, enums](https://google.github.io/styleguide/tsguide.html#const-enums) (we are
stricter, see Deviations).

### TS-08: Never use `namespace` or `require`

**MUST NOT** use `namespace`, `module` blocks or `require()`. Use ES modules.

**Why.** Namespaces are non-erasable syntax and `require` does not exist in native ESM.

**Example.** (illustrative)

```ts
// ✅
import { createHash } from "node:crypto";
```

```ts
// ❌
const { createHash } = require("node:crypto");
```

**Enforced by.** Review only. Planned: TypeScript `erasableSyntaxOnly`, which would reject
namespaces that contain runtime code and enums, but not plain `require()` calls or ambient
`declare module` blocks. Those stay Review only. Planned for `require()`: `Biome: style/noCommonJs`
(exists in 2.6.8, not enabled today).

**Source.**
[Google, use modules not namespaces](https://google.github.io/styleguide/tsguide.html#use-modules-not-namespaces).

### TS-09: Follow the naming conventions

**SHOULD** name values and functions `camelCase`, types, classes and zod schemas `PascalCase`, and
module-level constants `CONSTANT_CASE`. Event wire fields stay `snake_case`, exactly as the event
schemas define them.

**Why.** One convention makes names predictable. Wire fields are a contract, so they are not
renamed in code.

**Example.** (illustrative)

```ts
// ✅
const MAX_BATCH_SIZE = 100;
type EventEnvelope = { event_id: string; occurred_at: string };
function parseEvent(input: unknown): EventEnvelope {
  /* ... */
}
```

```ts
// ❌
const max_batch_size = 100;
type eventEnvelope = { eventId: string };
```

**Enforced by.** Review only (planned: `Biome: style/useNamingConvention`).

**Source.** [Google, identifiers](https://google.github.io/styleguide/tsguide.html#identifiers)
(deviation for wire fields).

### TS-10: Use `const` by default

**MUST** declare with `const`, use `let` only when the binding is reassigned, and **MUST NOT** use
`var`.

**Why.** `const` tells the reader a binding never changes. `var` has function scope and hoisting
surprises.

**Example.** (illustrative)

```ts
// ✅
const events = await readBatch(position);
let cursor = position;
```

```ts
// ❌
var events = await readBatch(position);
```

**Enforced by.** Biome: `style/useConst`. `var` is Review only (planned:
`Biome: suspicious/noVar`).

**Source.**
[Google, use const and let](https://google.github.io/styleguide/tsguide.html#use-const-and-let).

### TS-11: Prefer immutable data

**SHOULD** mark properties `readonly`, take `ReadonlyArray<T>` parameters when the function does
not mutate, and **SHOULD NOT** mutate arguments. **MUST NOT** use `export let`.

**Why.** Projection handlers and event data are values. Mutation of shared objects makes replays
depend on call order.

**Example.** (illustrative)

```ts
// ✅
export function addView(state: Readonly<State>, event: PageViewed): State {
  return { ...state, views: state.views + 1 };
}
```

```ts
// ❌
export function addView(state: State, event: PageViewed): State {
  state.views += 1;
  return state;
}
```

**Enforced by.** Review only.

**Source.** [Google, use readonly](https://google.github.io/styleguide/tsguide.html#use-readonly),
[Google, mutable exports](https://google.github.io/styleguide/tsguide.html#mutable-exports).

## Domain types

### TS-12: Derive event types with `z.infer`

**MUST** derive an event's TypeScript type from its zod schema with `z.infer`. **MUST NOT**
hand-write a parallel type.

**Why.** The schema is the contract (ES-05). A second hand-written type can drift from it without
any error.

**Example.** (illustrative)

```ts
// ✅
export const PageViewedV1 = z.object({ type: z.literal("PageViewed"), version: z.literal(1) });
export type PageViewedV1 = z.infer<typeof PageViewedV1>;
```

```ts
// ❌
export interface PageViewedV1 {
  type: "PageViewed";
  version: 1;
}
```

**Enforced by.** Review only.

**Source.** [ADR-0001](../adr/0001-node-typescript-shared-schemas.md),
[ES-05](event-sourcing.md#es-05-give-every-event-type-a-versioned-zod-schema).

### TS-13: Never use the non-null assertion

**MUST NOT** use the postfix `!` operator. Narrow with a check, or handle the `undefined` case.

**Why.** `!` is an unchecked claim. With `noUncheckedIndexedAccess` on, the compiler already tells
you where a value may be missing.

**Example.** (illustrative)

```ts
// ✅
const first = events[0];
if (first === undefined) return;
use(first);
```

```ts
// ❌
use(events[0]!);
```

**Enforced by.** Biome: `style/noNonNullAssertion` (warn severity).

**Source.**
[Google, type and non-nullability assertions](https://google.github.io/styleguide/tsguide.html#type-and-non-nullability-assertions).

### TS-14: Avoid `as` type assertions

**MUST NOT** use `as` assertions in production code. `as const` is allowed. In `*.test.ts` and
`*.int.test.ts`, `as` is **SHOULD NOT**: it is allowed for partial mocks and fixtures, with a short
comment.

**Why.** An assertion overrides the compiler. Parsing with zod or a type guard checks the value at
runtime too.

**Example.** (illustrative)

```ts
// ✅
const event = PageViewedV1.parse(input);
```

```ts
// ❌
const event = input as PageViewedV1;
```

```ts
// ✅ in a test: partial mock, with a reason
const bus = { publish: vi.fn() } as unknown as EventBus; // only publish is used here
```

**Enforced by.** Review only.

**Source.**
[Google, type and non-nullability assertions](https://google.github.io/styleguide/tsguide.html#type-and-non-nullability-assertions),
[Google, double assertions](https://google.github.io/styleguide/tsguide.html#double-assertions)
(we are stricter, see Deviations).

### TS-15: Make switches over unions exhaustive

**MUST** make a `switch` over a union exhaustive. The `default` branch assigns the value to `never`.

**Why.** When a new event type or version joins the union, the compiler fails at every switch that
forgot it.

**Example.** (illustrative)

```ts
// ✅
switch (event.type) {
  case "PageViewed":
    return onPageViewed(state, event);
  case "LinkClicked":
    return onLinkClicked(state, event);
  default: {
    const unreachable: never = event;
    throw new Error(`Unhandled event: ${JSON.stringify(unreachable)}`);
  }
}
```

```ts
// ❌ silently ignores new event types
switch (event.type) {
  case "PageViewed":
    return onPageViewed(state, event);
}
return state;
```

**Enforced by.** Review only (planned: `Biome: nursery/useExhaustiveSwitchCases`).

**Source.**
[Google, switch statements](https://google.github.io/styleguide/tsguide.html#switch-statements)
(see Deviations).

## Errors

Throwing and wrapping errors: [NODE-01](node.md#node-01-throw-only-error-objects) and
[NODE-02](node.md#node-02-pass-the-caught-error-as-cause). The rules below cover the type side.

### TS-16: Return expected failures as a union

**SHOULD** return expected failures, such as validation, as a discriminated union declared where it
is used. **SHOULD NOT** add a shared `Result` type or a library for it.

**Why.** The caller sees the failure in the signature and the compiler forces it to handle it.
Throwing stays for unexpected errors.

**Example.** (illustrative)

```ts
// ✅
type ParseResult = { ok: true; value: EventEnvelope } | { ok: false; error: string };
```

```ts
// ❌ a failure the caller cannot see in the type
function parse(input: unknown): EventEnvelope {
  throw "invalid";
}
```

**Enforced by.** Review only.

**Source.**
[Google, exception handling](https://google.github.io/styleguide/tsguide.html#exception-handling)
(errors as values is an addition, see Deviations).

### TS-17: Treat caught values as `unknown`

**MUST** treat the value in a `catch` clause as `unknown` and narrow it before use.

**Why.** Anything can be thrown, not only `Error`. Narrowing avoids reading `.message` on a string.

**Example.** (illustrative)

```ts
// ✅
try {
  await publish(event);
} catch (error: unknown) {
  if (error instanceof Error) log(error.message);
  else throw new Error("Failed to publish event", { cause: error });
}
```

```ts
// ❌
catch (error: any) {
  log(error.message);
}
```

**Enforced by.** TypeScript: `strict` (includes `useUnknownInCatchVariables`).

**Source.**
[Google, using unknown over any](https://google.github.io/styleguide/tsguide.html#using-unknown-over-any).

---

## Deviations from sources

- **Formatting.** Google's formatting rules are skipped, because Biome decides formatting
  (ADR-0013 §7).
- **Enums (TS-07).** Google allows `enum`. We ban it: enums are runtime syntax that does not erase,
  and string unions match zod literals.
- **Assertions (TS-14).** Google allows `as` with a justifying comment. In production code we ban it.
  In tests it is SHOULD NOT, allowed for partial mocks and fixtures with a short comment (owner
  decision, TRK-18).
- **`switch` (TS-15).** Google requires a `default` in every `switch`. The `never` check in
  `default` satisfies that and adds exhaustiveness.
- **Naming (TS-09).** Event wire fields use `snake_case`, as defined by the event schemas.
- **Errors as values (TS-16).** Google does not cover this. It is an addition, with no shared type.
- **`@ts-expect-error` (TS-03).** Google says not to use it but allows it in unit tests. We follow
  that and require a reason.
