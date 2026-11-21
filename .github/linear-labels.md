# Linear setup (team TRK)

## Workflow states
Triage (enable Triage in team settings) → Backlog → Todo → In Progress → In Review → Done / Canceled

## Labels (create exactly these names — scripts match on them)

| Label | Who sets it | Meaning |
|---|---|---|
| `agent:ready` | Owner only | G0 passed: issue may be planned by the agent |
| `plan:approved` | Owner only | G1 passed: `agent-implement phase=implement` is allowed |
| `source:audit` | Script | Created from a Codex milestone audit (G4) |
| `type:feat` / `type:chore` / `type:test` / `type:docs` | Owner | Kind of change |
| `area:sdk` / `area:collector` / `area:store` / `area:projector` / `area:infra` / `area:agents` | Owner | Part of the system |
| `size:S` / `size:M` | Owner | S < 100 lines, M 100–400. L is not allowed: split it |

## Milestones (project "Tracking v1")
M0 Foundation and agentic loop · M1 Ingestion and remote · M2 Projections and replay · M3 Reports · M4 n8n integration · M5 Kafka and hardening

## Integrations
- GitHub integration on (PR `Fixes TRK-n` moves the issue automatically)
- Codex for Linear (audits: mention `@Codex` on the "Audit Mx" issue)
- Personal API key → GitHub secret `LINEAR_API_KEY`
