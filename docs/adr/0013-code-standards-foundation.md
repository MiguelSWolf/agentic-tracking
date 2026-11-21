# ADR-0013: Code standards are normative, sourced and enforced by tooling first

- Status: Accepted
- Date: 2026-11-21
- Tags: code-standards, typescript, node, testing, review, agents

## Context

Agents write most of the code. Agents and reviewers need one shared, precise definition of "good code" for this repo. Vague guidelines ("write clean code") produce inconsistent results, and rules nobody can trace back to a reason get ignored or argued about in every review.

## Decision

1. **Location and protection.** Standards live in `docs/code-standards/`, one file per area: `typescript.md`, `node.md`, `testing.md` and `event-sourcing.md`, plus a `README.md`. The folder is a protected zone (CODEOWNERS and the CI guard). `AGENTS.md` carries only a summary: rule IDs, one line each, and a link.
2. **Normative language.** Rules use RFC 2119 levels (MUST, MUST NOT, SHOULD, SHOULD NOT, MAY), as the Google TypeScript Style Guide does.
3. **Stable IDs.** Every rule has an ID per area (`TS-nn`, `NODE-nn`, `TEST-nn`, `ES-nn`). IDs are never renumbered or reused. A removed rule stays listed as "Retired".
4. **Rule anatomy.** Every rule has:
   - **Why**: 1–3 sentences.
   - **Example**: ✅/❌.
   - **Enforced by**: a Biome rule, a TypeScript option, a test, or "review only".
   - **Source**: at least one link, either to the external guide section it comes from or to the ADR it derives from.
5. **Base references.** Google TypeScript Style Guide (format and TypeScript), goldbergyoni/nodebestpractices (Node runtime), goldbergyoni/javascript-testing-best-practices and the Node.js integration-tests best practices (testing), and this repo's ADRs (event sourcing). Where we deliberately deviate from a source, the file says so and why.
6. **Enforcement order: tooling > tests > review.** A rule marked "review only" is a candidate for automation. The milestone retro reviews that list and promotes rules to Biome, TypeScript or test checks where possible.
7. **Formatting is not a standard.** Biome's formatter decides formatting. Standards cover what a formatter cannot.
8. **Changing a rule** takes a Linear issue and a PR with owner review. If the change contradicts an ADR, a new ADR supersedes the old one first.

## Alternatives considered

- **Adopt an external style guide wholesale (e.g. Google gts)** — it brings ESLint and Prettier assumptions that conflict with Biome, and has no rules for our domain (event sourcing).
- **Rules only in `AGENTS.md`** — it would grow too long for agents to use reliably. Rationale and examples don't belong there.
- **No sources** — rules without a traceable reason are hard to review and easy to drift from.

## Consequences

- Agents cite rule IDs in plans and PRs when relevant, and reviewers cite them in findings.
- CodeRabbit and Codex are pointed to `docs/code-standards/` as review guidance.
- The first version is written in TRK-16, split into reviewable PRs. Protection of `docs/code-standards/` (CODEOWNERS, CI guard, agent tool denylist) is switched on once that first version is merged; until then the agent may write there under normal review.
