import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { parseEvent } from "../parse-event.js";
import { loadFixtures } from "./contract.js";

/** Table-driven contract test over a fixture folder (ES-06, TEST-15). */
export function describeEventContract(type: string, schema: z.ZodType): void {
  const { valid, invalid } = loadFixtures(`${type}.v1`);

  describe(`${type} v1 contract`, () => {
    it.each(valid)("$name, when parsed by the schema, succeeds", ({ input }) => {
      const result = schema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it.each(valid)(
      "$name, when parsed by parseEvent, returns ok with the same type",
      ({ input }) => {
        const result = parseEvent(input);

        expect(result.ok && result.event.type).toBe(type);
      },
    );

    it.each(invalid)(
      "$name, when parsed by the schema, fails at the expected path",
      ({ input, expectedPath }) => {
        const result = schema.safeParse(input);

        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.path).toEqual(expectedPath);
      },
    );

    it.each(invalid)("$name, when parsed by parseEvent, returns not ok", ({ input }) => {
      const result = parseEvent(input);

      expect(result.ok).toBe(false);
    });
  });
}
