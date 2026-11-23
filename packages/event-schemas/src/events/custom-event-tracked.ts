import { z } from "zod";
import { defineEventV1 } from "../define-event.js";

export const CustomEventTrackedPayloadV1 = z.strictObject({
  name: z.string().min(1).max(100),
  properties: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .optional(),
});
export type CustomEventTrackedPayloadV1 = z.infer<typeof CustomEventTrackedPayloadV1>;

export const CustomEventTrackedV1 = defineEventV1(
  "CustomEventTracked",
  CustomEventTrackedPayloadV1,
);
export type CustomEventTrackedV1 = z.infer<typeof CustomEventTrackedV1>;
