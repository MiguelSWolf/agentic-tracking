import type { AnyEventV1 } from "@tracking/event-schemas";
import { PageViewedV1 } from "@tracking/event-schemas";
import { describe, expect, it } from "vitest";
import type { EventStore } from "../port.js";

function makeEvent(eventId: string, title: string): AnyEventV1 {
  return PageViewedV1.parse({
    event_id: eventId,
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
}

/**
 * Behaviour every `EventStore` must have. Run it against the in-memory fake and,
 * later, against the Postgres adapter. `create` must return a store that is empty
 * for this test (TEST-12).
 */
export function runEventStoreContract(create: () => EventStore | Promise<EventStore>): void {
  describe("EventStore contract › append", () => {
    it("new event_id › returns appended with a position greater than the previous one", async () => {
      const store = await create();

      const first = await store.append(makeEvent("0192f5a0-7c3e-7b1a-9d4e-000000000101", "A"));
      const second = await store.append(makeEvent("0192f5a0-7c3e-7b1a-9d4e-000000000102", "B"));

      expect(first.status).toBe("appended");
      expect(second.status).toBe("appended");
      if (first.status === "appended" && second.status === "appended") {
        expect(second.position > first.position).toBe(true);
      }
    });

    it("same event_id appended twice › returns duplicate for the second call", async () => {
      const store = await create();
      const id = "0192f5a0-7c3e-7b1a-9d4e-000000000103";

      const first = await store.append(makeEvent(id, "First"));
      const second = await store.append(makeEvent(id, "Second"));

      expect(first.status).toBe("appended");
      expect(second).toEqual({ status: "duplicate" });
    });

    it("duplicate followed by a new event › the new event still gets appended", async () => {
      const store = await create();
      const id = "0192f5a0-7c3e-7b1a-9d4e-000000000104";
      await store.append(makeEvent(id, "First"));
      await store.append(makeEvent(id, "Again"));

      const next = await store.append(makeEvent("0192f5a0-7c3e-7b1a-9d4e-000000000105", "Next"));

      expect(next.status).toBe("appended");
    });
  });
}
