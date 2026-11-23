#!/usr/bin/env node
// Deterministic Linear bridge for CI. The model never sees LINEAR_API_KEY:
// workflows call this script before/after the agent runs.
//
//   node scripts/linear.mjs get <TRK-n> <out.md>          issue + comments → markdown for the prompt
//   node scripts/linear.mjs pr-context <TRK-n> <out.md>   collapsed issue + plan + owner feedback for the PR body
//   node scripts/linear.mjs require-label <TRK-n> <label> exit 1 if the label is missing (gate G1)
//   node scripts/linear.mjs comment <TRK-n> <file.md>      post file contents as a comment
//   node scripts/linear.mjs audit-import <audit.json>      create one Triage issue per finding (gate G4)
//   node scripts/linear.mjs finding <title.txt> <body.md> [TRK-n]  open a source:finding issue in TRK-n's milestone,
//                                                          or comment on the open one
//                                                          with the same title (docs/workflow/findings.md)
//   node scripts/linear.mjs closing-issue < body.md       print the TRK-n a PR body closes (Fixes/Closes/Resolves)
//   node scripts/linear.mjs retro-export <TRK-n> <out.md>  milestone issues + source:finding issues for the retro skill

import { readFileSync, writeFileSync } from "node:fs";
import {
  closingIssue,
  findingsForMilestone,
  formatParentSection,
  importAudit,
  isAutomatedComment,
} from "./linear-lib.mjs";

const API = "https://api.linear.app/graphql";
const KEY = process.env.LINEAR_API_KEY;
const TEAM_KEY = process.env.LINEAR_TEAM_KEY ?? "TRK";
const AUDIT_LABEL = "source:audit";
const FINDING_LABEL = "source:finding";

if (!KEY) fail("LINEAR_API_KEY is not set");

