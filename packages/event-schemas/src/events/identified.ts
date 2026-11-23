import { z } from "zod";
import { defineEventV1 } from "../define-event.js";

export const IdentifiedPayloadV1 = z.strictObject({});
export type IdentifiedPayloadV1 = z.infer<typeof IdentifiedPayloadV1>;

/** `user_id` (opaque, ADR-0009) is required on this event. */
export const IdentifiedV1 = defineEventV1("Identified", IdentifiedPayloadV1, {
  user_id: z.string().min(1),
});
export type IdentifiedV1 = z.infer<typeof IdentifiedV1>;
