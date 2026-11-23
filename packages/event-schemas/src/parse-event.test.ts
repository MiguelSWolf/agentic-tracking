import { describe, expect, expectTypeOf, it } from "vitest";
import { parseEvent } from "./parse-event.js";
import type { AnyEventV1 } from "./registry.js";
import { loadFixtures } from "./testing/contract.js";

const pageViewed = loadFixtures("PageViewed.v1").valid[0]?.input;
const conversion = loadFixtures("ConversionRecorded.v1").valid[1]?.input;

function withOverride(base: unknown, override: Record<string, unknown>): unknown {
  return { ...(typeof base === "object" && base !== null ? base : {}), ...override };
}

describe("parseEvent", () => {
  it("with a valid conversion, returns ok and narrows the payload by type", () => {
    const result = parseEvent(conversion);

    expect(result).toMatchObject({
      ok: true,
      event: { type: "ConversionRecorded", payload: { conversion_id: "order_10482" } },
    });
    expectTypeOf<
      Extract<AnyEventV1, { type: "ConversionRecorded" }>["payload"]["conversion_id"]
    >().toBeString();
  });

  it("with an unknown type, fails at type", () => {
    const result = parseEvent(withOverride(pageViewed, { type: "PageScrolled" }));

    expect(!result.ok && result.error.issues[0]?.path).toEqual(["type"]);
  });

  it("with an unknown version, fails at version", () => {
    const result = parseEvent(withOverride(pageViewed, { version: 2 }));

    expect(!result.ok && result.error.issues[0]?.path).toEqual(["version"]);
  });

  it.each([null, "PageViewed", 42])("with non-object input %j, returns not ok", (input) => {
    const result = parseEvent(input);

    expect(result.ok).toBe(false);
  });

  it("with a conversion payload under type PageViewed, fails inside payload", () => {
    const input = withOverride(pageViewed, { payload: { conversion_id: "order_10482" } });

    const result = parseEvent(input);

    expect(!result.ok && result.error.issues[0]?.path[0]).toBe("payload");
  });
});
