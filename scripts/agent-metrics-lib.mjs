// Pure logic for `pnpm agent:metrics` (ADR-0011). Never calls `gh`.

const USAGE = "Usage: agent-metrics [--since YYYY-MM-DD] [--issues <retro-inputs.md>]";
const HOUR_MS = 3_600_000;

function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid --since date "${value}". ${USAGE}`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid --since date "${value}". ${USAGE}`);
  }
  return value;
}

/** @returns {{ since: string | null, issues: string | null }} */
export function parseArgs(argv) {
  let since = null;
  let issues = null;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--since") {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error(`Missing value for --since. ${USAGE}`);
      }
      since = parseDate(value);
      i += 1;
    } else if (arg.startsWith("--since=")) {
      since = parseDate(arg.slice("--since=".length));
    } else if (arg === "--issues") {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error(`Missing value for --issues. ${USAGE}`);
      }
      issues = value;
      i += 1;
    } else if (arg.startsWith("--issues=")) {
      issues = arg.slice("--issues=".length);
      if (issues === "") throw new Error(`Missing value for --issues. ${USAGE}`);
    } else {
      throw new Error(`Unknown argument "${arg}". ${USAGE}`);
    }
  }
  return { since, issues };
}

export function isAgentPr(pr) {
  return typeof pr.headRefName === "string" && pr.headRefName.startsWith("agent/");
}

export function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function requireString(value, field, number) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new Error(`PR #${number}: expected ISO date in "${field}", got ${JSON.stringify(value)}`);
  }
  return value;
}

function isBot(author) {
  if (author === null || author === undefined) return false;
  return author.__typename === "Bot" || String(author.login ?? "").endsWith("[bot]");
}

// Only plain-text, standalone `@claude` mentions trigger the agent. Fenced and inline code,
// quoted lines, formatted mentions (`**@claude**`, `[@claude]`) and longer handles
// (`@claude-bot`, `@claudette`) do not.
const TRIGGER = /(?<![\w@/.*_`[\]-])@claude(?![\w\-*_`[\]/@])/;

export function hasClaudeRequest(body) {
  if (typeof body !== "string") return false;
  const text = stripFencedCode(body)
    .replace(/`[^`\n]*`/g, "")
    .split("\n")
    .filter((line) => !/^\s{0,3}>/.test(line))
    .join("\n");
  return TRIGGER.test(text);
}

// CommonMark: a fence closes only on the same character with at least the opening length.
function stripFencedCode(body) {
  const kept = [];
  let open = null;
  for (const line of body.split("\n")) {
    if (open === null) {
      const m = /^ {0,3}(`{3,}|~{3,})/.exec(line);
      if (m) open = { char: m[1][0], length: m[1].length };
      else kept.push(line);
    } else {
      const m = /^ {0,3}(`{3,}|~{3,})\s*$/.exec(line);
      if (m && m[1][0] === open.char && m[1].length >= open.length) open = null;
    }
  }
  return kept.join("\n");
}

function mentionsClaude(item) {
  return !isBot(item.author) && hasClaudeRequest(item.body);
}

/**
 * Turns raw `gh` JSON into the shape computeMetrics needs.
 * @param listItem one item of `gh pr list --json number,createdAt,mergedAt,...`
 * @param timeline array of GraphQL timeline nodes (with __typename)
 * @param options `truncated`: the timeline has more pages than were read
 */
export function normalisePr(listItem, timeline, { truncated = false } = {}) {
  const number = listItem?.number;
  if (!Number.isInteger(number)) {
    throw new Error("PR list item has no integer number");
  }
  if (!Array.isArray(timeline)) {
    throw new Error(`PR #${number}: timeline is not an array`);
  }
  const createdAt = requireString(listItem.createdAt, "createdAt", number);
  const mergedAt =
    listItem.mergedAt === null || listItem.mergedAt === undefined
      ? null
      : requireString(listItem.mergedAt, "mergedAt", number);

  let readyAt = null;
  const commitDates = [];
  let claudeRounds = 0;
  const timelineIncomplete = truncated;
  let roundsIncomplete = truncated;
  for (const node of timeline) {
    switch (node?.__typename) {
      case "ReadyForReviewEvent": {
        const at = requireString(node.createdAt, "ReadyForReviewEvent.createdAt", number);
        if (readyAt === null || Date.parse(at) < Date.parse(readyAt)) readyAt = at;
        break;
      }
      case "PullRequestCommit":
        commitDates.push(requireString(node.commit?.committedDate, "commit.committedDate", number));
        break;
      case "IssueComment":
        if (mentionsClaude(node)) claudeRounds += 1;
        break;
      case "PullRequestReview": {
        const inline = node.comments?.nodes ?? [];
        if (node.comments?.pageInfo?.hasNextPage) roundsIncomplete = true;
        if (mentionsClaude(node) || inline.some(mentionsClaude)) claudeRounds += 1;
        break;
      }
      default:
        break;
    }
  }
  return {
    number,
    createdAt,
    mergedAt,
    readyAt: readyAt ?? createdAt,
    commitDates,
    claudeRounds,
    roundsIncomplete,
    timelineIncomplete,
    fixes: fixesRefs(listItem.body),
    url: typeof listItem.url === "string" ? listItem.url : null,
  };
}

