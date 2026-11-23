# F-012: Recommended Biome rules report at `warn`/`info` and never fail CI

- Status: fixed (TRK-21)
- Area: Code standards
- Source: agent
- Found: 2026-11-22
- Evidence: TRK-18 plan

## What happened

"Enforced by: Biome" rules only warn, because `biome check` runs without `--error-on-warnings`.

## Proposed fix

TRK-21.

## Decision

Fixed in TRK-21: every `lint` script runs `biome check --error-on-warnings`, and
`useNodejsImportProtocol` (info by default, which the flag ignores) is raised to `error` in `biome.json`.
