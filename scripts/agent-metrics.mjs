import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import process from "node:process";
import {
  computeMetrics,
  computeSizeCohort,
  isAgentPr,
  normalisePr,
  parseArgs,
  parseIssues,
  renderTable,
} from "./agent-metrics-lib.mjs";

const PR_LIMIT = 1000;
const PAGE = 100;

const QUERY = `query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      timelineItems(first: ${PAGE}, itemTypes: [READY_FOR_REVIEW_EVENT, PULL_REQUEST_COMMIT, ISSUE_COMMENT, PULL_REQUEST_REVIEW]) {
        pageInfo { hasNextPage }
        nodes {
          __typename
          ... on ReadyForReviewEvent { createdAt }
          ... on PullRequestCommit { commit { committedDate } }
          ... on IssueComment { body author { __typename login } }
          ... on PullRequestReview {
            body
            author { __typename login }
            comments(first: ${PAGE}) { pageInfo { hasNextPage } nodes { body author { __typename login } } }
          }
        }
      }
    }
  }
}`;

function gh(args) {
  try {
    return execFileSync("gh", args, {
      encoding: "utf8",
      timeout: 30_000,
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (cause) {
    if (cause?.code === "ENOENT") {
      throw new Error("gh not found: install the GitHub CLI", { cause });
    }
    const firstLine = String(cause?.stderr ?? "").split("\n")[0];
    throw new Error(`gh ${args[0]} failed (run \`gh auth login\` or set GH_TOKEN): ${firstLine}`, {
      cause,
    });
  }
}

function ghJson(args) {
  return JSON.parse(gh(args));
}

function main() {
  const { since, issues: issuesPath } = parseArgs(process.argv.slice(2));
  const repo = ghJson(["repo", "view", "--json", "nameWithOwner"]).nameWithOwner;
  const [owner, name] = repo.split("/");

  const list = ghJson([
    "pr",
    "list",
    "--state",
    "all",
    "--limit",
    String(PR_LIMIT),
    "--json",
    "number,headRefName,createdAt,mergedAt,state,body,url",
  ]);
  if (list.length >= PR_LIMIT) {
    process.stderr.write(`warning: reached the ${PR_LIMIT} PR limit; results may be incomplete\n`);
  }

  const prs = list.filter(isAgentPr).map((item) => {
    const result = ghJson([
      "api",
      "graphql",
      "-f",
      `query=${QUERY}`,
      "-F",
      `owner=${owner}`,
      "-F",
      `name=${name}`,
      "-F",
      `number=${item.number}`,
    ]);
    const items = result?.data?.repository?.pullRequest?.timelineItems;
    if (items?.pageInfo?.hasNextPage) {
      process.stderr.write(
        `warning: PR #${item.number} has more than ${PAGE} timeline items; rounds marked incomplete\n`,
      );
    }
    const normalised = normalisePr(item, items?.nodes, {
      truncated: items?.pageInfo?.hasNextPage === true,
    });
    if (normalised.roundsIncomplete && !items?.pageInfo?.hasNextPage) {
      process.stderr.write(
        `warning: PR #${item.number} has a review with more than ${PAGE} inline comments; rounds marked incomplete\n`,
      );
    }
    return normalised;
  });

  const metrics = computeMetrics(prs, { since });
  if (issuesPath === null) {
    process.stdout.write(renderTable(metrics, { since, repo }));
    return;
  }
  let parsed;
  try {
    parsed = parseIssues(readFileSync(issuesPath, "utf8"));
  } catch (cause) {
    throw new Error(`Cannot read issues file ${issuesPath}: ${cause.message}`, { cause });
  }
  const cohort = computeSizeCohort(prs, parsed.issues, {
    listTruncated: list.length >= PR_LIMIT,
    issuesPartial: parsed.partial,
  });
  process.stdout.write(renderTable(metrics, { since, repo, cohort, milestone: parsed.milestone }));
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
