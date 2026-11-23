#!/usr/bin/env node
// Removes the duplicate `pull_request` ci run that a PR opened with GITHUB_TOKEN gets (F-007, TRK-34).
// That run is created by github-actions[bot], waits for approval with no jobs and turns red when the
// PR closes. The ci run that agent-implement dispatches already checks the same commit.
//
//   node scripts/cancel-waiting-ci.mjs <owner/repo> <head-sha>
//
// Evidence (REST): an approval-waiting run reads status "completed" + conclusion "action_required"
// (run 45038702054, attempt 1) with zero jobs (run 45018489475: jobs.total_count 0). A completed run
// cannot be cancelled, so a selected run is deleted; a still-pending one ("action_required" or
// "waiting" as status) is cancelled. Anything queued, in progress, with jobs or by another actor is
// never touched. Each run is re-fetched right before the mutation and skipped if its state, job count
// or attempt changed. Always exits 0: it must not change the job's result.

import { execFileSync } from "node:child_process";

const BOT = "github-actions[bot]";
const WAITING_STATUS = new Set(["action_required", "waiting"]);

/** True when the run is the bot's approval-waiting duplicate for this commit. */
export function isWaitingDuplicate(run, headSha) {
  if (run.event !== "pull_request" || run.head_sha !== headSha) return false;
  if (run.actor?.login !== BOT || run.triggering_actor?.login !== BOT) return false;
  const waiting =
    WAITING_STATUS.has(run.status) ||
    (run.status === "completed" && run.conclusion === "action_required");
  return waiting;
}

/**
 * Returns `{ id, action }` for each run to remove. `jobCount(id)` reports how many jobs the run started;
 * only runs with zero jobs qualify.
 */
export async function selectRuns(runs, headSha, jobCount) {
  const selected = [];
  for (const run of runs) {
    if (!isWaitingDuplicate(run, headSha)) continue;
    if ((await jobCount(run.id)) !== 0) continue;
    selected.push({
      id: run.id,
      attempt: run.run_attempt,
      action: run.status === "completed" ? "delete" : "cancel",
    });
  }
  return selected;
}

/**
 * Re-reads one selected run right before the mutation. Returns the action to take, or `null` when the
 * run changed since selection (approved, re-run so the attempt moved, started jobs, no longer waiting).
 */
export async function revalidate(candidate, headSha, fetchRun, jobCount) {
  const [run] = await selectRuns([await fetchRun(candidate.id)], headSha, jobCount);
  if (!run || run.attempt !== candidate.attempt) return null;
  return run.action;
}

function gh(args) {
  return execFileSync("gh", args, { encoding: "utf8", timeout: 30_000 });
}

async function main() {
  const [repo, headSha] = process.argv.slice(2);
  if (!repo || !headSha) throw new Error("usage: cancel-waiting-ci.mjs <owner/repo> <head-sha>");
  const runs = JSON.parse(
    gh([
      "api",
      `repos/${repo}/actions/workflows/ci.yml/runs?event=pull_request&head_sha=${headSha}`,
    ]),
  ).workflow_runs;
  const jobCount = async (id) =>
    JSON.parse(gh(["api", `repos/${repo}/actions/runs/${id}/jobs`])).total_count;
  const selected = await selectRuns(runs, headSha, jobCount);
  if (selected.length === 0)
    console.log(`No waiting bot-triggered pull_request run for ${headSha}`);
  const fetchRun = async (id) => JSON.parse(gh(["api", `repos/${repo}/actions/runs/${id}`]));
  for (const candidate of selected) {
    const { id } = candidate;
    const action = await revalidate(candidate, headSha, fetchRun, jobCount);
    if (action === null) {
      console.log(`Skipped run ${id}: it changed since it was selected`);
      continue;
    }
    const args =
      action === "delete"
        ? ["api", "-X", "DELETE", `repos/${repo}/actions/runs/${id}`]
        : ["api", "-X", "POST", `repos/${repo}/actions/runs/${id}/cancel`];
    gh(args);
    console.log(`${action === "delete" ? "Deleted" : "Cancelled"} waiting duplicate run ${id}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.log(
      `::warning::cancel-waiting-ci: ${error instanceof Error ? error.message : String(error)}`,
    );
  });
}
