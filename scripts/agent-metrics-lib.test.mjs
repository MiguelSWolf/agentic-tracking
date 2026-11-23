import { describe, expect, it } from "vitest";
import {
  computeMetrics,
  hasClaudeRequest,
  isAgentPr,
  median,
  normalisePr,
  parseArgs,
  renderTable,
} from "./agent-metrics-lib.mjs";

const pr = (overrides) => ({
  number: 18,
  createdAt: "2026-11-20T10:00:00Z",
  mergedAt: "2026-11-20T14:00:00Z",
  readyAt: "2026-11-20T10:00:00Z",
  commitDates: ["2026-11-20T09:30:00Z"],
  claudeRounds: 0,
  ...overrides,
});

describe("parseArgs", () => {
  it("given --since with a space, returns the date", () => {
    expect(parseArgs(["--since", "2026-11-01"])).toEqual({ since: "2026-11-01" });
  });

  it("given --since=value, returns the date", () => {
    expect(parseArgs(["--since=2026-11-01"])).toEqual({ since: "2026-11-01" });
  });

  it("given no arguments, returns a null since", () => {
    expect(parseArgs([])).toEqual({ since: null });
  });

  it("given an impossible date, throws", () => {
    expect(() => parseArgs(["--since", "2026-13-40"])).toThrow(/Invalid --since/);
  });

  it("given a missing value, throws", () => {
    expect(() => parseArgs(["--since"])).toThrow(/Missing value/);
  });

  it("given an unknown flag, throws", () => {
    expect(() => parseArgs(["--foo"])).toThrow(/Unknown argument/);
  });
});

describe("isAgentPr", () => {
  it("given an agent/ branch, returns true", () => {
    expect(isAgentPr({ headRefName: "agent/trk-9-agent-metrics" })).toBe(true);
  });

  it.each(["main", "audit/m0", "feature/agent/x"])("given %s, returns false", (name) => {
    expect(isAgentPr({ headRefName: name })).toBe(false);
  });
});

describe("median", () => {
  it("given an odd count, returns the middle value", () => {
    expect(median([5, 1, 3])).toBe(3);
  });

  it("given an even count, returns the mean of the middle two", () => {
    expect(median([1, 2, 3, 10])).toBe(2.5);
  });

  it("given an empty list, returns null", () => {
    expect(median([])).toBeNull();
  });
});

describe("computeMetrics counts", () => {
  const prs = [
    pr({ number: 17, createdAt: "2026-10-30T10:00:00Z", mergedAt: "2026-11-02T10:00:00Z" }),
    pr({ number: 18 }),
    pr({ number: 19, mergedAt: null }),
  ];

  it("given no since, counts all opened and merged PRs", () => {
    const m = computeMetrics(prs);
    expect([m.opened, m.merged]).toEqual([3, 2]);
  });

  it("given since, filters opened by createdAt and merged by mergedAt", () => {
    const m = computeMetrics(prs, { since: "2026-11-02" });
    expect([m.opened, m.merged]).toEqual([2, 2]);
  });
});

describe("computeMetrics merged unchanged", () => {
  it("given a commit before ready, counts the PR as unchanged", () => {
    const m = computeMetrics([pr({ readyAt: "2026-11-20T10:00:00Z" })]);
    expect(m.mergedUnchangedPct).toBe(100);
  });

  it("given an owner commit after ready, counts the PR as changed", () => {
    const m = computeMetrics([
      pr({ number: 17, commitDates: ["2026-11-20T09:30:00Z", "2026-11-20T12:00:00Z"] }),
      pr({ number: 18 }),
    ]);
    expect(m.mergedUnchangedPct).toBe(50);
  });

  it("given nothing merged, returns null", () => {
    expect(computeMetrics([pr({ mergedAt: null })]).mergedUnchangedPct).toBeNull();
  });
});

