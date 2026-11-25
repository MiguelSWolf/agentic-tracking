export type { CollectorConfig } from "./config.js";
export { loadConfig } from "./config.js";
export type { CollectorServerDeps } from "./http/server.js";
export { createCollectorServer } from "./http/server.js";
export type {
  EventIssue,
  EventResult,
  IngestBatchDeps,
  IngestBatchInput,
  IngestBatchResult,
  IngestRedactions,
} from "./ingest/ingest-batch.js";
export { ingestBatch, MAX_BATCH_SIZE } from "./ingest/ingest-batch.js";
export type { LogFields, Logger, LogLevel } from "./logger.js";
export { createLogger } from "./logger.js";
export type {
  EventNamePolicyResult,
  EventNameRedactionCounts,
  EventNameRedactionReason,
} from "./privacy/event-name-policy.js";
export { applyEventNamePolicy, REDACTED_EVENT_NAME } from "./privacy/event-name-policy.js";
export type {
  PropertyPolicy,
  PropertyPolicyResult,
  RedactionCounts,
  RedactionReason,
} from "./privacy/property-policy.js";
export { applyPropertyPolicy, DEFAULT_PROPERTY_POLICY } from "./privacy/property-policy.js";
export { truncateIp } from "./privacy/truncate-ip.js";
export type {
  UrlPolicy,
  UrlPolicyResult,
  UrlRedactionCounts,
  UrlRedactionReason,
} from "./privacy/url-policy.js";
export { applyUrlPolicy, DEFAULT_URL_POLICY } from "./privacy/url-policy.js";
