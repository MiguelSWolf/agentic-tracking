import { z } from "zod";
import { defineEventV1 } from "../define-event.js";

export const ConversionRecordedPayloadV1 = z
  .strictObject({
    conversion_id: z.string().min(1),
    value: z.number().min(0).optional(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .optional(),
  })
  .superRefine((payload, ctx) => {
    if (payload.value !== undefined && payload.currency === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["currency"],
        message: "currency is required when value is present",
      });
    }
  });
export type ConversionRecordedPayloadV1 = z.infer<typeof ConversionRecordedPayloadV1>;

export const ConversionRecordedV1 = defineEventV1(
  "ConversionRecorded",
  ConversionRecordedPayloadV1,
);
export type ConversionRecordedV1 = z.infer<typeof ConversionRecordedV1>;
