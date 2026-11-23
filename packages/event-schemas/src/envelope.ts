import { z } from "zod";

export const TRUST_LEVELS = ["unverified", "signed"] as const;
export const EVENT_SOURCES = ["client", "server"] as const;

const nonEmpty = z.string().min(1);

export const ContextV1 = z.strictObject({
  url: z.url(),
  referrer: z.url().optional(),
  utm_source: nonEmpty.optional(),
  utm_medium: nonEmpty.optional(),
  utm_campaign: nonEmpty.optional(),
  utm_term: nonEmpty.optional(),
  utm_content: nonEmpty.optional(),
  click_ids: z.record(nonEmpty, nonEmpty).optional(),
  ua: nonEmpty.optional(),
  ip_trunc: nonEmpty.optional(),
});
export type ContextV1 = z.infer<typeof ContextV1>;

export const envelopeBaseShape = {
  event_id: z.uuid({ version: "v7" }),
  occurred_at: z.iso.datetime({ offset: true }),
  received_at: z.iso.datetime({ offset: true }).optional(),
  attribution_key: nonEmpty,
  session_id: nonEmpty,
  seq: z.number().int().min(0),
  user_id: nonEmpty.optional(),
  app_id: nonEmpty,
  source: z.enum(EVENT_SOURCES),
  trust: z.enum(TRUST_LEVELS),
  context: ContextV1,
};

/** ADR-0008: a client-sourced event can never be trusted. Apply last (zod 4 cannot extend refined objects). */
export function withTrustRule<T extends z.ZodType<{ source: string; trust: string }>>(
  schema: T,
): T {
  return schema.superRefine((event, ctx) => {
    if (event.source === "client" && event.trust !== "unverified") {
      ctx.addIssue({
        code: "custom",
        path: ["trust"],
        message: "source 'client' requires trust 'unverified'",
      });
    }
  });
}

export const EnvelopeV1 = withTrustRule(
  z.strictObject({
    ...envelopeBaseShape,
    type: nonEmpty,
    version: z.number().int().positive(),
    payload: z.unknown(),
  }),
);
export type EnvelopeV1 = z.infer<typeof EnvelopeV1>;
