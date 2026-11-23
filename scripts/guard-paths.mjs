// Usage: git diff --name-status -M -z <range> | node scripts/guard-paths.mjs
import { readFileSync } from "node:fs";
import { findViolations, parseNameStatusZ } from "./guard-paths-lib.mjs";

const bad = findViolations(parseNameStatusZ(readFileSync(0, "utf8")));
if (bad.length > 0) {
  console.log("::error::Protected paths changed by an agent branch:");
  console.log(bad.join("\n"));
  process.exit(1);
}
