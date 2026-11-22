# Specs

Living specs describe what the system does now, one file per **capability**
(for example `event-envelope.md`), not per issue. Policy: [ADR-0012](../adr/0012-living-specs-and-docs.md).

## Convention

- One file per capability, named in kebab-case.
- A PR that changes behaviour updates the matching spec in the same PR, or creates it.
  If it adds no spec change, the PR says "Docs: none, because …".
- The plan (see the `issue-flow` skill) names the spec it will change, or says "none".
- Specs state current behaviour. History stays in Linear and git.
- Link to ADRs and schemas instead of restating them.

## Suggested skeleton

```markdown
# <Capability>

## Purpose
## Behaviour
## Related ADRs and schemas
```

Specs for already-existing code are written when that code is next changed.
