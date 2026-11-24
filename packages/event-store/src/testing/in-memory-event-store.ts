import type { AnyEventV1 } from "@tracking/event-schemas";
import type { AppendResult, EventStore } from "../port.js";

export type StoredEvent = {
  readonly position: bigint;
  readonly event: AnyEventV1;
};

export type InMemoryEventStore = EventStore & {
  /** Events in position order. */
  readonly events: () => readonly StoredEvent[];
};

/** Fake for tests. First write wins by `event_id`; positions only increase. */
export function createInMemoryEventStore(): InMemoryEventStore {
  const byId = new Map<string, StoredEvent>();
  let nextPosition = 1n;

  return {
    append(event: AnyEventV1): Promise<AppendResult> {
      if (byId.has(event.event_id)) {
        return Promise.resolve({ status: "duplicate" });
      }
      const position = nextPosition;
      nextPosition += 1n;
      byId.set(event.event_id, { position, event });
      return Promise.resolve({ status: "appended", position });
    },
    events: () => [...byId.values()],
  };
}
