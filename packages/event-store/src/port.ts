import type { AnyEventV1 } from "@tracking/event-schemas";

/**
 * A duplicate `event_id` is a normal result, not an error (ADR-0004, ADR-0014).
 * `position` is an ordering key only: gaps are allowed and it must not be treated as a count.
 */
export type AppendResult =
  | { readonly status: "appended"; readonly position: bigint }
  | { readonly status: "duplicate" };

export interface EventStore {
  /**
   * Appends one event. `event_id` is the idempotency key (ES-04): the first write wins,
   * a second write with the same `event_id` returns `duplicate` and changes nothing.
   * Rejects only for operational failures (for example a lost connection).
   */
  append(event: AnyEventV1): Promise<AppendResult>;
}
