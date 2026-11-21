---
name: new-projection
description: Use when creating or changing a MongoDB projection (read model) fed from the event store.
---

# New projection

A projection is a pure fold over the event log: `(state, event) => state`. It must be rebuildable
from position 0 at any time (AGENTS.md invariant 5).

## Steps

1. `apps/projector/src/projections/<name>/`
   - `handlers.ts`: one pure handler per event type it consumes. No I/O inside handlers.
   - `store.ts`: Mongo persistence (collection `<name>_v<k>`), idempotent upserts keyed by the
     document id. Writing the same event twice must not change the result.
   - `index.ts`: registers the projection with its name, version `k` and consumed event types.
2. Checkpoint: the runner stores `{projection, version, position}` in `checkpoints`.
   Handlers never touch checkpoints.
3. Ordering: within a session, apply by `seq` (ADR-007). Across sessions, by global `position`.
4. Bounded documents: if a document can grow without limit (e.g. a long journey), use a summary
   document plus references (bucket pattern). Mongo documents have a 16 MiB cap.
5. Tests:
   - unit tests per handler (given events → expected state)
   - **replay test** (`*.int.test.ts`): feed fixtures incrementally, then rebuild from 0 into
     `<name>_v<k>_rebuild`, and assert both collections are deep-equal.

## Changing a projection's logic

Bump `k`. Rebuild into `<name>_v<k+1>` (blue/green), switch reads when it catches up, drop the old
collection later. Never mutate a live projection's semantics in place.
