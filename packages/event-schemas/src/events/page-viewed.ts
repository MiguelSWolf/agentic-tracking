import { z } from "zod";
import { defineEventV1 } from "../define-event.js";

export const PageViewedPayloadV1 = z.strictObject({
  title: z.string().max(300).optional(),
});
export type PageViewedPayloadV1 = z.infer<typeof PageViewedPayloadV1>;

export const PageViewedV1 = defineEventV1("PageViewed", PageViewedPayloadV1);
export type PageViewedV1 = z.infer<typeof PageViewedV1>;