describe("computeMetrics durations and rounds", () => {
  it("given merged PRs, returns median draft to merge hours", () => {
    const m = computeMetrics([
      pr({ number: 1, mergedAt: "2026-11-20T12:00:00Z" }),
      pr({ number: 2, mergedAt: "2026-11-20T16:00:00Z" }),
    ]);
    expect(m.medianDraftToMergeHours).toBe(4);
  });

  it("given zero-round PRs among merged, includes them in the median", () => {
    const m = computeMetrics([
      pr({ number: 1, claudeRounds: 0 }),
      pr({ number: 2, claudeRounds: 0 }),
      pr({ number: 3, claudeRounds: 4 }),
    ]);
    expect(m.medianClaudeRounds).toBe(0);
  });
});

describe("normalisePr", () => {
  const item = {
    number: 19,
    headRefName: "agent/trk-20-testing-rules",
    createdAt: "2026-11-20T10:00:00Z",
    mergedAt: "2026-11-20T14:00:00Z",
  };
  const human = { __typename: "User", login: "miguelwolf" };
  const bot = { __typename: "Bot", login: "coderabbitai[bot]" };

  it("given a never-draft PR, uses createdAt as ready time", () => {
    expect(normalisePr(item, []).readyAt).toBe(item.createdAt);
  });

  it("given two ready events, uses the first", () => {
    const n = normalisePr(item, [
      { __typename: "ReadyForReviewEvent", createdAt: "2026-11-20T12:00:00Z" },
      { __typename: "ReadyForReviewEvent", createdAt: "2026-11-20T11:00:00Z" },
    ]);
    expect(n.readyAt).toBe("2026-11-20T11:00:00Z");
  });

  it("given comments, reviews and bots, counts trigger events once each", () => {
    const n = normalisePr(item, [
      { __typename: "IssueComment", body: "@claude fix lint", author: human },
      { __typename: "IssueComment", body: "@claude please", author: bot },
      { __typename: "IssueComment", body: "looks good", author: human },
      {
        __typename: "PullRequestReview",
        body: "",
        author: human,
        comments: {
          nodes: [
            { body: "@claude a", author: human },
            { body: "@claude b", author: human },
            { body: "@claude c", author: human },
          ],
        },
      },
    ]);
    expect(n.claudeRounds).toBe(2);
  });

  it("given commits, collects their committed dates", () => {
    const n = normalisePr(item, [
      { __typename: "PullRequestCommit", commit: { committedDate: "2026-11-20T13:00:00Z" } },
    ]);
    expect(n.commitDates).toEqual(["2026-11-20T13:00:00Z"]);
  });

  it("given a missing timeline, throws", () => {
    expect(() => normalisePr(item, undefined)).toThrow(/timeline/);
  });

  it("given a malformed mergedAt, throws", () => {
    expect(() => normalisePr({ ...item, mergedAt: 5 }, [])).toThrow(/mergedAt/);
  });
});

describe("hasClaudeRequest", () => {
  it.each([
    ["a plain mention", "@claude fix the lint error", true],
    ["a mention after text", "Thanks. @claude, please retry.", true],
    ["a mention in a code fence", "Use:\n```\n@claude fix\n```", false],
    ["a mention in inline code", "Comment `@claude fix` to trigger", false],
    ["a quoted mention", "> @claude fix lint\nlooks fine", false],
    ["a bold mention", "**@claude** fix", false],
    ["a link-formatted mention", "[@claude](https://x.test)", false],
    ["a longer handle", "@claude-bot please", false],
    ["a handle with a suffix", "@claudette hi", false],
    ["an email-like prefix", "me@claude.test", false],
  ])("given %s, returns the expected result", (_name, body, expected) => {
    expect(hasClaudeRequest(body)).toBe(expected);
  });
});

