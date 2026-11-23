# F-004: The agent fixes review comments but does not reply in the review threads

- Status: open
- Area: Gate G3
- Source: owner
- Found: 2026-11-23
- Evidence: [#18](https://github.com/MiguelSWolf/agentic-tracking/pull/18), [#19](https://github.com/MiguelSWolf/agentic-tracking/pull/19), [#24](https://github.com/MiguelSWolf/agentic-tracking/pull/24)

## What happened

On PRs #18 and #19 the agent committed the fixes and posted a summary comment, but left the inline threads unanswered. They were answered and resolved by hand.

**Recurrence after #26.** #26 added the rule "Reply to every thread" to `review-pr`. On #24, Claude still did not reply in the threads and said it could only edit its summary comment, not reply to inline threads. So the gap is a tooling capability, not only a missing rule, and the rule alone does not fix it.

## Proposed fix

The `review-pr` skill and the iteration part of `issue-flow` say to reply to each thread with the fixing commit.

## Decision

Open, with a follow-up proposed (FU-7): give the agent a way to reply to inline review threads (for example, allow the GitHub review-comment reply API in `agent-pr-iterate`, or add a reply step to the workflow), then re-check on an `@claude` iteration. The `review-pr` rule from #26 stays, but it is not counted as the fix. Until then, the owner replies to and resolves threads by hand.
