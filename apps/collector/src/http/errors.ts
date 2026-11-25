import type { ServerResponse } from "node:http";
import type { Logger } from "../logger.js";
import { serializeError } from "../logger.js";

export type HttpErrorCode =
  | "payload_too_large"
  | "invalid_json"
  | "invalid_batch"
  | "unsupported_media_type"
  | "method_not_allowed"
  | "not_found";

/** Operational error with a status and a fixed code. Never carries input values (NODE-03, NODE-13). */
export class HttpError extends Error {
  readonly status: number;
  readonly code: HttpErrorCode;
  readonly headers: Readonly<Record<string, string>>;

  constructor(status: number, code: HttpErrorCode, headers: Readonly<Record<string, string>> = {}) {
    super(code);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}

/** Wraps an error thrown while ingesting (the event store). Mapped to 503 (NODE-02: keeps `cause`). */
export class IngestFailure extends Error {
  constructor(cause: unknown) {
    super("ingest failed", { cause });
    this.name = "IngestFailure";
  }
}

export function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
  headers: Readonly<Record<string, string>> = {},
): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(payload),
    ...headers,
  });
  res.end(payload);
}

/**
 * The one place errors become responses (NODE-04). `HttpError` keeps its status. An `IngestFailure`
 * (the event store threw) is transient: 503 so the client retries; this
 * is safe because `event_id` is the idempotency key (ES-04). Anything else is a 500.
 */
export function handleRequestError(
  err: unknown,
  res: ServerResponse,
  log: Logger,
  requestId: string,
): number {
  let status: number;
  let code: string;
  let headers: Readonly<Record<string, string>> = {};

  if (err instanceof HttpError) {
    status = err.status;
    code = err.code;
    headers = err.headers;
  } else if (err instanceof IngestFailure) {
    status = 503;
    code = "store_unavailable";
    headers = { "retry-after": "1" };
    log.error("ingest failed", serializeError(err.cause));
  } else {
    status = 500;
    code = "internal_error";
    log.error("unexpected error", serializeError(err));
  }

  if (res.headersSent) {
    res.destroy();
  } else {
    sendJson(res, status, { error: code, requestId }, headers);
  }
  return status;
}