describe("rounds completeness", () => {
  const item = {
    number: 19,
    createdAt: "2026-11-20T10:00:00Z",
    mergedAt: "2026-11-20T14:00:00Z",
  };
  const human = { __typename: "User", login: "miguelwolf" };
  const review = (hasNextPage) => ({
    __typename: "PullRequestReview",
    body: "",
    author: human,
    comments: { pageInfo: { hasNextPage }, nodes: [{ body: "nit", author: human }] },
  });

  it("given a review with more inline comment pages, marks rounds incomplete", () => {
    expect(normalisePr(item, [review(true)]).roundsIncomplete).toBe(true);
  });

  it("given a truncated timeline, marks rounds incomplete", () => {
    expect(normalisePr(item, [], { truncated: true }).roundsIncomplete).toBe(true);
  });

  it("given complete pages, marks rounds complete", () => {
    expect(normalisePr(item, [review(false)]).roundsIncomplete).toBe(false);
  });

  it("given an incomplete merged PR, withholds the rounds median", () => {
    const m = computeMetrics([pr({ claudeRounds: 1, roundsIncomplete: true })]);
    expect(m.medianClaudeRounds).toBeNull();
    expect(m.claudeRoundsIncomplete).toBe(true);
  });

  it("given an incomplete result, renders the rounds as incomplete", () => {
    const m = computeMetrics([pr({ roundsIncomplete: true })]);
    expect(renderTable(m, { repo: "o/r" })).toContain("n/a (incomplete: GitHub data truncated)");
  });
});

describe("renderTable", () => {
  it("given empty values, renders n/a in a markdown table", () => {
    const table = renderTable(
      {
        opened: 1,
        merged: 0,
        mergedUnchangedPct: null,
        medianClaudeRounds: null,
        medianDraftToMergeHours: null,
      },
      { since: "2026-11-01", repo: "acme/agentic-tracking" },
    );
    expect(table).toBe(
      [
        "### Agent calibration metrics: acme/agentic-tracking (since 2026-11-01)",
        "",
        "| Metric | Value |",
        "| --- | --- |",
        "| Agent PRs opened | 1 |",
        "| Agent PRs merged | 0 |",
        "| Merged with no commits after ready-for-review | n/a |",
        "| Median `@claude` rounds per merged PR | n/a |",
        "| Median draft to merge (hours) | n/a |",
        "",
      ].join("\n"),
    );
  });
});

describe("hasClaudeRequest fences", () => {
  it("given a shorter fence inside a longer fence, ignores the mention in the block", () => {
    const body = "````md\n```\n@claude fix\n````\nthanks";
    expect(hasClaudeRequest(body)).toBe(false);
  });

  it("given a mention after the longer fence closes, counts it", () => {
    expect(hasClaudeRequest("````md\n```\n````\n@claude fix this")).toBe(true);
  });
});

describe("timeline truncation", () => {
  const item = { number: 17, createdAt: "2026-11-20T10:00:00Z", mergedAt: "2026-11-20T14:00:00Z" };

  it("given a truncated outer timeline, withholds the unchanged percentage", () => {
    const m = computeMetrics([pr({ timelineIncomplete: true })]);
    expect(m.mergedUnchangedPct).toBeNull();
    expect(renderTable(m, { repo: "o/r" })).toContain(
      "| Merged with no commits after ready-for-review | n/a (incomplete: GitHub data truncated) |",
    );
  });

  it("given only inline-comment truncation, keeps the unchanged percentage", () => {
    const m = computeMetrics([pr({ roundsIncomplete: true, timelineIncomplete: false })]);
    expect(m.mergedUnchangedPct).toBe(100);
  });

  it("given a truncated timeline, normalisePr flags the timeline", () => {
    expect(normalisePr(item, [], { truncated: true }).timelineIncomplete).toBe(true);
  });

  it("given nested comment truncation only, normalisePr does not flag the timeline", () => {
    const review = {
      __typename: "PullRequestReview",
      body: "",
      author: { __typename: "User", login: "owner" },
      comments: { pageInfo: { hasNextPage: true }, nodes: [] },
    };
    const n = normalisePr(item, [review]);
    expect(n.roundsIncomplete).toBe(true);
    expect(n.timelineIncomplete).toBe(false);
  });
});
