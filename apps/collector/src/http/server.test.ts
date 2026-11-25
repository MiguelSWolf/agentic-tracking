import type { AddressInfo } from "node:net";
import type { AppendResult, EventStore } from "@tracking/event-store";
import { createInMemoryEventStore } from "@tracking/event-store/testing";
import { afterEach, describe, expect, it } from "vitest";
import { MAX_BATCH_SIZE } from "../ingest/ingest-batch.js";
import { createLogger } from "../logger.js";
import { createCollectorServer } from "./server.js";

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

const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  await Promise.all(closers.splice(0).map((close) => close()));
});

async function start(options: { store?: EventStore; maxBodyBytes?: number; hops?: number } = {}) {
  const lines: string[] = [];
  const memory = createInMemoryEventStore();
  const store = options.store ?? memory;
  let counter = 0;
  const server = createCollectorServer({
    config: { maxBodyBytes: options.maxBodyBytes ?? 262144, trustedProxyHops: options.hops ?? 1 },
    store,
    logger: createLogger({ level: "debug", sink: { write: (l) => lines.push(l) } }),
    newRequestId: () => {
      counter += 1;
      return `generated-id-${counter}`;
    },
    clock: () => new Date("2026-11-25T10:00:00.000Z"),
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  closers.push(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { url, lines, store: memory };
}

function post(url: string, body: string, headers: Record<string, string> = {}) {
  return fetch(`${url}/t/events`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

describe("POST /t/events", () => {
  it("valid batch of two events › 200 with accepted for both and both stored", async () => {
    const { url, store } = await start();

    const res = await post(url, JSON.stringify({ events: [pageViewed(1), pageViewed(2)] }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      results: [
        { index: 0, status: "accepted" },
        { index: 1, status: "accepted" },
      ],
    });
    expect(store.events()).toHaveLength(2);
  });

  it("same batch sent twice › second response reports duplicate", async () => {
    const { url } = await start();
    const body = JSON.stringify({ events: [pageViewed(1)] });

    await post(url, body);
    const res = await post(url, body);

    expect(await res.json()).toEqual({ results: [{ index: 0, status: "duplicate" }] });
  });

  it("Content-Length over the limit › 413 and store not called", async () => {
    const { url, store } = await start({ maxBodyBytes: 100 });

    const res = await post(url, JSON.stringify({ events: [pageViewed(1)] }));

    expect(res.status).toBe(413);
    expect(store.events()).toHaveLength(0);
  });

  it("chunked body over the limit without Content-Length › 413 and store not called", async () => {
    const { url, store } = await start({ maxBodyBytes: 100 });
    const encoded = new TextEncoder().encode(JSON.stringify({ events: [pageViewed(1)] }));
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoded.slice(0, 60));
        controller.enqueue(encoded.slice(60));
        controller.close();
      },
    });

    const res = await fetch(`${url}/t/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: stream,
      duplex: "half",
    } as RequestInit);

    expect(res.status).toBe(413);
    expect(store.events()).toHaveLength(0);
  });

  it("more events than the batch limit › 413 and store not called", async () => {
    const { url, store } = await start();
    const events = Array.from({ length: MAX_BATCH_SIZE + 1 }, (_, i) => pageViewed(i + 1));

    const res = await post(url, JSON.stringify({ events }));

    expect(res.status).toBe(413);
    expect(store.events()).toHaveLength(0);
  });

  it("body is not a batch › 400", async () => {
    const { url } = await start();

    const res = await post(url, JSON.stringify([pageViewed(1)]));

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid_batch" });
  });

  it("malformed JSON › 400 and the body is not echoed", async () => {
    const { url } = await start();

    const res = await post(url, '{"email":"jane@example.com"');

    expect(res.status).toBe(400);
    expect(await res.text()).not.toContain("jane@example.com");
  });

  it("text/plain beacon body › accepted", async () => {
    const { url, store } = await start();

    const res = await post(url, JSON.stringify({ events: [pageViewed(1)] }), {
      "content-type": "text/plain;charset=UTF-8",
    });

    expect(res.status).toBe(200);
    expect(store.events()).toHaveLength(1);
  });

  it("application/xml › 415", async () => {
    const { url } = await start();

    const res = await post(url, "<a/>", { "content-type": "application/xml" });

    expect(res.status).toBe(415);
  });

  it('X-Forwarded-For "spoofed, 203.0.113.77" with one trusted hop › stored IP derives from 203.0.113.77', async () => {
    const { url, store } = await start({ hops: 1 });

    await post(url, JSON.stringify({ events: [pageViewed(1)] }), {
      "x-forwarded-for": "198.51.100.9, 203.0.113.77",
    });

    const ip = store.events()[0]?.event.context.ip_trunc;
    expect(ip).toContain("203.0.113.");
    expect(ip).not.toContain("77");
    expect(ip).not.toContain("198.51.100");
  });

  it("no X-Forwarded-For header › falls back to the socket address", async () => {
    const { url, store } = await start({ hops: 1 });

    await post(url, JSON.stringify({ events: [pageViewed(1)] }));

    expect(store.events()[0]?.event.context.ip_trunc).toContain("127.0.0.");
  });

  it("custom event with email property and URL with ?email= › stored event has neither value", async () => {
    const { url, store } = await start();
    const event = {
      ...BASE,
      event_id: "0192f5a0-7c3e-7b1a-9d4e-000000000009",
      type: "CustomEventTracked",
      context: { url: "https://shop.example/pricing?email=jane@example.com" },
      payload: { name: "signup", properties: { email: "jane@example.com" } },
    };

    await post(url, JSON.stringify({ events: [event] }));

    const stored = store.events().map((s) => s.event);
    expect(stored).toHaveLength(1);
    expect(JSON.stringify(stored)).not.toContain("jane@example.com");
  });

  it("request without any consent header or cookie › accepted", async () => {
    const { url } = await start();

    const res = await post(url, JSON.stringify({ events: [pageViewed(1)] }));

    expect(res.status).toBe(200);
  });

  it("no x-request-id › response has a generated id and every log line carries it", async () => {
    const { url, lines } = await start();

    const res = await post(url, JSON.stringify({ events: [pageViewed(1)] }));

    const id = res.headers.get("x-request-id");
    expect(id).toBe("generated-id-1");
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(JSON.parse(line)).toMatchObject({ requestId: id });
    }
  });

  it("valid incoming x-request-id › echoed unchanged", async () => {
    const { url } = await start();

    const res = await post(url, JSON.stringify({ events: [pageViewed(1)] }), {
      "x-request-id": "abc-12345678",
    });

    expect(res.headers.get("x-request-id")).toBe("abc-12345678");
  });

  it("unsafe incoming x-request-id › replaced by a generated id", async () => {
    const { url } = await start();

    const res = await post(url, JSON.stringify({ events: [pageViewed(1)] }), {
      "x-request-id": "bad id with spaces",
    });

    expect(res.headers.get("x-request-id")).toBe("generated-id-1");
  });

  it("body with an email, full IP and cookie header › no log line contains any of them", async () => {
    const { url, lines } = await start();
    const event = pageViewed(1, { payload: { title: "jane@example.com" } });

    await post(url, JSON.stringify({ events: [event] }), {
      "x-forwarded-for": "203.0.113.77",
      cookie: "session=topsecretcookie",
    });
    await post(url, "not json jane@example.com");

    const logs = lines.join("\n");
    expect(logs).not.toContain("jane@example.com");
    expect(logs).not.toContain("203.0.113.77");
    expect(logs).not.toContain("127.0.0.1");
    expect(logs).not.toContain("topsecretcookie");
  });

  it("store.append throws › 503 with Retry-After, fixed body, error logged once without pg detail", async () => {
    const failing: EventStore = {
      append: (): Promise<AppendResult> =>
        Promise.reject(
          Object.assign(new Error("insert failed"), {
            code: "08006",
            detail: "Key (x)=(jane@example.com)",
          }),
        ),
    };
    const { url, lines } = await start({ store: failing });

    const res = await post(url, JSON.stringify({ events: [pageViewed(1)] }));

    expect(res.status).toBe(503);
    expect(res.headers.get("retry-after")).toBe("1");
    expect(await res.json()).toEqual({ error: "store_unavailable", requestId: "generated-id-1" });
    const errors = lines.filter((l) => JSON.parse(l).level === "error");
    expect(errors).toHaveLength(1);
    expect(lines.join("\n")).not.toContain("jane@example.com");
  });
});

describe("routing", () => {
  it("GET /t/events › 405 with Allow: POST", async () => {
    const { url } = await start();

    const res = await fetch(`${url}/t/events`);

    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("POST");
  });

  it("POST /events › 404", async () => {
    const { url } = await start();

    const res = await fetch(`${url}/events`, { method: "POST", body: "{}" });

    expect(res.status).toBe(404);
  });
});
