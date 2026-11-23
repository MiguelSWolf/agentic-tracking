// Pure logic for `pnpm agent:metrics` (ADR-0011). Never calls `gh`.

const USAGE = "Usage: agent-metrics [--since YYYY-MM-DD]";
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

/** @returns {{ since: string | null }} */
export function parseArgs(argv) {
  let since = null;
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
    } else {
      throw new Error(`Unknown argument "${arg}". ${USAGE}`);
    }
  }
  return { since };
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
  const text = body
    .replace(/^ {0,3}(```|~~~)[^\n]*\n[\s\S]*?(^ {0,3}\1[^\n]*$|(?![\s\S]))/gm, "")
    .replace(/`[^`\n]*`/g, "")
    .split("\n")
    .filter((line) => !/^\s{0,3}>/.test(line))
    .join("\n");
  return TRIGGER.test(text);
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
  };
}

/** @param prs normalised agent PRs */
export function computeMetrics(prs, { since = null } = {}) {
  const from = since === null ? Number.NEGATIVE_INFINITY : Date.parse(`${since}T00:00:00.000Z`);
  const opened = prs.filter((pr) => Date.parse(pr.createdAt) >= from);
  const merged = prs.filter((pr) => pr.mergedAt !== null && Date.parse(pr.mergedAt) >= from);

  const unchanged = merged.filter((pr) =>
    pr.commitDates.every((date) => Date.parse(date) <= Date.parse(pr.readyAt)),
  );

  // A truncated page can hide requests, so the rounds median is withheld, not understated.
  const roundsIncomplete = merged.some((pr) => pr.roundsIncomplete === true);

  return {
    opened: opened.length,
    merged: merged.length,
    mergedUnchangedPct: merged.length === 0 ? null : (unchanged.length / merged.length) * 100,
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

export function renderTable(metrics, { since = null, repo }) {
  const window = since === null ? "all history" : `since ${since}`;
  const rows = [
    ["Agent PRs opened", String(metrics.opened)],
    ["Agent PRs merged", String(metrics.merged)],
    [
      "Merged with no commits after ready-for-review",
      cell(metrics.mergedUnchangedPct, (v) => `${v.toFixed(0)}%`),
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
  ].join("\n");
}
