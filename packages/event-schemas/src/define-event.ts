import { z } from "zod";
import { envelopeBaseShape, withTrustRule } from "./envelope.js";

/** Internal helper: a strict v1 event envelope with a literal type and version (ES-05). */
export function defineEventV1<
  const TType extends string,
  TPayload extends z.ZodType,
  TShape extends z.ZodRawShape = Record<never, never>,
>(type: TType, payload: TPayload, overrides?: TShape) {
  return withTrustRule(
    z.strictObject({
      ...envelopeBaseShape,
      ...overrides,
      type: z.literal(type),
      version: z.literal(1),
      payload,
    }),
  );
}
