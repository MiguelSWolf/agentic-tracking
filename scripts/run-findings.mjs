#!/usr/bin/env node
// Turns an agent run into a finding candidate (docs/workflow/findings.md).
// Reads the claude-code-action execution file and decides whether the run
// hit a process gap: the job failed, Claude ended with an error subtype
// (max turns, execution error), or a tool call was denied.
//
//   node scripts/run-findings.mjs --workflow <name> --target <TRK-n|PR #n> --run-url <url>
//                                 --job-status <success|failure|cancelled>
//                                 [--execution <file>] --out <file.md>
//
// When the run is finding-worthy it writes <out> (the issue body) and <out>.title.
// Otherwise it writes nothing. It always exits 0, so it never masks the real job result.

import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { findViolations } from "./guard-paths-lib.mjs";

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key?.startsWith("--") || value === undefined) {
      throw new Error(`Bad argument near "${key}". See the header of run-findings.mjs.`);
    }
    opts[key.slice(2)] = value;
  }
  for (const required of ["workflow", "target", "run-url", "job-status", "out"]) {
    if (!opts[required]) throw new Error(`Missing --${required}`);
  }
  return opts;
}

export function readResult(file) {
  if (!file || !existsSync(file)) return null;
  let messages;
  try {
    messages = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`Cannot parse execution file ${file}`, { cause: error });
  }
  if (!Array.isArray(messages)) return null;
  return messages.findLast((m) => m?.type === "result") ?? null;
}

const FILE_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);
const DESTRUCTIVE_COMMANDS = [
  /\bgit\s+reset\s+--hard\b/,
  /\bgit\s+push\b/,
  /\bgh\s+pr\s+(merge|ready)\b/,
];

function isProtectedPath(path) {
  return findViolations([{ status: "M", path }]).length > 0;
}

// An expected denial is a guard doing its job: a write to a protected zone (G5) or a
// destructive or publishing git/gh command. It is counted, not turned into a finding issue.
// Bash matching is token based: a command that only mentions a protected path also matches.
export function isExpectedDenial(denial, cwd = process.cwd()) {
  const input = denial?.tool_input ?? {};
  if (FILE_TOOLS.has(denial?.tool_name)) {
    const file = input.file_path ?? input.notebook_path;
    if (typeof file !== "string") return false;
    return isProtectedPath(relative(cwd, resolve(cwd, file)));
  }
  if (denial?.tool_name === "Bash" && typeof input.command === "string") {
    const command = input.command;
    if (DESTRUCTIVE_COMMANDS.some((re) => re.test(command))) return true;
    return command
      .split(/[\s"'`<>|;&()=]+/)
      .filter(Boolean)
      .some((token) => isProtectedPath(token.replace(/^\.\//, "")));
  }
  return false;
}

export function summarise({ jobStatus, result, cwd }) {
  const reasons = [];
  if (jobStatus !== "success") reasons.push(`job ${jobStatus}`);
  if (result?.subtype && result.subtype !== "success") reasons.push(`claude ${result.subtype}`);
  const all = Array.isArray(result?.permission_denials) ? result.permission_denials : [];
  const expected = all.filter((d) => isExpectedDenial(d, cwd));
  const denials = all.filter((d) => !expected.includes(d));
  if (denials.length > 0) reasons.push(`${denials.length} denied tool call(s)`);
  const worthy = reasons.length > 0;
  if (worthy && expected.length > 0) reasons.push(`${expected.length} expected denial(s)`);
  return { worthy, reasons, denials, expected };
}

function denialLine(d) {
  const tool = d?.tool_name ?? "unknown tool";
  const input = d?.tool_input ? JSON.stringify(d.tool_input).slice(0, 160) : "";
  return `- \`${tool}\` ${input ? `\`${input}\`` : ""}`.trimEnd();
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = readResult(opts.execution);
  const { worthy, reasons, denials, expected } = summarise({
    jobStatus: opts["job-status"],
    result,
  });
  if (expected.length > 0) {
    const line = `Expected denials in ${opts.workflow} on ${opts.target} (${opts["run-url"]}): ${expected.length}\n${expected.map(denialLine).join("\n")}\n`;
    writeFileSync(`${opts.out}.expected`, line);
    console.log(`run-findings: ${expected.length} expected denial(s), counted without an issue`);
    if (process.env.GITHUB_STEP_SUMMARY)
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${line}\n`);
  }
  if (!worthy) {
    console.log("run-findings: nothing to record");
    return;
  }
  const title = `[finding] ${opts.workflow} on ${opts.target}: ${reasons.join(", ")}`;
  const body = `A ${opts.workflow} run on ${opts.target} hit a possible process gap. It was recorded automatically (docs/workflow/findings.md).

- **Run:** ${opts["run-url"]}
- **Signals:** ${reasons.join("; ")}
- **Claude:** subtype \`${result?.subtype ?? "n/a"}\`, ${result?.num_turns ?? "?"} turns${result?.is_error ? ", is_error" : ""}

${denials.length ? `## Denied tool calls\n\n${denials.slice(0, 10).map(denialLine).join("\n")}\n` : ""}${expected.length ? `\n## Expected denials (protected zone / destructive git)\n\n${expected.slice(0, 10).map(denialLine).join("\n")}\n` : ""}
## Next

The milestone retro imports this issue as \`docs/retros/<milestone>/findings/F-NNN-*.md\` and decides whether to fix it, accept it or mark it already fixed. If this was an expected stop (for example a blocking question in the plan), cancel the issue with a short reason.
`;
  writeFileSync(opts.out, body);
  writeFileSync(`${opts.out}.title`, title);
  console.log(`run-findings: ${title}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (error) {
    console.error(`run-findings: ${error instanceof Error ? error.message : String(error)}`);
  }
}
