import { describe, expect, it } from "vitest";
import { isWaitingDuplicate, selectRuns } from "./cancel-waiting-ci.mjs";

const SHA = "20bfd9b0c3f1e5a7d2b8c4e6f0a1b3c5d7e9f2a4";
const bot = { login: "github-actions[bot]" };
const run = (extra) => ({
  id: 45018489475,
  event: "pull_request",
  head_sha: SHA,
  status: "completed",
  conclusion: "action_required",
  actor: bot,
  triggering_actor: bot,
  ...extra,
});
const jobs = (counts) => async (id) => counts[id] ?? 0;

describe("selectRuns", () => {
  it("with a completed action_required bot run and no jobs, deletes it", async () => {
    const selected = await selectRuns([run()], SHA, jobs({}));

    expect(selected).toEqual([{ id: 45018489475, action: "delete" }]);
  });

  it("with a run still waiting as status action_required, cancels it", async () => {
    const selected = await selectRuns(
      [run({ status: "action_required", conclusion: null })],
      SHA,
      jobs({}),
    );

    expect(selected).toEqual([{ id: 45018489475, action: "cancel" }]);
  });

  it("with an approved run in progress, leaves it alone", async () => {
    const active = run({
      id: 45038702054,
      status: "in_progress",
      conclusion: null,
      triggering_actor: { login: "MiguelSWolf" },
    });

    expect(await selectRuns([active], SHA, jobs({ 45038702054: 3 }))).toEqual([]);
  });

  it("with a queued bot run, leaves it alone", async () => {
    expect(await selectRuns([run({ status: "queued", conclusion: null })], SHA, jobs({}))).toEqual(
      [],
    );
  });

  it("with an action_required run that already has jobs, leaves it alone", async () => {
    expect(await selectRuns([run()], SHA, jobs({ 45018489475: 3 }))).toEqual([]);
  });

  it("with a run for another commit, leaves it alone", async () => {
    expect(
      await selectRuns(
        [run({ head_sha: "0000000000000000000000000000000000000000" })],
        SHA,
        jobs({}),
      ),
    ).toEqual([]);
  });

  it("with a run triggered by a person, leaves it alone", async () => {
    const human = { login: "MiguelSWolf" };

    expect(
      await selectRuns([run({ actor: human, triggering_actor: human })], SHA, jobs({})),
    ).toEqual([]);
  });

  it("with a bot run re-run by the owner after approval, leaves it alone", async () => {
    expect(isWaitingDuplicate(run({ triggering_actor: { login: "MiguelSWolf" } }), SHA)).toBe(
      false,
    );
  });

  it("with a dispatched run, leaves it alone", async () => {
    expect(await selectRuns([run({ event: "workflow_dispatch" })], SHA, jobs({}))).toEqual([]);
  });
});
