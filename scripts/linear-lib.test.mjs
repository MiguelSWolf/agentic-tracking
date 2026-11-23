import { describe, expect, it } from "vitest";
import { auditKey, closingIssue, findingsForMilestone, importAudit } from "./linear-lib.mjs";

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

describe("closingIssue", () => {
  it("with a Fixes line, returns the issue", () => {
    expect(closingIssue("Owner-side half of TRK-9.\n\nFixes TRK-28\n\n## Why")).toBe("TRK-28");
  });

  it("with Closes or Resolves in any case, returns the issue", () => {
    expect(closingIssue("closes trk-7")).toBe("TRK-7");
    expect(closingIssue("Resolved TRK-12 as well")).toBe("TRK-12");
  });

  it("with an unrelated mention before the closing reference, returns the closed issue", () => {
    expect(closingIssue("Depends on TRK-23 (see notes).\n\nFixes TRK-25")).toBe("TRK-25");
  });

  it("with only bare mentions, returns null", () => {
    expect(closingIssue("Related to TRK-23 and TRK-27, no closing reference.")).toBeNull();
    expect(closingIssue("")).toBeNull();
  });
});

describe("findingsForMilestone", () => {
  const m0 = "milestone-m0";
  const m1 = "milestone-m1";
  const findings = [
    { identifier: "TRK-40", projectMilestone: { id: m0 } },
    { identifier: "TRK-41", projectMilestone: { id: m1 } },
    { identifier: "TRK-42", projectMilestone: null },
    { identifier: "TRK-43", projectMilestone: { id: m0 } },
  ];

  it("with findings from several milestones, keeps only the retro milestone's own", () => {
    const { ours } = findingsForMilestone(findings, m0);

    expect(ours.map((f) => f.identifier)).toEqual(["TRK-40", "TRK-43"]);
  });

  it("with a finding of another milestone, leaves it out of both sections", () => {
    const { ours, unassigned } = findingsForMilestone(findings, m0);

    expect([...ours, ...unassigned].map((f) => f.identifier)).not.toContain("TRK-41");
  });

  it("with a finding that has no milestone, lists it as unassigned", () => {
    const { unassigned } = findingsForMilestone(findings, m0);

    expect(unassigned.map((f) => f.identifier)).toEqual(["TRK-42"]);
  });
});
