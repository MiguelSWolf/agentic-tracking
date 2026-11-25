import type { AnyEventV1 } from "@tracking/event-schemas";
import { parseEvent } from "@tracking/event-schemas";
import type { EventStore } from "@tracking/event-store";
import { z } from "zod";
import type { EventNameRedactionCounts } from "../privacy/event-name-policy.js";
import { applyEventNamePolicy } from "../privacy/event-name-policy.js";
import type { PropertyPolicy, RedactionCounts } from "../privacy/property-policy.js";
import { applyPropertyPolicy, DEFAULT_PROPERTY_POLICY } from "../privacy/property-policy.js";
import { truncateIp } from "../privacy/truncate-ip.js";
import type { UrlPolicy, UrlRedactionCounts } from "../privacy/url-policy.js";
import { applyUrlPolicy, DEFAULT_URL_POLICY } from "../privacy/url-policy.js";

export const MAX_BATCH_SIZE = 100;

const Batch = z.object({ events: z.array(z.unknown()).min(1).max(MAX_BATCH_SIZE) });

/** Zod path and code only. Never the message: messages can echo input values (ES-09, NODE-13). */
export type EventIssue = { readonly path: string; readonly code: string };

export type EventResult =
  | { readonly index: number; readonly status: "accepted" }
  | { readonly index: number; readonly status: "duplicate" }
  | {
      readonly index: number;
      readonly status: "rejected";
      readonly reason: "invalid_event";
      readonly issues: readonly EventIssue[];
    };

export type IngestRedactions = {
  readonly url: UrlRedactionCounts;
  readonly eventName: EventNameRedactionCounts;
  readonly properties: RedactionCounts;
};

export type IngestBatchResult =
  | { readonly ok: false; readonly reason: "invalid_batch" }
  | {
      readonly ok: true;
      /** One entry per input event, in input order. */
      readonly results: readonly EventResult[];
      /** Summed redaction counts over the batch, safe to log (NODE-13). */
      readonly redactions: IngestRedactions;
    };

export type IngestBatchInput = {
  readonly body: unknown;
  /** Client IP from the transport. Truncated here before anything is stored. */
  readonly clientIp: string | undefined;
};

export type IngestBatchDeps = {
  readonly store: EventStore;
  readonly clock: () => Date;
  readonly propertyPolicy?: PropertyPolicy;
  readonly urlPolicy?: UrlPolicy;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Sets the fields only the server may set. Anything the client sent for them is discarded. */
function withServerFields(raw: unknown, receivedAt: string, ipTrunc: string | undefined): unknown {
  if (!isRecord(raw)) {
    return raw;
  }
  const next: Record<string, unknown> = { ...raw, received_at: receivedAt };
  if (isRecord(raw.context)) {
    const { ip_trunc: _discarded, ...context } = raw.context;
    next.context = ipTrunc === undefined ? context : { ...context, ip_trunc: ipTrunc };
  }
  return next;
}

function addCounts<K extends string>(
  a: Readonly<Record<K, number>>,
  b: Readonly<Record<K, number>>,
): Record<K, number> {
  const sum: Record<K, number> = { ...a };
  for (const key of Object.keys(b) as K[]) {
    sum[key] += b[key];
  }
  return sum;
}

const NO_URL: UrlRedactionCounts = {
  fragment_dropped: 0,
  credentials_dropped: 0,
  query_param_dropped: 0,
  query_value_looks_personal: 0,
  path_segment_redacted: 0,
  url_unparseable: 0,
  url_scheme_unsupported: 0,
};
const NO_NAME: EventNameRedactionCounts = { name_invalid: 0, name_looks_personal: 0 };
const NO_PROPERTIES: RedactionCounts = {
  key_not_allowed: 0,
  value_looks_personal: 0,
  value_too_long: 0,
  too_many_properties: 0,
};

/** Applies the privacy policies to a parsed event. Exhaustive on `type` (TS-15). */
function applyPolicies(
  event: AnyEventV1,
  deps: IngestBatchDeps,
): { event: AnyEventV1; redactions: IngestRedactions } {
  const url = applyUrlPolicy(event, deps.urlPolicy ?? DEFAULT_URL_POLICY);
  switch (url.event.type) {
    case "CustomEventTracked": {
      const name = applyEventNamePolicy(url.event);
      const props = applyPropertyPolicy(name.event, deps.propertyPolicy ?? DEFAULT_PROPERTY_POLICY);
      return {
        event: props.event,
        redactions: { url: url.redacted, eventName: name.redacted, properties: props.redacted },
      };
    }
    case "SessionStarted":
    case "PageViewed":
    case "ElementClicked":
    case "Identified":
    case "ConversionRecorded":
      return {
        event: url.event,
        redactions: { url: url.redacted, eventName: NO_NAME, properties: NO_PROPERTIES },
      };
  }
}

/**
 * Turns a batch into appended events. Transport-agnostic. Invalid events are rejected one by
 * one; only a malformed batch is rejected as a whole. Consent is not checked here: the SDK
 * gates sending (ADR-0009). A store failure propagates (NODE-03) so the caller can answer 5xx
 * and the client can retry safely, because `event_id` is the idempotency key.
 */
export async function ingestBatch(
  input: IngestBatchInput,
  deps: IngestBatchDeps,
): Promise<IngestBatchResult> {
  const batch = Batch.safeParse(input.body);
  if (!batch.success) {
    return { ok: false, reason: "invalid_batch" };
  }

  const receivedAt = deps.clock().toISOString();
  const ipTrunc = truncateIp(input.clientIp);
  const results: EventResult[] = [];
  let redactions: IngestRedactions = { url: NO_URL, eventName: NO_NAME, properties: NO_PROPERTIES };

  for (const [index, raw] of batch.data.events.entries()) {
    const parsed = parseEvent(withServerFields(raw, receivedAt, ipTrunc));
    if (!parsed.ok) {
      const issues = parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        code: issue.code,
      }));
      results.push({ index, status: "rejected", reason: "invalid_event", issues });
      continue;
    }

    const policed = applyPolicies(parsed.event, deps);
    redactions = {
      url: addCounts(redactions.url, policed.redactions.url),
      eventName: addCounts(redactions.eventName, policed.redactions.eventName),
      properties: addCounts(redactions.properties, policed.redactions.properties),
    };

    const appended = await deps.store.append(policed.event);
    results.push({ index, status: appended.status === "appended" ? "accepted" : "duplicate" });
  }

  return { ok: true, results, redactions };
}
