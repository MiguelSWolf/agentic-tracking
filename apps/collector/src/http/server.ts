import { randomUUID } from "node:crypto";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { createServer } from "node:http";
import type { EventStore } from "@tracking/event-store";
import type { CollectorConfig } from "../config.js";
import type { IngestBatchResult } from "../ingest/ingest-batch.js";
import { ingestBatch, MAX_BATCH_SIZE } from "../ingest/ingest-batch.js";
import type { Logger } from "../logger.js";
import { resolveClientIp } from "./client-ip.js";
import { HttpError, handleRequestError, IngestFailure, sendJson } from "./errors.js";
import { readJsonBody } from "./read-body.js";
import { resolveRequestId } from "./request-id.js";

export const EVENTS_ROUTE = "/t/events";

export type CollectorServerDeps = {
  readonly config: Pick<CollectorConfig, "maxBodyBytes" | "trustedProxyHops">;
  readonly store: EventStore;
  readonly logger: Logger;
  readonly newRequestId?: () => string;
  readonly clock?: () => Date;
};

function isOverBatchLimit(body: unknown): boolean {
  if (typeof body !== "object" || body === null) {
    return false;
  }
  const events: unknown = (body as { events?: unknown }).events;
  return Array.isArray(events) && events.length > MAX_BATCH_SIZE;
}

function countStatuses(result: Extract<IngestBatchResult, { ok: true }>): Record<string, number> {
  const counts = { accepted: 0, duplicate: 0, rejected: 0 };
  for (const r of result.results) {
    counts[r.status] += 1;
  }
  return counts;
}

/** Creates the HTTP server without listening. The caller owns `listen` and shutdown. */
export function createCollectorServer(deps: CollectorServerDeps): Server {
  const newRequestId = deps.newRequestId ?? randomUUID;
  const clock = deps.clock ?? (() => new Date());

  async function handleEvents(req: IncomingMessage, res: ServerResponse, log: Logger) {
    const { json, bytes } = await readJsonBody(req, deps.config.maxBodyBytes);
    if (isOverBatchLimit(json)) {
      throw new HttpError(413, "payload_too_large");
    }
    const clientIp = resolveClientIp(
      req.headers["x-forwarded-for"],
      req.socket.remoteAddress,
      deps.config.trustedProxyHops,
    );

    // The only thing that throws here is the store: the central handler answers 503.
    const result = await ingestBatch({ body: json, clientIp }, { store: deps.store, clock }).catch(
      (err: unknown) => {
        throw new IngestFailure(err);
      },
    );
    if (!result.ok) {
      throw new HttpError(400, "invalid_batch");
    }
    const counts = countStatuses(result);
    log.info("batch ingested", { bodyBytes: bytes, ...counts });
    sendJson(res, 200, { results: result.results });
  }

  return createServer((req, res) => {
    const started = Date.now();
    const requestId = resolveRequestId(req.headers["x-request-id"], newRequestId);
    const log = deps.logger.child({ requestId });
    res.setHeader("x-request-id", requestId);

    const run = async (): Promise<number> => {
      const path = (req.url ?? "").split("?")[0];
      if (path !== EVENTS_ROUTE) {
        throw new HttpError(404, "not_found");
      }
      if (req.method !== "POST") {
        throw new HttpError(405, "method_not_allowed", { allow: "POST" });
      }
      await handleEvents(req, res, log);
      return 200;
    };

    run().then(
      (status) => {
        log.info("request", {
          method: req.method ?? "",
          route: EVENTS_ROUTE,
          status,
          durationMs: Date.now() - started,
        });
      },
      (err: unknown) => {
        const status = handleRequestError(err, res, log, requestId);
        log.info("request", {
          method: req.method ?? "",
          route: err instanceof HttpError && err.status === 404 ? "unmatched" : EVENTS_ROUTE,
          status,
          durationMs: Date.now() - started,
        });
      },
    );
  });
}
