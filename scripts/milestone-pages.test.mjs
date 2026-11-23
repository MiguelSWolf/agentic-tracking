import { describe, expect, it } from "vitest";
import { readAllPages } from "./milestone-pages.mjs";

const pagesFrom = (pages) => {
  const calls = [];
  const fetchPage = async (after) => {
    calls.push(after);
    return pages[calls.length - 1];
  };
  return { fetchPage, calls };
};

describe("readAllPages", () => {
  it("collects every page and reports complete when the last page has no next page", async () => {
    const { fetchPage, calls } = pagesFrom([
      { nodes: ["TRK-1", "TRK-2"], pageInfo: { hasNextPage: true, endCursor: "c1" } },
      { nodes: ["TRK-3"], pageInfo: { hasNextPage: false, endCursor: "c2" } },
    ]);
    const result = await readAllPages(fetchPage);
    expect(result).toEqual({ nodes: ["TRK-1", "TRK-2", "TRK-3"], complete: true });
    expect(calls).toEqual([null, "c1"]);
  });

  it("reports incomplete when a page has a next page but no cursor", async () => {
    const { fetchPage } = pagesFrom([
      { nodes: ["TRK-1"], pageInfo: { hasNextPage: true, endCursor: null } },
    ]);
    expect(await readAllPages(fetchPage)).toEqual({ nodes: ["TRK-1"], complete: false });
  });

  it("reports incomplete when the cursor repeats", async () => {
    const { fetchPage, calls } = pagesFrom([
      { nodes: ["TRK-1"], pageInfo: { hasNextPage: true, endCursor: "c1" } },
      { nodes: ["TRK-2"], pageInfo: { hasNextPage: true, endCursor: "c1" } },
    ]);
    expect(await readAllPages(fetchPage)).toEqual({ nodes: ["TRK-1", "TRK-2"], complete: false });
    expect(calls).toHaveLength(2);
  });

  it("reports incomplete when the page limit is reached", async () => {
    const fetchPage = async (after) => ({
      nodes: [after ?? "first"],
      pageInfo: { hasNextPage: true, endCursor: `${after ?? "first"}+` },
    });
    const result = await readAllPages(fetchPage, 3);
    expect(result.complete).toBe(false);
    expect(result.nodes).toHaveLength(3);
  });
});