/**
 * Distinct `TRK-n` ids from closing lines in a PR body. A closing line is a whole line
 * `Fixes TRK-n` (PR template convention). Fenced code, blockquotes and inline examples are ignored.
 */
export function fixesRefs(body) {
  if (typeof body !== "string") return [];
  const ids = new Set();
  for (const line of stripFencedCode(body).split("\n")) {
    const m = /^fixes\s+(TRK-\d+)\s*\.?\s*$/i.exec(line.trim());
    if (m !== null) ids.add(m[1].toUpperCase());
  }
  return [...ids];
}

/** The Linear exporter reads one page of this size (`issues(first: 250)`), so a full page may be partial. */
export const EXPORT_PAGE_SIZE = 250;

/**
 * Reads the file `linear.mjs retro-export` writes (`.agent-out/retro-inputs.md`).
 * @returns {{ milestone: string, issues: Map<string, string | null> }} TRK id to size label
 */
export function parseIssues(markdown) {
  const heading = /^# Retro inputs: (.+)$/m.exec(markdown);
  if (heading === null) throw new Error('Issues file has no "# Retro inputs: <milestone>" heading');
  const start = markdown.indexOf("## Milestone issues");
  if (start === -1) throw new Error('Issues file has no "## Milestone issues" table');
  const rest = markdown.slice(start + "## Milestone issues".length);
  const end = rest.search(/^## /m);
  const section = end === -1 ? rest : rest.slice(0, end);
  const issues = new Map();
  for (const line of section.split("\n")) {
    const m = /^\|\s*(TRK-\d+)\s*\|.*\|([^|]*)\|\s*$/.exec(line);
    if (m === null) continue;
    const size = /(?:^|[\s,])(size:[SML])(?=$|[\s,])/.exec(m[2]);
    issues.set(m[1], size === null ? null : size[1]);
  }
  if (issues.size === 0) throw new Error("Issues file has no issue rows in the milestone table");
  // The exporter writes "Export complete: true|false" (TRK-25). Older exports without the line fall back
  // to the page-size heuristic.
  const marker = markdown.match(/^Export complete: (true|false)$/m)?.[1];
  const partial = marker === undefined ? issues.size >= EXPORT_PAGE_SIZE : marker === "false";
  return { milestone: heading[1].trim(), issues, partial };
}

function isUnchanged(pr) {
  return pr.commitDates.every((date) => Date.parse(date) <= Date.parse(pr.readyAt));
}

/**
 * The `size:S` cohort of merged agent PRs for one milestone (ADR-0011).
 * @param prs normalised agent PRs
 * @param issues `parseIssues(...).issues`
 */
export function computeSizeCohort(
  prs,
  issues,
  { listTruncated = false, issuesPartial = false } = {},
) {
  const reasons = [];
  const counted = [];
  const covered = new Set();
  for (const pr of prs.filter((p) => p.mergedAt !== null)) {
    const refs = pr.fixes ?? [];
    if (refs.length === 0) {
      reasons.push(`PR #${pr.number} has no "Fixes TRK-n" reference`);
      continue;
    }
    if (refs.length > 1) {
      reasons.push(`PR #${pr.number} references several issues (${refs.join(", ")})`);
      continue;
    }
    const [id] = refs;
    if (!issues.has(id)) continue;
    covered.add(id);
    const size = issues.get(id);
    if (size === null) {
      reasons.push(`${id} (PR #${pr.number}) has no size label`);
      continue;
    }
    if (size !== "size:S") continue;
    if (pr.timelineIncomplete === true) {
      reasons.push(`PR #${pr.number} timeline is truncated`);
      continue;
    }
    counted.push({
      number: pr.number,
      url: pr.url ?? `#${pr.number}`,
      issue: id,
      unchanged: isUnchanged(pr),
    });
  }
  if (listTruncated) reasons.push("the PR list hit its cap");
  if (issuesPartial)
    reasons.push("the issues export may be partial, so milestone membership is unknown");
  const unmatched = [...issues].filter(([id, size]) => size === "size:S" && !covered.has(id));
  return {
    complete: reasons.length === 0,
    reasons,
    numerator: counted.filter((c) => c.unchanged).length,
    denominator: counted.length,
    counted,
    sizeSWithoutPr: unmatched.map(([id]) => id),
  };
}

/** @param prs normalised agent PRs */
export function computeMetrics(prs, { since = null } = {}) {
  const from = since === null ? Number.NEGATIVE_INFINITY : Date.parse(`${since}T00:00:00.000Z`);
  const opened = prs.filter((pr) => Date.parse(pr.createdAt) >= from);
  const merged = prs.filter((pr) => pr.mergedAt !== null && Date.parse(pr.mergedAt) >= from);

  const unchanged = merged.filter(isUnchanged);

  // A truncated outer timeline can hide a post-ready commit or the first ready event.
  const unchangedIncomplete = merged.some((pr) => pr.timelineIncomplete === true);

  // A truncated page can hide requests, so the rounds median is withheld, not understated.
  const roundsIncomplete = merged.some((pr) => pr.roundsIncomplete === true);

  return {
    opened: opened.length,
    merged: merged.length,
    mergedUnchangedPct:
      merged.length === 0 || unchangedIncomplete ? null : (unchanged.length / merged.length) * 100,
    mergedUnchangedIncomplete: unchangedIncomplete,
    medianClaudeRounds: roundsIncomplete ? null : median(merged.map((pr) => pr.claudeRounds)),
    claudeRoundsIncomplete: roundsIncomplete,
    medianDraftToMergeHours: median(
      merged.map((pr) => (Date.parse(pr.mergedAt) - Date.parse(pr.createdAt)) / HOUR_MS),
    ),
  };
}

function cell(value, format) {
  return value === null ? "n/a" : format(value);
}

function renderCohort(cohort, milestone) {
  const lines = [`#### \`size:S\` merged unchanged: ${milestone}`, ""];
  if (!cohort.complete) {
    lines.push(`n/a (incomplete: ${cohort.reasons.join("; ")})`);
  } else if (cohort.denominator === 0) {
    lines.push("n/a (no merged size:S agent PRs)");
  } else {
    const pct = ((cohort.numerator / cohort.denominator) * 100).toFixed(0);
    lines.push(`${cohort.numerator} of ${cohort.denominator} (${pct}%)`);
  }
  if (cohort.counted.length > 0) {
    const list = cohort.counted
      .map((c) => `${c.url} (${c.issue}, ${c.unchanged ? "unchanged" : "changed"})`)
      .join(", ");
    lines.push("", `PRs counted: ${list}`);
  }
  if (cohort.sizeSWithoutPr.length > 0) {
    lines.push(
      "",
      `\`size:S\` issues with no merged agent PR: ${cohort.sizeSWithoutPr.join(", ")}`,
    );
  }
  lines.push("");
  return lines;
}

export function renderTable(metrics, { since = null, repo, cohort = null, milestone = "" }) {
  const window = since === null ? "all history" : `since ${since}`;
  const rows = [
    ["Agent PRs opened", String(metrics.opened)],
    ["Agent PRs merged", String(metrics.merged)],
    [
      "Merged with no commits after ready-for-review",
      metrics.mergedUnchangedIncomplete === true
        ? "n/a (incomplete: GitHub data truncated)"
        : cell(metrics.mergedUnchangedPct, (v) => `${v.toFixed(0)}%`),
    ],
    [
      "Median `@claude` rounds per merged PR",
      metrics.claudeRoundsIncomplete === true
        ? "n/a (incomplete: GitHub data truncated)"
        : cell(metrics.medianClaudeRounds, (v) => String(v)),
    ],
    ["Median draft to merge (hours)", cell(metrics.medianDraftToMergeHours, (v) => v.toFixed(1))],
  ];
  return [
    `### Agent calibration metrics: ${repo} (${window})`,
    "",
    "| Metric | Value |",
    "| --- | --- |",
    ...rows.map(([name, value]) => `| ${name} | ${value} |`),
    "",
    ...(cohort === null ? [] : renderCohort(cohort, milestone)),
  ].join("\n");
}
