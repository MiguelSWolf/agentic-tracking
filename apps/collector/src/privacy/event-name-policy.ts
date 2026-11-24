import type { CustomEventTrackedV1 } from "@tracking/event-schemas";
import { looksPersonal } from "./detectors.js";

export type EventNameRedactionReason = "name_invalid" | "name_looks_personal";

/** Number of redactions per reason. Fixed labels and integers only. */
export type EventNameRedactionCounts = Readonly<Record<EventNameRedactionReason, number>>;

export type EventNamePolicyResult = {
  readonly event: CustomEventTrackedV1;
  /** Counts per fixed reason. Never contains the name (NODE-13). */
  readonly redacted: EventNameRedactionCounts;
};

export const REDACTED_EVENT_NAME = "redacted_name";

const VALID_EVENT_NAME = /^[A-Za-z][A-Za-z0-9_.:-]{0,63}$/;

/**
 * Keeps `payload.name` only if it is an identifier-like name (max 64 characters) that does
 * not look personal; otherwise replaces it with `redacted_name`. The schema is unchanged.
 * Pure: never throws, never mutates the input (ES-12, TS-11).
 */
export function applyEventNamePolicy(event: CustomEventTrackedV1): EventNamePolicyResult {
  const { name } = event.payload;
  let reason: EventNameRedactionReason | undefined;
  if (!VALID_EVENT_NAME.test(name)) {
    reason = "name_invalid";
  } else if (looksPersonal(name)) {
    reason = "name_looks_personal";
  }

  if (reason === undefined) {
    return { event, redacted: { name_invalid: 0, name_looks_personal: 0 } };
  }
  return {
    event: { ...event, payload: { ...event.payload, name: REDACTED_EVENT_NAME } },
    redacted: {
      name_invalid: reason === "name_invalid" ? 1 : 0,
      name_looks_personal: reason === "name_looks_personal" ? 1 : 0,
    },
  };
}