async function gql(query, variables = {}) {
  const res = await fetch(API, {
    method: "POST",
    // Personal API keys go in Authorization without "Bearer".
    headers: { "Content-Type": "application/json", Authorization: KEY },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) fail(`Linear API error: ${JSON.stringify(json.errors ?? json)}`);
  return json.data;
}

function fail(msg) {
  console.error(`linear.mjs: ${msg}`);
  process.exit(1);
}

async function getIssue(id) {
  const data = await gql(
    `query($id: String!) {
      issue(id: $id) {
        id identifier title description url branchName
        labels { nodes { name } }
        comments(first: 50) { nodes { body createdAt user { name } } }
        parent {
          identifier title description
          comments(first: 50) { nodes { body createdAt user { name } } }
        }
      }
    }`,
    { id },
  );
  if (!data.issue) fail(`issue ${id} not found`);
  return data.issue;
}

async function cmdGet(id, out) {
  const i = await getIssue(id);
  const labels = i.labels.nodes.map((l) => l.name).join(", ") || "none";
  const comments = [...i.comments.nodes]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((c) => `### ${c.user?.name ?? "unknown"} — ${c.createdAt}\n\n${c.body}`)
    .join("\n\n");
  const md = `# ${i.identifier}: ${i.title}

URL: ${i.url}
Labels: ${labels}

## Description

${i.description ?? "(empty)"}

## Comments (oldest first)

${comments || "(none)"}
${i.parent ? `\n${formatParentSection(i.parent, 2)}` : ""}`;
  writeFileSync(out, md);
  console.log(`wrote ${out}`);
}

// Human context for the PR body: the issue description plus the plan and owner feedback,
// without the workflow's own status comments. Keeps GitHub the single place to read a change.

async function cmdPrContext(id, out) {
  const i = await getIssue(id);
  const comments = [...i.comments.nodes]
    .filter((c) => !isAutomatedComment(c.body))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(
      (c) =>
        `#### ${c.user?.name ?? "unknown"} — ${c.createdAt.slice(0, 16).replace("T", " ")} UTC\n\n${c.body.trim()}`,
    )
    .join("\n\n---\n\n");
  const md = `<details>
<summary>Linear context — ${i.identifier}: issue, approved plan and owner feedback</summary>

Source: ${i.url}

### Issue description

${i.description ?? "(empty)"}

### Plan and feedback (oldest first)

${comments || "(none)"}
${i.parent ? `\n${formatParentSection(i.parent, 3)}` : ""}
</details>
`;
  writeFileSync(out, md);
  console.log(`wrote ${out}`);
}

async function cmdRequireLabel(id, label) {
  const i = await getIssue(id);
  const has = i.labels.nodes.some((l) => l.name === label);
  if (!has) fail(`${id} is missing label "${label}" — gate not passed`);
  console.log(`${id} has "${label}"`);
}

async function cmdComment(id, file) {
  const i = await getIssue(id);
  const body = readFileSync(file, "utf8");
  await gql(`mutation($input: CommentCreateInput!) { commentCreate(input: $input) { success } }`, {
    input: { issueId: i.id, body },
  });
  console.log(`commented on ${id}`);
}

async function teamContext(labelName = AUDIT_LABEL) {
  const data = await gql(
    `query($key: String!, $label: String!) {
      teams(filter: { key: { eq: $key } }) {
        nodes { id states { nodes { id name type } } }
      }
      issueLabels(filter: { name: { eq: $label } }) { nodes { id } }
    }`,
    { key: TEAM_KEY, label: labelName },
  );
  const team = data.teams.nodes[0];
  if (!team) fail(`team ${TEAM_KEY} not found`);
  const states = team.states.nodes;
  const state = states.find((s) => s.type === "triage") ?? states.find((s) => s.type === "backlog");
  const label = data.issueLabels.nodes[0];
  if (!label) fail(`label "${labelName}" not found — create it in Linear first`);
  return { teamId: team.id, stateId: state?.id, labelId: label.id };
}

async function cmdAuditImport(file) {
  const report = JSON.parse(readFileSync(file, "utf8"));
  const { teamId, stateId, labelId } = await teamContext();
  await importAudit(report, {
    existingDescriptions: async () => {
      const data = await gql(
        `query($teamId: ID!, $labelId: ID!) {
          issues(first: 250, includeArchived: true, filter: { team: { id: { eq: $teamId } }, labels: { id: { eq: $labelId } } }) {
            nodes { description }
          }
        }`,
        { teamId, labelId },
      );
      return data.issues.nodes.map((i) => i.description ?? "");
    },
    createIssue: (input) =>
      gql(
        `mutation($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { identifier } } }`,
        {
          input: { teamId, stateId, labelIds: [labelId], ...input },
        },
      ),
    log: console.log,
  });
}

// Findings belong to the milestone of the issue whose run produced them (TRK-28).
async function placement(relatedId) {
  if (!relatedId) return {};
  const data = await gql(
    `query($id: String!) { issue(id: $id) { project { id } projectMilestone { id } } }`,
    { id: relatedId },
  );
  const issue = data.issue;
  if (!issue) return {};
  return {
    ...(issue.project ? { projectId: issue.project.id } : {}),
    ...(issue.projectMilestone ? { projectMilestoneId: issue.projectMilestone.id } : {}),
  };
}

async function cmdFinding(titleFile, bodyFile, relatedId) {
  const title = readFileSync(titleFile, "utf8").trim();
  const body = readFileSync(bodyFile, "utf8");
  const { teamId, stateId, labelId } = await teamContext(FINDING_LABEL);
  // Same failure again (same workflow, target and signals): add the run to the open issue.
  const open = await gql(
    `query($teamId: ID!, $labelId: ID!, $title: String!) {
      issues(first: 1, filter: {
        team: { id: { eq: $teamId } }, labels: { id: { eq: $labelId } },
        title: { eq: $title }, state: { type: { nin: ["completed", "canceled"] } }
      }) { nodes { id identifier } }
    }`,
    { teamId, labelId, title },
  );
  const existing = open.issues.nodes[0];
  if (existing) {
    await gql(
      `mutation($input: CommentCreateInput!) { commentCreate(input: $input) { success } }`,
      {
        input: { issueId: existing.id, body: `Happened again.\n\n${body}` },
      },
    );
    console.log(`commented on ${existing.identifier}`);
    return;
  }
  const created = await gql(
    `mutation($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { identifier } } }`,
    {
      input: {
        teamId,
        stateId,
        labelIds: [labelId],
        title,
        description: body,
        ...(await placement(relatedId)),
      },
    },
  );
  console.log(`created ${created.issueCreate.issue.identifier}`);
}

async function cmdRetroExport(id, out) {
  const data = await gql(
    `query($id: String!) {
      issue(id: $id) {
        identifier
        projectMilestone {
          id
          name
          issues(first: 250) { nodes { identifier title url state { name } labels { nodes { name } } } }
        }
      }
    }`,
    { id },
  );
  const milestone = data.issue?.projectMilestone;
  if (!milestone) fail(`${id} has no project milestone`);
  const { teamId, labelId } = await teamContext(FINDING_LABEL);
  const findings = await gql(
    `query($teamId: ID!, $labelId: ID!) {
      issues(first: 250, filter: { team: { id: { eq: $teamId } }, labels: { id: { eq: $labelId } } }) {
        nodes { identifier title url createdAt state { name } projectMilestone { id } description comments(first: 20) { nodes { body } } }
      }
    }`,
    { teamId, labelId },
  );
  const rows = [...milestone.issues.nodes]
    .sort((a, b) => a.identifier.localeCompare(b.identifier, "en", { numeric: true }))
    .map((i) => {
      const labels = i.labels.nodes.map((l) => l.name).join(", ");
      return `| ${i.identifier} | ${i.title.replaceAll("|", "\\|")} | ${i.state.name} | ${labels} |`;
    })
    .join("\n");
  const block = (f) => {
    const repeats = f.comments.nodes.filter((c) => c.body.startsWith("Happened again")).length;
    return `### ${f.identifier}: ${f.title}\n\n- State: ${f.state.name}\n- Created: ${f.createdAt}\n- Repeats: ${repeats}\n- URL: ${f.url}\n\n${f.description ?? ""}`;
  };
  // Only this milestone's findings (TRK-28). Findings with no milestone are listed apart for a decision.
  const { ours, unassigned } = findingsForMilestone(findings.issues.nodes, milestone.id);
  const findingBlocks = ours.map(block).join("\n\n");
  const unassignedBlocks = unassigned.map(block).join("\n\n");
  writeFileSync(
    out,
    `# Retro inputs: ${milestone.name}\n\n## Milestone issues\n\n| Issue | Title | State | Labels |\n| --- | --- | --- | --- |\n${rows}\n\n## Linear findings (source:finding)\n\n${findingBlocks || "None."}\n\n## Linear findings with no milestone\n\nDecide whether each belongs to this milestone.\n\n${unassignedBlocks || "None."}\n`,
  );
  console.log(`wrote ${out}`);
}

// Prints the issue a PR body closes, read from stdin (used by agent-pr-iterate).
async function cmdClosingIssue() {
  let body = "";
  for await (const chunk of process.stdin) body += chunk;
  console.log(closingIssue(body) ?? "");
}

const [cmd, ...args] = process.argv.slice(2);
const commands = {
  get: cmdGet,
  "pr-context": cmdPrContext,
  "require-label": cmdRequireLabel,
  comment: cmdComment,
  "audit-import": cmdAuditImport,
  finding: cmdFinding,
  "retro-export": cmdRetroExport,
  "closing-issue": cmdClosingIssue,
};
if (!commands[cmd]) fail(`unknown command "${cmd}"`);
await commands[cmd](...args);
