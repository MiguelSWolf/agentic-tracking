// Gate G5 path classification for agent and audit branches (TRK-37).
// Input is the raw output of `git diff --name-status -M -z`: NUL-delimited, never quoted,
// so spaces, newlines and non-ASCII characters in paths are safe.
// Protected zone itself: this file and guard-paths.mjs decide what an agent may change.

const PROTECTED =
  /^(\.github\/|\.agents\/|\.claude\/|AGENTS\.md$|CLAUDE\.md$|docs\/adr\/|scripts\/linear(-lib)?\.mjs$|scripts\/guard-paths(-lib)?\.mjs$|scripts\/cancel-waiting-ci\.mjs$|docs\/code-standards\/)/;
const MIGRATIONS = /(^|\/)migrations\//;
const AUDIT_ALLOWED = /^docs\/audits\/[^/]+\.(md|json)$/;

// Returns [{ status, path }]. A rename or copy (R/C) yields both its old and its new path.
export function parseNameStatusZ(raw) {
  const fields = raw.split("\0");
  if (fields.at(-1) === "") fields.pop();
  const entries = [];
  for (let i = 0; i < fields.length; ) {
    const status = fields[i][0];
    const pathCount = status === "R" || status === "C" ? 2 : 1;
    for (const path of fields.slice(i + 1, i + 1 + pathCount)) {
      entries.push({ status, path });
    }
    i += 1 + pathCount;
  }
  return entries;
}

// audit/* branches may only touch docs/audits/<file>.md|json. Other (agent) branches: protected paths
// fail on any change, and migrations fail unless the file was added.
export function findViolations(entries, branch = "") {
  const bad = branch.startsWith("audit/")
    ? ({ path }) => !AUDIT_ALLOWED.test(path)
    : ({ status, path }) => PROTECTED.test(path) || (MIGRATIONS.test(path) && status !== "A");
  return entries.filter(bad).map(({ status, path }) => `${status} ${path}`);
}
