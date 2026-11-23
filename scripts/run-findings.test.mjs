import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isExpectedDenial, readResult, summarise } from "./run-findings.mjs";

const ROOT = "/work/repo";

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

    expect(outcome).toEqual({ worthy: false, reasons: [], denials: [], expected: [] });
  });

  it("with only expected denials, is not finding-worthy and keeps them", () => {
    const expected = [
      { tool_name: "Bash", tool_input: { command: "git reset --hard FETCH_HEAD" } },
    ];

    const outcome = summarise({
      jobStatus: "success",
      result: result({ permission_denials: expected }),
      cwd: ROOT,
    });

    expect(outcome.worthy).toBe(false);
    expect(outcome.reasons).toEqual([]);
    expect(outcome.denials).toEqual([]);
    expect(outcome.expected).toEqual(expected);
  });

  it("with expected and unexpected denials, reports both counts", () => {
    const expected = {
      tool_name: "Write",
      tool_input: { file_path: `${ROOT}/scripts/linear.mjs` },
    };
    const unexpected = { tool_name: "Bash", tool_input: { command: "cat .env.example" } };

    const outcome = summarise({
      jobStatus: "success",
      result: result({ permission_denials: [expected, unexpected] }),
      cwd: ROOT,
    });

    expect(outcome.worthy).toBe(true);
    expect(outcome.reasons).toEqual(["1 denied tool call(s)", "1 expected denial(s)"]);
    expect(outcome.denials).toEqual([unexpected]);
    expect(outcome.expected).toEqual([expected]);
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

const bash = (command) => ({ tool_name: "Bash", tool_input: { command } });

describe("isExpectedDenial", () => {
  it("with a Write on an absolute protected path, is expected", () => {
    const denial = {
      tool_name: "Write",
      tool_input: { file_path: `${ROOT}/scripts/linear-lib.mjs` },
    };

    expect(isExpectedDenial(denial, ROOT)).toBe(true);
  });

  it("with an Edit on a non-protected path, is not expected", () => {
    const denial = { tool_name: "Edit", tool_input: { file_path: `${ROOT}/docs/specs/README.md` } };

    expect(isExpectedDenial(denial, ROOT)).toBe(false);
  });

  it("with a shell redirect into a protected file, is expected", () => {
    expect(isExpectedDenial(bash("cat > scripts/linear-lib.mjs"), ROOT)).toBe(true);
  });

  it("with a python rewrite of a protected file, is expected", () => {
    expect(isExpectedDenial(bash("python3 rewrite.py scripts/linear-lib.mjs"), ROOT)).toBe(true);
  });

  it("with git reset --hard, is expected", () => {
    expect(isExpectedDenial(bash("git reset --hard FETCH_HEAD"), ROOT)).toBe(true);
  });

  it("with reading .env.example, is not expected", () => {
    expect(isExpectedDenial(bash("cat .env.example"), ROOT)).toBe(false);
  });

  it("with gh pr list, is not expected", () => {
    expect(isExpectedDenial(bash("gh pr list --state merged"), ROOT)).toBe(false);
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
