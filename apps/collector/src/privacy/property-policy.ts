import type { CustomEventTrackedV1 } from "@tracking/event-schemas";
import { looksPersonal } from "./detectors.js";

export type RedactionReason =
  | "key_not_allowed"
  | "value_looks_personal"
  | "value_too_long"
  | "too_many_properties";

/** Number of dropped properties per reason. Fixed labels and integers only. */
export type RedactionCounts = Readonly<Record<RedactionReason, number>>;

export type PropertyPolicy = {
  readonly allowedKeys: ReadonlySet<string>;
  readonly maxProperties: number;
  readonly maxStringLength: number;
};

export type PropertyPolicyResult = {
  readonly event: CustomEventTrackedV1;
  /**
   * Counts per fixed reason. Contains no key names and no values, because both are
   * caller-controlled and can carry personal data. Safe to log (NODE-13).
   */
  readonly redacted: RedactionCounts;
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

const NO_REDACTIONS: RedactionCounts = {
  key_not_allowed: 0,
  value_looks_personal: 0,
  value_too_long: 0,
  too_many_properties: 0,
};

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
    return { event, redacted: { ...NO_REDACTIONS } };
  }

  const kept: Record<string, PropertyValue> = {};
  const redacted: Record<RedactionReason, number> = { ...NO_REDACTIONS };
  let keptCount = 0;

  for (const key of Object.keys(properties).sort()) {
    const value = properties[key];
    if (value === undefined) {
      continue;
    }
    const reason = redactionReason(key, value, policy);
    if (reason !== undefined) {
      redacted[reason] += 1;
    } else if (keptCount >= policy.maxProperties) {
      redacted.too_many_properties += 1;
    } else {
      kept[key] = value;
      keptCount += 1;
    }
  }

  const payload = keptCount > 0 ? { ...restPayload, properties: kept } : restPayload;
  return { event: { ...event, payload }, redacted };
}
