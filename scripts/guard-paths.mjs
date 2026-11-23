// Usage: git diff --name-status -M -z <range> | node scripts/guard-paths.mjs <branch>
// Exits 1 and lists the offending entries when the branch changes a path it may not (G5).
import { readFileSync } from "node:fs";
import { findViolations, parseNameStatusZ } from "./guard-paths-lib.mjs";

const branch = process.argv[2] ?? "";
const bad = findViolations(parseNameStatusZ(readFileSync(0, "utf8")), branch);
if (bad.length > 0) {
  console.log(`::error::Paths ${branch} may not change (G5):`);
  console.log(bad.join("\n"));
  process.exit(1);
}
console.log(`G5: no protected path changed by ${branch}.`);
