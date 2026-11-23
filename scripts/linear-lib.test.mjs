import { describe, expect, it } from "vitest";
import { auditKey, importAudit } from "./linear-lib.mjs";

const finding = (id, title) => ({
  id,
  title,
  severity: "medium",
  category: "correctness",
  effort: "S",
  rationale: "Why it matters.",
  proposal: "What to change.",
  evidence: [{ path: "scripts/linear.mjs", line: 152, note: "loops through every finding" }],
});
const report = {
  milestone: "M0",
  auditor: "Codex",
  findings: [
    finding("M0-01", "Install the format plugin"),
    finding("M0-02", "Resolve event id uniqueness"),
    finding("M0-03", "Make imports safe to rerun"),
  ],
};

// A fake Linear: holds issue descriptions and records every create.
function fakeLinear(descriptions = []) {
  const store = [...descriptions];
  const created = [];
  return {
    created,
    existingDescriptions: async () => [...store],
    createIssue: async (input) => {
      created.push(input);
      store.push(input.description);
    },
  };
}

describe("auditKey", () => {
  it("with an imported audit description, returns milestone and finding id", () => {
    expect(auditKey("**Audit M0 · M0-07** · agent-workflow · effort M\n\n## Why")).toBe("M0/M0-07");
  });

  it("with any other description, returns null", () => {
    expect(auditKey("A finding written by hand")).toBeNull();
    expect(auditKey(undefined)).toBeNull();
  });
});

describe("importAudit", () => {
  it("with an empty Linear, creates one issue per finding", async () => {
    const linear = fakeLinear();

    const created = await importAudit(report, linear);

    expect(created).toEqual(["M0-01", "M0-02", "M0-03"]);
    expect(linear.created.map((i) => i.title)).toEqual([
      "[M0] Install the format plugin",
      "[M0] Resolve event id uniqueness",
      "[M0] Make imports safe to rerun",
    ]);
    expect(linear.created[0].description.startsWith("**Audit M0 · M0-01**")).toBe(true);
  });

  it("with a rerun after a partial import, creates only the missing issues", async () => {
    const linear = fakeLinear();
    const partial = { ...report, findings: report.findings.slice(0, 1) };
    await importAudit(partial, linear);

    const created = await importAudit(report, linear);

    expect(created).toEqual(["M0-02", "M0-03"]);
    expect(linear.created).toHaveLength(3);
  });

  it("with a rerun after a full import, creates nothing", async () => {
    const linear = fakeLinear();
    await importAudit(report, linear);

    const created = await importAudit(report, linear);

    expect(created).toEqual([]);
    expect(linear.created).toHaveLength(3);
  });

  it("with a finding rejected in triage (canceled or archived), does not re-create it", async () => {
    // existingDescriptions includes canceled and archived issues; only the description matters.
    const linear = fakeLinear(["**Audit M0 · M0-02** · adr · effort M\n\nRejected in G4."]);

    const created = await importAudit(report, linear);

    expect(created).toEqual(["M0-01", "M0-03"]);
  });

  it("with the same finding id in another milestone, still creates it", async () => {
    const linear = fakeLinear(["**Audit M1 · M0-01** · ci · effort S"]);

    const created = await importAudit(report, linear);

    expect(created).toContain("M0-01");
  });
});
