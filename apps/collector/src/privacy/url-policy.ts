import type { ContextV1 } from "@tracking/event-schemas";
import { looksPersonal } from "./detectors.js";

export type UrlRedactionReason =
  | "fragment_dropped"
  | "credentials_dropped"
  | "query_param_dropped"
  | "query_value_looks_personal"
  | "path_segment_redacted"
  | "url_unparseable"
  | "url_scheme_unsupported";

/** Number of redactions per reason. Fixed labels and integers only. */
export type UrlRedactionCounts = Readonly<Record<UrlRedactionReason, number>>;

export type UrlPolicy = {
  readonly allowedParamPrefixes: readonly string[];
  readonly allowedParams: ReadonlySet<string>;
};

export type UrlPolicyResult<E> = {
  readonly event: E;
  /** Counts per fixed reason. No parameter names, no values (NODE-13). */
  readonly redacted: UrlRedactionCounts;
};

export const DEFAULT_URL_POLICY: UrlPolicy = {
  allowedParamPrefixes: ["utm_"],
  allowedParams: new Set([
    "gclid",
    "gbraid",
    "wbraid",
    "dclid",
    "fbclid",
    "msclkid",
    "ttclid",
    "twclid",
    "li_fat_id",
  ]),
};

const NO_REDACTIONS: UrlRedactionCounts = {
  fragment_dropped: 0,
  credentials_dropped: 0,
  query_param_dropped: 0,
  query_value_looks_personal: 0,
  path_segment_redacted: 0,
  url_unparseable: 0,
  url_scheme_unsupported: 0,
};

const REDACTED_SEGMENT = "redacted";
const UNPARSEABLE_URL = "about:blank";

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isAllowedParam(name: string, policy: UrlPolicy): boolean {
  return (
    policy.allowedParams.has(name) ||
    policy.allowedParamPrefixes.some((prefix) => name.startsWith(prefix))
  );
}

/**
 * Removes personal data from `context.url`: fragment, credentials, query parameters that
 * are not allowlisted, allowed values that look personal, and personal-looking path segments.
 * Pure: never throws, never mutates the input (ES-12, TS-11).
 */
export function applyUrlPolicy<E extends { readonly context: ContextV1 }>(
  event: E,
  policy: UrlPolicy = DEFAULT_URL_POLICY,
): UrlPolicyResult<E> {
  const redacted: Record<UrlRedactionReason, number> = { ...NO_REDACTIONS };
  const parsed = URL.parse(event.context.url);
  if (parsed === null) {
    redacted.url_unparseable += 1;
    return { event: { ...event, context: { ...event.context, url: UNPARSEABLE_URL } }, redacted };
  }

  // Opaque-path URLs (data:, javascript:, mailto:) ignore pathname writes, so they cannot be
  // redacted segment by segment. Only HTTP(S) is rewritten; anything else becomes the placeholder.
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    redacted.url_scheme_unsupported += 1;
    return { event: { ...event, context: { ...event.context, url: UNPARSEABLE_URL } }, redacted };
  }

  if (parsed.hash !== "") {
    redacted.fragment_dropped += 1;
    parsed.hash = "";
  }

  if (parsed.username !== "" || parsed.password !== "") {
    redacted.credentials_dropped += 1;
    parsed.username = "";
    parsed.password = "";
  }

  const kept = new URLSearchParams();
  for (const [name, value] of parsed.searchParams) {
    if (!isAllowedParam(name, policy)) {
      redacted.query_param_dropped += 1;
    } else if (looksPersonal(value)) {
      redacted.query_value_looks_personal += 1;
    } else {
      kept.append(name, value);
    }
  }
  const search = kept.toString();
  parsed.search = search;

  if (parsed.pathname.length > 1) {
    const segments = parsed.pathname.split("/").map((segment) => {
      if (segment !== "" && looksPersonal(safeDecode(segment))) {
        redacted.path_segment_redacted += 1;
        return REDACTED_SEGMENT;
      }
      return segment;
    });
    parsed.pathname = segments.join("/");
  }

  const url = parsed.href;
  const changed = Object.values(redacted).some((count) => count > 0);
  if (!changed) {
    return { event, redacted };
  }
  return { event: { ...event, context: { ...event.context, url } }, redacted };
}
