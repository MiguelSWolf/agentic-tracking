import { z } from "zod";
import { type AnyEventV1, EVENT_TYPES, eventRegistry } from "./registry.js";

export type ParseEventResult = { ok: true; event: AnyEventV1 } | { ok: false; error: z.ZodError };

const Header = z.looseObject({
  type: z.enum(EVENT_TYPES),
  version: z.number().int(),
});

function fail(path: string, message: string): ParseEventResult {
  return {
    ok: false,
    error: new z.ZodError([{ code: "custom", path: [path], message, input: undefined }]),
  };
}

/** Validates unknown input against the registered schema. Never throws for invalid input. */
export function parseEvent(input: unknown): ParseEventResult {
  const header = Header.safeParse(input);
  if (!header.success) {
    return { ok: false, error: header.error };
  }
  const schema = eventRegistry.get(header.data.type)?.get(header.data.version);
  if (schema === undefined) {
    return fail("version", `unsupported version ${header.data.version} for ${header.data.type}`);
  }
  const result = schema.safeParse(input);
  return result.success ? { ok: true, event: result.data } : { ok: false, error: result.error };
}
