import { z } from "zod";
import { defineEventV1 } from "../define-event.js";

export const ElementClickedPayloadV1 = z.strictObject({
  selector: z.string().min(1).max(500),
  /** Value of `data-track-label`, set by the site developer. Never visitor-visible text (ES-09). */
  label: z.string().min(1).max(100).optional(),
  href: z.url().optional(),
});
export type ElementClickedPayloadV1 = z.infer<typeof ElementClickedPayloadV1>;

export const ElementClickedV1 = defineEventV1("ElementClicked", ElementClickedPayloadV1);
export type ElementClickedV1 = z.infer<typeof ElementClickedV1>;
