# Code standards

Normative rules with stable IDs, written for agents and reviewers. This file is a reading guide.
The policy lives in [ADR-0013](../adr/0013-code-standards-foundation.md). If a rule and an ADR
disagree, the ADR wins and the rule is a bug.

## How to read the rules

- **Levels.** MUST, MUST NOT, SHOULD, SHOULD NOT and MAY mean what RFC 2119 and RFC 8174 say, in
  uppercase only ([RFC 2119](https://www.rfc-editor.org/rfc/rfc2119),
  [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174); ADR-0013 §2). A MUST violation blocks the PR.
  A SHOULD deviation needs a stated reason in the PR.
- **IDs.** `TS-nn`, `NODE-nn`, `TEST-nn`, `ES-nn`. Never renumbered or reused; removed rules stay
  listed as `Retired` (ADR-0013 §3). Cite IDs in plans, PRs and review findings.
- **Formatting** is Biome's job, not a rule (ADR-0013 §7).
- **Changing a rule** takes a Linear issue and a PR with owner review (ADR-0013 §8).

## Rule anatomy

Copy this template. Every field is required (ADR-0013 §4).

````markdown
### ES-00: <imperative title>

**MUST** <one-sentence normative statement>.

**Why.** <1–3 sentences.>

**Example.**

```ts
// ✅ good
```

```ts
// ❌ bad
```

**Enforced by.** <one value from the table below>

**Source.** <link to the ADR and/or the external guide section>
````

Retired rules keep their heading: `### ES-00: <title> (Retired)`, with a line pointing to the
replacement.

## "Enforced by" values

Enforcement order is tooling > tests > review (ADR-0013 §6). Only claim a check that exists today.

| Value                            | Meaning                                                                          |
| -------------------------------- | -------------------------------------------------------------------------------- |
| `Biome: <group/ruleName>`        | Active through `recommended` or set in `biome.json`.                             |
| `TypeScript: <compilerOption>`   | Set in `tsconfig.base.json`.                                                     |
| `Test: <kind/name>`              | A test that fails when the rule is broken.                                       |
| `Review only`                    | No automated check. Candidate for automation; the milestone retro reviews these. |
| `Review only (planned: <check>)` | Same, and a specific Biome rule or test is the intended check.                   |

## Area file layout

An intro, a summary table (ID | Level | Rule | Enforced by), the rules, then
"Deviations from sources".

## Index

| Area                     | File                                            | Base references (ADR-0013 §5)                                                            |
| ------------------------ | ----------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Event sourcing (`ES-nn`) | [event-sourcing.md](event-sourcing.md)          | This repo's ADRs                                                                         |
| TypeScript (`TS-nn`)     | `typescript.md`, coming in a later TRK-16 slice | Google TypeScript Style Guide                                                            |
| Node runtime (`NODE-nn`) | `node.md`, coming in a later TRK-16 slice       | goldbergyoni/nodebestpractices                                                           |
| Testing (`TEST-nn`)      | `testing.md`, coming in a later TRK-16 slice    | goldbergyoni/javascript-testing-best-practices, Node.js integration-tests best practices |
