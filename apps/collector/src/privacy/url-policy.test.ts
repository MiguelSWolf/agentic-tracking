import { ConversionRecordedV1, PageViewedV1 } from "@tracking/event-schemas";
import { describe, expect, it } from "vitest";
import { applyUrlPolicy } from "./url-policy.js";

const NONE = {
  fragment_dropped: 0,
  credentials_dropped: 0,
  query_param_dropped: 0,
  query_value_looks_personal: 0,
  path_segment_redacted: 0,
  url_unparseable: 0,
};

const BASE = {
  event_id: "0192f5a0-7c3e-7b1a-9d4e-000000000021",
  occurred_at: "2026-11-20T09:15:00.000Z",
  attribution_key: "ak_01JD3K8Q2V",
  session_id: "sess_8f3a21c9",
  seq: 2,
  app_id: "demo-shop",
  trust: "unverified",
} as const;

function pageViewed(url: string): PageViewedV1 {
  return PageViewedV1.parse({
    ...BASE,
    type: "PageViewed",
    version: 1,
    source: "client",
    context: { url },
    payload: { title: "Pricing" },
  });
}

describe("applyUrlPolicy", () => {
  it("keeps utm_* and click-ID parameters in their original order", () => {
    const event = pageViewed(
      "https://shop.example/pricing?utm_source=news&gclid=abc123&utm_medium=email",
    );

    const result = applyUrlPolicy(event);

    expect(result.event.context.url).toBe(
      "https://shop.example/pricing?utm_source=news&gclid=abc123&utm_medium=email",
    );
    expect(result.redacted).toEqual(NONE);
  });

  it("drops unknown query parameters with reason query_param_dropped", () => {
    const event = pageViewed("https://shop.example/p?email=jane@example.com&ref=abc&utm_source=x");

    const result = applyUrlPolicy(event);

    expect(result.event.context.url).toBe("https://shop.example/p?utm_source=x");
    expect(result.redacted).toEqual({ ...NONE, query_param_dropped: 2 });
  });

  it("drops the fragment with reason fragment_dropped", () => {
    const event = pageViewed("https://shop.example/p#token=secret");

    const result = applyUrlPolicy(event);

    expect(result.event.context.url).toBe("https://shop.example/p");
    expect(result.redacted).toEqual({ ...NONE, fragment_dropped: 1 });
  });

  it("drops user and password with reason credentials_dropped", () => {
    const event = pageViewed("https://jane:pw@shop.example/p");

    const result = applyUrlPolicy(event);

    expect(result.event.context.url).toBe("https://shop.example/p");
    expect(result.redacted).toEqual({ ...NONE, credentials_dropped: 1 });
  });

  it("drops an allowed parameter whose decoded value looks personal", () => {
    const event = pageViewed("https://shop.example/p?utm_term=jane%40example.com&utm_source=x");

    const result = applyUrlPolicy(event);

    expect(result.event.context.url).toBe("https://shop.example/p?utm_source=x");
    expect(result.redacted).toEqual({ ...NONE, query_value_looks_personal: 1 });
  });

  it("replaces a personal-looking path segment with redacted, also when encoded", () => {
    const event = pageViewed("https://shop.example/users/jane%40example.com/orders");

    const result = applyUrlPolicy(event);

    expect(result.event.context.url).toBe("https://shop.example/users/redacted/orders");
    expect(result.redacted).toEqual({ ...NONE, path_segment_redacted: 1 });
  });

  it("removes the trailing ? when no parameter is left", () => {
    const event = pageViewed("https://shop.example/p?ref=abc");

    const result = applyUrlPolicy(event);

    expect(result.event.context.url).toBe("https://shop.example/p");
  });

  it("returns the event unchanged with zero counts for a clean URL", () => {
    const event = pageViewed("https://shop.example/pricing");

    const result = applyUrlPolicy(event);

    expect(result.event).toBe(event);
    expect(result.redacted).toEqual(NONE);
  });

  it("works on every event type and the result still parses with its v1 schema", () => {
    const conversion = ConversionRecordedV1.parse({
      ...BASE,
      type: "ConversionRecorded",
      version: 1,
      source: "client",
      context: { url: "https://u:p@shop.example/done?email=a@b.co#x" },
      payload: { conversion_id: "cv_1" },
    });

    const fromConversion = applyUrlPolicy(conversion);
    const fromPage = applyUrlPolicy(pageViewed("https://shop.example/p?a=1#x"));

    expect(ConversionRecordedV1.safeParse(fromConversion.event).success).toBe(true);
    expect(PageViewedV1.safeParse(fromPage.event).success).toBe(true);
    expect(fromConversion.event.context.url).toBe("https://shop.example/done");
  });

  it("does not mutate the input event", () => {
    const event = pageViewed("https://shop.example/p?email=a@b.co#x");
    const snapshot = structuredClone(event);

    applyUrlPolicy(event);

    expect(event).toEqual(snapshot);
  });

  it("reports counts only, with no parameter names or values", () => {
    const event = pageViewed("https://shop.example/p?secretname=jane@example.com");

    const result = applyUrlPolicy(event);

    const text = JSON.stringify(result.redacted);
    expect(text).not.toContain("secretname");
    expect(text).not.toContain("jane");
  });

  it("replaces an unparseable URL with about:blank and counts url_unparseable", () => {
    const event = pageViewed("https://shop.example/p");
    const broken = { ...event, context: { ...event.context, url: "not a url" } };

    const result = applyUrlPolicy(broken);

    expect(result.event.context.url).toBe("about:blank");
    expect(result.redacted).toEqual({ ...NONE, url_unparseable: 1 });
  });
});
