import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readResult, summarise } from "./run-findings.mjs";

const result = (extra) => ({
  type: "result",
  subtype: "success",
  num_turns: 12,
  permission_denials: [],
  ...extra,
});

describe("summarise", () => {
  it("with a clean successful run, is not finding-worthy", () => {
    const outcome = summarise({ jobStatus: "success", result: result() });

    expect(outcome).toEqual({ worthy: false, reasons: [], denials: [] });
  });

  it("with Claude stopped at the turn cap, reports the subtype", () => {
    const outcome = summarise({
      jobStatus: "failure",
      result: result({ subtype: "error_max_turns", num_turns: 32 }),
    });

    expect(outcome.worthy).toBe(true);
    expect(outcome.reasons).toEqual(["job failure", "claude error_max_turns"]);
  });

  it("with denied tool calls in a successful run, reports them", () => {
    const denials = [{ tool_name: "Bash", tool_input: { command: "pnpm test" } }];

    const outcome = summarise({
      jobStatus: "success",
      result: result({ permission_denials: denials }),
    });

    expect(outcome.worthy).toBe(true);
    expect(outcome.reasons).toEqual(["1 denied tool call(s)"]);
    expect(outcome.denials).toEqual(denials);
  });

  it("with a failed job and no execution file, reports the job status", () => {
    const outcome = summarise({ jobStatus: "failure", result: null });

    expect(outcome.reasons).toEqual(["job failure"]);
  });
});

describe("readResult", () => {
  it("with an execution file, returns the last result message", () => {
    const dir = mkdtempSync(join(tmpdir(), "run-findings-"));
    const file = join(dir, "execution.json");
    writeFileSync(
      file,
      JSON.stringify([{ type: "system" }, { type: "assistant" }, result({ num_turns: 7 })]),
    );

    expect(readResult(file)).toMatchObject({ type: "result", num_turns: 7 });
  });

  it("with no file, returns null", () => {
    expect(readResult("/nonexistent/execution.json")).toBeNull();
  });

  it("with malformed JSON, throws with the file name", () => {
    const dir = mkdtempSync(join(tmpdir(), "run-findings-"));
    const file = join(dir, "execution.json");
    writeFileSync(file, "{not json");

    expect(() => readResult(file)).toThrow(/Cannot parse execution file/);
  });
});
