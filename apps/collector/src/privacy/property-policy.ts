import type { CustomEventTrackedV1 } from "@tracking/event-schemas";

export type RedactionReason =
  | "key_not_allowed"
  | "value_looks_personal"
  | "value_too_long"
  | "too_many_properties";

export type RedactedProperty = {
  readonly key: string;
  readonly reason: RedactionReason;
};

export type PropertyPolicy = {
  readonly allowedKeys: ReadonlySet<string>;
  readonly maxProperties: number;
  readonly maxStringLength: number;
};

export type PropertyPolicyResult = {
  readonly event: CustomEventTrackedV1;
  /** Key names and reasons only. Never values, so it is safe to log (NODE-13). */
  readonly redacted: readonly RedactedProperty[];
};

export const DEFAULT_PROPERTY_POLICY: PropertyPolicy = {
  allowedKeys: new Set([
    "category",
    "variant",
    "step",
    "plan",
    "experiment_id",
    "position",
    "component",
  ]),
  maxProperties: 20,
  maxStringLength: 200,
};

const EMAIL_LIKE = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const MIN_PERSONAL_DIGIT_RUN = 9;

function looksPersonal(value: string): boolean {
  if (EMAIL_LIKE.test(value)) {
    return true;
  }
  const compact = value.replace(/[\s\-.()]/g, "");
  return new RegExp(`\\d{${MIN_PERSONAL_DIGIT_RUN},}`).test(compact);
}

type PropertyValue = string | number | boolean | null;

function redactionReason(
  key: string,
  value: PropertyValue,
  policy: PropertyPolicy,
): RedactionReason | undefined {
  if (!policy.allowedKeys.has(key)) {
    return "key_not_allowed";
  }
  if (typeof value === "string") {
    if (looksPersonal(value)) {
      return "value_looks_personal";
    }
    if (value.length > policy.maxStringLength) {
      return "value_too_long";
    }
  }
  return undefined;
}

/**
 * Deny-by-default admission and redaction of `payload.properties`.
 * Pure: never throws, never mutates the input (ES-12, TS-11).
 */
export function applyPropertyPolicy(
  event: CustomEventTrackedV1,
  policy: PropertyPolicy = DEFAULT_PROPERTY_POLICY,
): PropertyPolicyResult {
  const { properties, ...restPayload } = event.payload;
  if (properties === undefined) {
    return { event, redacted: [] };
  }

  const kept: Record<string, PropertyValue> = {};
  const redacted: RedactedProperty[] = [];
  let keptCount = 0;

  for (const key of Object.keys(properties).sort()) {
    const value = properties[key];
    if (value === undefined) {
      continue;
    }
    const reason = redactionReason(key, value, policy);
    if (reason !== undefined) {
      redacted.push({ key, reason });
    } else if (keptCount >= policy.maxProperties) {
      redacted.push({ key, reason: "too_many_properties" });
    } else {
      kept[key] = value;
      keptCount += 1;
    }
  }

  const payload = keptCount > 0 ? { ...restPayload, properties: kept } : restPayload;
  return { event: { ...event, payload }, redacted };
}
