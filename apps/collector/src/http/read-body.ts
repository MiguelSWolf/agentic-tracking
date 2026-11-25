import type { IncomingMessage } from "node:http";
import { HttpError } from "./errors.js";

export type ReadBody = { readonly json: unknown; readonly bytes: number };

function checkContentType(header: string | undefined): void {
  const type = (header ?? "").split(";")[0]?.trim().toLowerCase();
  // text/plain: navigator.sendBeacon sends it, which avoids a CORS preflight.
  if (type !== "application/json" && type !== "text/plain") {
    throw new HttpError(415, "unsupported_media_type");
  }
}

/** Reads and parses the JSON body, enforcing the byte limit for declared and chunked bodies. */
export async function readJsonBody(req: IncomingMessage, maxBytes: number): Promise<ReadBody> {
  checkContentType(req.headers["content-type"]);

  const declared = req.headers["content-length"];
  if (declared !== undefined && Number(declared) > maxBytes) {
    throw new HttpError(413, "payload_too_large", { connection: "close" });
  }

  const chunks: Buffer[] = [];
  let bytes = 0;
  try {
    for await (const chunk of req) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
      bytes += buf.length;
      if (bytes > maxBytes) {
        throw new HttpError(413, "payload_too_large", { connection: "close" });
      }
      chunks.push(buf);
    }
  } catch (err) {
    if (err instanceof HttpError) {
      throw err;
    }
    // Aborted or errored stream: the client is gone or sent a broken body (NODE-08).
    throw new HttpError(400, "invalid_json");
  }

  try {
    return { json: JSON.parse(Buffer.concat(chunks).toString("utf8")), bytes };
  } catch {
    throw new HttpError(400, "invalid_json");
  }
}
