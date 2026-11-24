import { CustomEventTrackedV1 } from "@tracking/event-schemas";
import { describe, expect, it } from "vitest";
import { applyEventNamePolicy, REDACTED_EVENT_NAME } from "./event-name-policy.js";

const NONE = { name_invalid: 0, name_looks_personal: 0 };

function makeEvent(name: string): CustomEventTrackedV1 {
  return CustomEventTrackedV1.parse({
    event_id: "0192f5a0-7c3e-7b1a-9d4e-000000000031",
    type: "CustomEventTracked",
    version: 1,
    occurred_at: "2026-11-20T09:15:00.000Z",
    attribution_key: "ak_01JD3K8Q2V",
    session_id: "sess_8f3a21c9",
    seq: 4,
    app_id: "demo-shop",
    source: "client",
    trust: "unverified",
    context: { url: "https://shop.example/pricing" },
    payload: { name },
  });
}

describe("applyEventNamePolicy", () => {
  it("keeps valid names such as signup_clicked and checkout:step-2", () => {
    for (const name of ["signup_clicked", "checkout:step-2"]) {
      const event = makeEvent(name);

      const result = applyEventNamePolicy(event);

      expect(result.event).toBe(event);
      expect(result.redacted).toEqual(NONE);
    }
  });

  it("replaces a name with spaces or @ with redacted_name, reason name_invalid", () => {
    for (const name of ["contact jane@example.com", "has space"]) {
      const result = applyEventNamePolicy(makeEvent(name));

      expect(result.event.payload.name).toBe(REDACTED_EVENT_NAME);
      expect(result.redacted).toEqual({ ...NONE, name_invalid: 1 });
    }
  });

  it("replaces a name longer than 64 characters, reason name_invalid", () => {
    const kept = applyEventNamePolicy(makeEvent(`a${"b".repeat(63)}`));
    const replaced = applyEventNamePolicy(makeEvent(`a${"b".repeat(64)}`));

    expect(kept.event.payload.name).toHaveLength(64);
    expect(replaced.event.payload.name).toBe(REDACTED_EVENT_NAME);
    expect(replaced.redacted).toEqual({ ...NONE, name_invalid: 1 });
  });

  it("replaces a name with a 9+ digit run, reason name_looks_personal", () => {
    const result = applyEventNamePolicy(makeEvent("order_4915123456789"));

    expect(result.event.payload.name).toBe(REDACTED_EVENT_NAME);
    expect(result.redacted).toEqual({ ...NONE, name_looks_personal: 1 });
  });

  it("returns an event that still satisfies CustomEventTrackedV1 and does not mutate the input", () => {
    const event = makeEvent("contact jane@example.com");
    const snapshot = structuredClone(event);

    const result = applyEventNamePolicy(event);

    expect(CustomEventTrackedV1.safeParse(result.event).success).toBe(true);
    expect(event).toEqual(snapshot);
    expect(JSON.stringify(result.redacted)).not.toContain("jane");
  });
});
