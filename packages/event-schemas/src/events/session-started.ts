import { z } from "zod";
import { defineEventV1 } from "../define-event.js";

export const SessionStartedPayloadV1 = z.strictObject({});
export type SessionStartedPayloadV1 = z.infer<typeof SessionStartedPayloadV1>;

export const SessionStartedV1 = defineEventV1("SessionStarted", SessionStartedPayloadV1);
export type SessionStartedV1 = z.infer<typeof SessionStartedV1>;
