import { describe, expect, it } from "vitest";
import { findViolations, parseNameStatusZ } from "./guard-paths-lib.mjs";

const z = (...fields) => `${fields.join("\0")}\0`;
const violations = (...fields) => findViolations(parseNameStatusZ(z(...fields)));

describe("parseNameStatusZ", () => {
  it("with a rename, lists both the old and the new path", () => {
    const entries = parseNameStatusZ(z("R100", "old.sql", "new.sql", "A", "x.ts"));

    expect(entries).toEqual([
      { status: "R", path: "old.sql" },
      { status: "R", path: "new.sql" },
      { status: "A", path: "x.ts" },
    ]);
  });

  it("with paths containing spaces or non-ASCII characters, keeps them whole", () => {
    const entries = parseNameStatusZ(z("A", "docs/my file.md", "M", "docs/café ✓.md"));

    expect(entries.map((e) => e.path)).toEqual(["docs/my file.md", "docs/café ✓.md"]);
  });
});

describe("findViolations", () => {
  it("with an added migration and a normal file, passes", () => {
    expect(violations("A", "packages/event-store/migrations/0004_new.sql", "M", "a.ts")).toEqual(
      [],
    );
  });

  it("with a modified migration, fails", () => {
    expect(violations("M", "packages/event-store/migrations/0001.sql")).toEqual([
      "M packages/event-store/migrations/0001.sql",
    ]);
  });

  it("with a renamed migration, fails on both paths", () => {
    expect(violations("R100", "a/migrations/0002.sql", "a/migrations/0002b.sql")).toHaveLength(2);
  });

  it("with a deleted migration, fails", () => {
    expect(violations("D", "a/migrations/0003.sql")).toEqual(["D a/migrations/0003.sql"]);
  });

  it("with a migration path containing spaces and non-ASCII, still enforces add-only", () => {
    expect(violations("M", "a/migrations/0005 café.sql")).toEqual(["M a/migrations/0005 café.sql"]);
    expect(violations("A", "a/migrations/0005 café.sql")).toEqual([]);
  });

  it("with a protected path containing whitespace, fails", () => {
    expect(violations("A", ".github/workflows/my flow.yml")).toHaveLength(1);
    expect(violations("A", "docs/adr/0015 título.md")).toHaveLength(1);
  });

  it("with a rename out of a protected zone, fails on the old path", () => {
    expect(violations("R090", "docs/adr/0001.md", "docs/notes.md")).toEqual(["R docs/adr/0001.md"]);
  });
});
