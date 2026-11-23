# F-004: The agent fixes review comments but does not reply in the review threads

- Status: fixed ([#26](https://github.com/MiguelSWolf/agentic-tracking/pull/26))
- Area: Gate G3
- Source: owner
- Found: 2026-11-23
- Evidence: [#18](https://github.com/MiguelSWolf/agentic-tracking/pull/18), [#19](https://github.com/MiguelSWolf/agentic-tracking/pull/19)

## What happened

On PRs #18 and #19 the agent committed the fixes and posted a summary comment, but left the inline threads unanswered. They were answered and resolved by hand.

## Proposed fix

The `review-pr` skill and the iteration part of `issue-flow` say to reply to each thread with the fixing commit.

## Decision

Fixed by rule. `review-pr` Respond mode, step 3, says "Reply to every thread". Check in M1 that iterations actually do it.
