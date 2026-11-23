import { describe, expect, it } from "vitest";
import { EVENT_TYPES, eventRegistry } from "./registry.js";
import { listFixtureFolders } from "./testing/contract.js";

describe("eventRegistry", () => {
  it("when listed, holds exactly the six initial types at version 1", () => {
    const entries = [...eventRegistry].map(([type, versions]) => [type, [...versions.keys()]]);

    expect(entries).toEqual(EVENT_TYPES.map((type) => [type, [1]]));
    expect(EVENT_TYPES).toHaveLength(6);
  });

  it("when compared with the fixture folders, has one folder per registered version", () => {
    const expected = [...eventRegistry].flatMap(([type, versions]) =>
      [...versions.keys()].map((version) => `${type}.v${version}`),
    );

    expect(listFixtureFolders()).toEqual(expected.sort());
  });
});
