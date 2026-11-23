import { CustomEventTrackedV1 } from "@tracking/event-schemas";
import { describe, expect, it } from "vitest";
import { applyPropertyPolicy, DEFAULT_PROPERTY_POLICY } from "./property-policy.js";

type Properties = Record<string, string | number | boolean | null>;

function makeEvent(properties?: Properties): CustomEventTrackedV1 {
  return CustomEventTrackedV1.parse({
    event_id: "0192f5a0-7c3e-7b1a-9d4e-000000000014",
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
    payload:
      properties === undefined
        ? { name: "signup_clicked" }
        : { name: "signup_clicked", properties },
  });
}

describe("applyPropertyPolicy", () => {
  it("keeps allowed keys with string, number, boolean and null values unchanged", () => {
    const event = makeEvent({ category: "pricing", step: 3, component: null, variant: "b" });

    const result = applyPropertyPolicy(event);

    expect(result.event).toEqual(event);
    expect(result.redacted).toEqual([]);
  });

  it("drops keys that are not on the allowlist with reason key_not_allowed", () => {
    const event = makeEvent({ category: "pricing", email: "x", comment: "great product" });

    const result = applyPropertyPolicy(event);

    expect(result.event.payload.properties).toEqual({ category: "pricing" });
    expect(result.redacted).toEqual([
      { key: "comment", reason: "key_not_allowed" },
      { key: "email", reason: "key_not_allowed" },
    ]);
  });

  it("drops an email-like value on an allowed key with reason value_looks_personal", () => {
    const result = applyPropertyPolicy(makeEvent({ category: "jane.doe@example.com" }));

    expect(result.event.payload.properties).toBeUndefined();
    expect(result.redacted).toEqual([{ key: "category", reason: "value_looks_personal" }]);
  });

  it("drops a phone-like value on an allowed key with reason value_looks_personal", () => {
    const result = applyPropertyPolicy(makeEvent({ plan: "+49 (151) 234-56789" }));

    expect(result.redacted).toEqual([{ key: "plan", reason: "value_looks_personal" }]);
  });

  it("keeps short numeric strings such as 'step 3' and '2026'", () => {
    const event = makeEvent({ category: "step 3", variant: "2026" });

    const result = applyPropertyPolicy(event);

    expect(result.event).toEqual(event);
    expect(result.redacted).toEqual([]);
  });

  it("drops a string longer than maxStringLength with reason value_too_long", () => {
    const result = applyPropertyPolicy(
      makeEvent({ category: "a".repeat(201), variant: "a".repeat(200) }),
    );

    expect(result.event.payload.properties).toEqual({ variant: "a".repeat(200) });
    expect(result.redacted).toEqual([{ key: "category", reason: "value_too_long" }]);
  });

  it("drops admitted keys beyond maxProperties in sorted key order", () => {
    const keys = Array.from({ length: 21 }, (_, i) => `k${String(i).padStart(2, "0")}`);
    const policy = { ...DEFAULT_PROPERTY_POLICY, allowedKeys: new Set(keys) };
    const properties = Object.fromEntries(keys.map((key) => [key, 1]));

    const result = applyPropertyPolicy(makeEvent(properties), policy);

    expect(Object.keys(result.event.payload.properties ?? {})).toHaveLength(20);
    expect(result.redacted).toEqual([{ key: "k20", reason: "too_many_properties" }]);
  });

  it("omits properties and still satisfies the v1 schema when every key is dropped", () => {
    const result = applyPropertyPolicy(makeEvent({ email: "jane@example.com" }));

    expect("properties" in result.event.payload).toBe(false);
    expect(CustomEventTrackedV1.parse(result.event)).toEqual(result.event);
  });

  it("returns the event untouched when it has no properties", () => {
    const event = makeEvent();

    const result = applyPropertyPolicy(event);

    expect(result).toEqual({ event, redacted: [] });
  });

  it("does not mutate the input event", () => {
    const event = makeEvent({ category: "pricing", email: "jane@example.com" });
    const before = structuredClone(event);

    applyPropertyPolicy(event);

    expect(event).toEqual(before);
  });

  it("reports key names and reasons only, never values", () => {
    const result = applyPropertyPolicy(
      makeEvent({ category: "jane.doe@example.com", note: "secret" }),
    );

    expect(JSON.stringify(result.redacted)).not.toMatch(/jane|secret/);
  });
});
