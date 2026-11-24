import { describe, expect, it } from "vitest";
import { runEventStoreContract } from "./event-store-contract.js";
import { createInMemoryEventStore } from "./in-memory-event-store.js";

runEventStoreContract(() => createInMemoryEventStore());

describe("createInMemoryEventStore", () => {
  it("same event_id appended twice › keeps the first event only", async () => {
    const store = createInMemoryEventStore();
    const { event } = await seed(store, "First");

    await seed(store, "Second");

    const stored = store.events();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.event).toEqual(event);
  });
});

async function seed(store: ReturnType<typeof createInMemoryEventStore>, title: string) {
  const { PageViewedV1 } = await import("@tracking/event-schemas");
  const event = PageViewedV1.parse({
    event_id: "0192f5a0-7c3e-7b1a-9d4e-000000000201",
    type: "PageViewed",
    version: 1,
    occurred_at: "2026-11-20T09:15:00.000Z",
    attribution_key: "ak_01JD3K8Q2V",
    session_id: "sess_8f3a21c9",
    seq: 1,
    app_id: "demo-shop",
    source: "client",
    trust: "unverified",
    context: { url: "https://shop.example/pricing" },
    payload: { title },
  });
  await store.append(event);
  return { event };
}
