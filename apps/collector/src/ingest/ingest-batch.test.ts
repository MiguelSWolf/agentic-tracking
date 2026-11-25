import { createInMemoryEventStore } from "@tracking/event-store/testing";
import { describe, expect, it } from "vitest";
import { ingestBatch, MAX_BATCH_SIZE } from "./ingest-batch.js";

const NOW = new Date("2026-11-24T10:00:00.000Z");

const BASE = {
  version: 1,
  occurred_at: "2026-11-20T09:15:00.000Z",
  attribution_key: "ak_01JD3K8Q2V",
  session_id: "sess_8f3a21c9",
  seq: 4,
  app_id: "demo-shop",
  source: "client",
  trust: "unverified",
  context: { url: "https://shop.example/pricing" },
};

function pageViewed(n: number, overrides: Record<string, unknown> = {}) {
  return {
    ...BASE,
    event_id: `0192f5a0-7c3e-7b1a-9d4e-${String(n).padStart(12, "0")}`,
    type: "PageViewed",
    payload: { title: "Pricing | Example Shop" },
    ...overrides,
  };
}

function setup() {
  const store = createInMemoryEventStore();
  const deps = { store, clock: () => NOW };
  return { store, deps };
}

describe("ingestBatch", () => {
  it("valid event of each type › accepts and appends all six", async () => {
    const { store, deps } = setup();
    const events = [
      {
        ...BASE,
        event_id: "0192f5a0-7c3e-7b1a-9d4e-000000000001",
        type: "SessionStarted",
        payload: {},
      },
      pageViewed(2),
      {
        ...BASE,
        event_id: "0192f5a0-7c3e-7b1a-9d4e-000000000003",
        type: "ElementClicked",
        payload: { selector: "#signup" },
      },
      {
        ...BASE,
        event_id: "0192f5a0-7c3e-7b1a-9d4e-000000000004",
        type: "CustomEventTracked",
        payload: { name: "video_played" },
      },
      {
        ...BASE,
        event_id: "0192f5a0-7c3e-7b1a-9d4e-000000000005",
        type: "Identified",
        user_id: "usr_5b7e90",
        payload: {},
      },
      {
        ...BASE,
        event_id: "0192f5a0-7c3e-7b1a-9d4e-000000000006",
        type: "ConversionRecorded",
        payload: { conversion_id: "order_10482" },
      },
    ];

    const result = await ingestBatch({ body: { events }, clientIp: undefined }, deps);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const rejected = result.results.filter((r) => r.status === "rejected");
      expect(rejected).toEqual([]);
    }
    expect(store.events().map((s) => s.event.type)).toEqual([
      "SessionStarted",
      "PageViewed",
      "ElementClicked",
      "CustomEventTracked",
      "Identified",
      "ConversionRecorded",
    ]);
  });

  it("unknown type or version › rejects that event with path and code only", async () => {
    const { store, deps } = setup();
    const body = {
      events: [pageViewed(1, { type: "Teleported" }), pageViewed(2, { version: 99 })],
    };

    const result = await ingestBatch({ body, clientIp: undefined }, deps);

    expect(result).toMatchObject({
      ok: true,
      results: [
        { index: 0, status: "rejected", reason: "invalid_event", issues: [{ path: "type" }] },
        { index: 1, status: "rejected", reason: "invalid_event", issues: [{ path: "version" }] },
      ],
    });
    expect(store.events()).toHaveLength(0);
  });

  it("rejected event › issues do not echo input values", async () => {
    const { deps } = setup();
    const body = {
      events: [pageViewed(1, { payload: { title: "ok", email: "jane.doe@example.com" } })],
    };

    const result = await ingestBatch({ body, clientIp: undefined }, deps);

    expect(JSON.stringify(result)).not.toContain("jane.doe");
  });

  it("CustomEventTracked with disallowed, email-like properties and a personal name › redacts and counts", async () => {
    const { store, deps } = setup();
    const event = {
      ...BASE,
      event_id: "0192f5a0-7c3e-7b1a-9d4e-000000000010",
      type: "CustomEventTracked",
      payload: {
        name: "order_4915123456789",
        properties: { category: "pricing", email: "x", step: "jane.doe@example.com" },
      },
    };

    const result = await ingestBatch({ body: { events: [event] }, clientIp: undefined }, deps);

    const stored = store.events()[0]?.event;
    expect(stored?.type === "CustomEventTracked" && stored.payload).toEqual({
      name: "redacted_name",
      properties: { category: "pricing" },
    });
    expect(result.ok && result.redactions.properties).toMatchObject({
      key_not_allowed: 1,
      value_looks_personal: 1,
    });
    expect(result.ok && result.redactions.eventName.name_looks_personal).toBe(1);
  });

  it("PageViewed with extra payload keys › rejected by the schema, nothing stored", async () => {
    const { store, deps } = setup();
    const body = { events: [pageViewed(1, { payload: { title: "ok", properties: { a: 1 } } })] };

    const result = await ingestBatch({ body, clientIp: undefined }, deps);

    expect(result.ok && result.results[0]?.status).toBe("rejected");
    expect(store.events()).toHaveLength(0);
  });

  it("any event type with personal data in context.url › url is redacted before append", async () => {
    const { store, deps } = setup();
    const body = {
      events: [
        pageViewed(1, {
          context: {
            url: "https://shop.example/pricing?email=jane@example.com&utm_source=news#frag",
          },
        }),
      ],
    };

    const result = await ingestBatch({ body, clientIp: undefined }, deps);

    expect(store.events()[0]?.event.context.url).toBe(
      "https://shop.example/pricing?utm_source=news",
    );
    expect(result.ok && result.redactions.url.query_param_dropped).toBe(1);
    expect(result.ok && result.redactions.url.fragment_dropped).toBe(1);
  });

  it("same event_id twice in one batch › second is duplicate and the store holds one event", async () => {
    const { store, deps } = setup();

    const result = await ingestBatch(
      { body: { events: [pageViewed(1), pageViewed(1)] }, clientIp: undefined },
      deps,
    );

    expect(result.ok && result.results).toEqual([
      { index: 0, status: "accepted" },
      { index: 1, status: "duplicate" },
    ]);
    expect(store.events()).toHaveLength(1);
  });

  it("event_id already in the store › duplicate, not rejected", async () => {
    const { deps } = setup();
    await ingestBatch({ body: { events: [pageViewed(1)] }, clientIp: undefined }, deps);

    const again = await ingestBatch(
      { body: { events: [pageViewed(1)] }, clientIp: undefined },
      deps,
    );

    expect(again.ok && again.results).toEqual([{ index: 0, status: "duplicate" }]);
  });

  it("client IP 203.0.113.77 › stored ip_trunc is 203.0.113.0", async () => {
    const { store, deps } = setup();

    await ingestBatch({ body: { events: [pageViewed(1)] }, clientIp: "203.0.113.77" }, deps);

    expect(store.events()[0]?.event.context.ip_trunc).toBe("203.0.113.0");
  });

  it("client-supplied full IP in ip_trunc › overwritten by the server value", async () => {
    const { store, deps } = setup();
    const event = pageViewed(1, { context: { ...BASE.context, ip_trunc: "198.51.100.23" } });

    await ingestBatch({ body: { events: [event] }, clientIp: "203.0.113.77" }, deps);

    expect(store.events()[0]?.event.context.ip_trunc).toBe("203.0.113.0");
  });

  it("no usable client IP › client-supplied ip_trunc is removed", async () => {
    const { store, deps } = setup();
    const event = pageViewed(1, { context: { ...BASE.context, ip_trunc: "198.51.100.23" } });

    await ingestBatch({ body: { events: [event] }, clientIp: undefined }, deps);

    expect(store.events()[0]?.event.context.ip_trunc).toBeUndefined();
  });

  it("received_at › set from the injected clock, client value overwritten", async () => {
    const { store, deps } = setup();
    const event = pageViewed(1, { received_at: "2020-01-01T00:00:00.000Z" });

    await ingestBatch({ body: { events: [event] }, clientIp: undefined }, deps);

    expect(store.events()[0]?.event.received_at).toBe("2026-11-24T10:00:00.000Z");
  });

  it("batch of valid, invalid, valid › first and third accepted, second rejected, input order kept", async () => {
    const { store, deps } = setup();
    const body = { events: [pageViewed(1), pageViewed(2, { seq: -1 }), pageViewed(3)] };

    const result = await ingestBatch({ body, clientIp: undefined }, deps);

    expect(result.ok && result.results.map((r) => [r.index, r.status])).toEqual([
      [0, "accepted"],
      [1, "rejected"],
      [2, "accepted"],
    ]);
    expect(store.events()).toHaveLength(2);
  });

  it("event that is not an object › rejected, rest of the batch continues", async () => {
    const { store, deps } = setup();

    const result = await ingestBatch(
      { body: { events: ["nope", null, pageViewed(1)] }, clientIp: undefined },
      deps,
    );

    expect(result.ok && result.results.map((r) => r.status)).toEqual([
      "rejected",
      "rejected",
      "accepted",
    ]);
    expect(store.events()).toHaveLength(1);
  });

  it.each([
    ["not an object", "x"],
    ["no events key", {}],
    ["events not an array", { events: "x" }],
    ["empty batch", { events: [] }],
    [
      "over the limit",
      { events: Array.from({ length: MAX_BATCH_SIZE + 1 }, (_, i) => pageViewed(i)) },
    ],
  ])("body %s › whole batch rejected, nothing stored", async (_label, body) => {
    const { store, deps } = setup();

    const result = await ingestBatch({ body, clientIp: undefined }, deps);

    expect(result).toEqual({ ok: false, reason: "invalid_batch" });
    expect(store.events()).toHaveLength(0);
  });

  it("batch of exactly the limit › accepted", async () => {
    const { store, deps } = setup();
    const events = Array.from({ length: MAX_BATCH_SIZE }, (_, i) => pageViewed(i + 1));

    await ingestBatch({ body: { events }, clientIp: undefined }, deps);

    expect(store.events()).toHaveLength(MAX_BATCH_SIZE);
  });

  it("store append throws › error propagates", async () => {
    const failing = { append: () => Promise.reject(new Error("connection lost")) };

    await expect(
      ingestBatch(
        { body: { events: [pageViewed(1)] }, clientIp: undefined },
        { store: failing, clock: () => NOW },
      ),
    ).rejects.toThrow("connection lost");
  });
});
