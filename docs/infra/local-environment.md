# Local environment

How to run the local infrastructure and the apps. Runtime scope: [ADR-0010](../adr/0010-gcp-target-local-m0.md).

## Prerequisites

- Docker with Compose v2.
- Node 24 and pnpm (`pnpm install`).

## First run

```
cp infra/env.example .env   # optional: every variable has a default
pnpm dev
```

The template lives in `infra/` and has no leading dot, so agent deny rules for `.env.*` do not hide it. The copy stays at the repo root `.env`, which Compose and the apps read.

`pnpm dev` runs `pnpm infra:up` (waits until all healthchecks pass), then starts the apps in watch mode.

## Services

| Service | Image | Host bind (`127.0.0.1:<port>`) | URL / connection string |
| --- | --- | --- | --- |
| `postgres` (event store) | `postgres:16` | `POSTGRES_PORT` (5432) | `postgres://tracking:tracking@localhost:5432/tracking` |
| `mongo` (projections) | `mongo:7` | `MONGO_PORT` (27017) | `mongodb://localhost:27017/tracking` |
| `metabase` | `metabase/metabase:v0.58.42` | `METABASE_PORT` (3030) | <http://localhost:3030> |
| `metabase-db` | `postgres:16` | none | internal, `metabase-db:5432` |
| `n8n` | `n8nio/n8n:2.48.7` | `N8N_PORT` (5678) | <http://localhost:5678> |

Notes:

- Metabase stores its own data in `metabase-db`, never in the event store.
- Mongo runs without auth. This is for local use only.
- All published ports bind to `127.0.0.1`, so the services are reachable only from the host itself, not from the LAN.
  Containers still reach each other over the compose network (for example `postgres:5432`).
- To expose a port deliberately (for example to another machine), use a local, uncommitted `compose.override.yml`
  or an SSH tunnel. Mongo has no auth and Postgres uses a default password, so do this only on a trusted network.
- The bind is IPv4 only. If a tool resolves `localhost` to `::1` first and the connection is refused, use `127.0.0.1`
  in its connection string.
- Metabase uses host port 3030 so that 3000 stays free for the apps.
- Metabase takes up to about two minutes to become healthy on first start.
- Images for `postgres` and `mongo` follow the major version. Metabase and n8n are pinned to an exact version.
  Upgrades are explicit PRs: Metabase migrates its app DB and cannot be downgraded, and n8n major versions can break nodes and credentials.

## Commands

```
pnpm infra:up      # start the stack and wait until healthy
pnpm infra:down    # stop the stack, keep volumes
docker compose --project-directory . -f infra/docker-compose.yml ps
docker compose --project-directory . -f infra/docker-compose.yml logs -f <service>
```

The scripts pass `--project-directory .` so Compose reads the root `.env`. Without it, Compose looks in
`infra/` because the compose file lives there. When there is no `.env`, the `${VAR:-default}` fallbacks apply.

## Reset volumes

All data (event store, projections, Metabase, n8n):

```
docker compose --project-directory . -f infra/docker-compose.yml down -v
```

One volume (stop the stack first):

```
docker volume rm agentic-tracking_<name>   # postgres-data, mongo-data, metabase-db-data, n8n-data
```

Projections are rebuildable from the event store. Resetting `postgres-data` deletes the events.

## Use the event store in Metabase

In Metabase, add a PostgreSQL database with host `postgres` (the compose service name), port `5432`,
and the `POSTGRES_*` credentials. Use a read-only user for anything beyond local exploration.
