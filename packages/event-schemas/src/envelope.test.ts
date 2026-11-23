import { describe, expect, it } from "vitest";
import { EnvelopeV1 } from "./envelope.js";
import { PageViewedV1 } from "./events/page-viewed.js";

const valid = {
  event_id: "0192f5a0-7c3e-7b1a-9d4e-000000000001",
  type: "PageViewed",
  version: 1,
  occurred_at: "2026-11-20T09:15:00.000Z",
  attribution_key: "ak_01JD3K8Q2V",
  session_id: "sess_8f3a21c9",
  seq: 0,
  app_id: "demo-shop",
  source: "client",
  trust: "unverified",
  context: { url: "https://shop.example/pricing" },
  payload: {},
};

function pathOf(input: unknown): unknown {
  const result = EnvelopeV1.safeParse(input);
  return result.success ? null : result.error.issues[0]?.path;
}

describe("EnvelopeV1", () => {
  it("with a minimal valid envelope, parses", () => {
    const result = EnvelopeV1.safeParse(valid);

    expect(result.success).toBe(true);
  });

  it("with all optional fields present, parses", () => {
    const input = {
      ...valid,
      received_at: "2026-11-20T09:15:01+01:00",
      user_id: "usr_5b7e90",
      context: {
        url: "https://shop.example/pricing?utm_source=newsletter",
        referrer: "https://www.google.com/",
        utm_source: "newsletter",
        click_ids: { gclid: "Cj0KCQiA3rKQ" },
        ua: "Mozilla/5.0",
        ip_trunc: "203.0.113.0",
      },
    };

    const result = EnvelopeV1.safeParse(input);

    expect(result.success).toBe(true);
  });

  it.each([
    ["a v4 event_id", { event_id: "3b241101-e2bb-4255-8caf-4136c566a962" }, ["event_id"]],
    ["a negative seq", { seq: -1 }, ["seq"]],
    ["a fractional seq", { seq: 1.5 }, ["seq"]],
    ["an unknown source", { source: "edge" }, ["source"]],
    ["an unknown trust", { trust: "trusted" }, ["trust"]],
    ["a missing context url", { context: {} }, ["context", "url"]],
    ["a non-ISO occurred_at", { occurred_at: "yesterday" }, ["occurred_at"]],
    ["an unknown top-level key", { extra: 1 }, []],
    [
      "an unknown context key",
      { context: { url: "https://shop.example/", extra: 1 } },
      ["context"],
    ],
  ])("with %s, fails at the expected path", (_label, override, expected) => {
    const input = { ...valid, ...override };

    expect(pathOf(input)).toEqual(expected);
  });

  it.each([
    ["client", "unverified", true],
    ["client", "signed", false],
    ["server", "unverified", true],
    ["server", "signed", true],
  ])("with source %s and trust %s, success is %s", (source, trust, expected) => {
    const input = { ...valid, source, trust };

    expect(EnvelopeV1.safeParse(input).success).toBe(expected);
    expect(PageViewedV1.safeParse(input).success).toBe(expected);
  });

  it("with source client and trust signed, reports the issue at trust", () => {
    const input = { ...valid, trust: "signed" };

    expect(pathOf(input)).toEqual(["trust"]);
  });
});
