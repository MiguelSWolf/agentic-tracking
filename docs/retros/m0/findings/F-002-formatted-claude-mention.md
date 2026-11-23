# F-002: A `@claude` mention written as a formatted link does not trigger the iteration

- Status: fixed ([#26](https://github.com/MiguelSWolf/agentic-tracking/pull/26))
- Area: Gate G3
- Source: owner
- Found: 2026-11-23
- Evidence: [run 45041158851](https://github.com/MiguelSWolf/agentic-tracking/actions/runs/45041158851) on [#19](https://github.com/MiguelSWolf/agentic-tracking/pull/19)

## What happened

A review on PR #19 contained `[**@claude**](https://github.com/claude)`, pasted from rendered text. The workflow `if` matched the substring, but `claude-code-action` logged "No trigger found" and did nothing.

## Proposed fix

The `review-pr` skill ends every review with a plain-text `@claude` block to copy. `docs/workflow/` says the mention must be plain text.

## Decision

Fixed by rule. `review-pr` now requires a plain-text `@claude` block ([#26](https://github.com/MiguelSWolf/agentic-tracking/pull/26), `08b9e40`) and [#30](https://github.com/MiguelSWolf/agentic-tracking/pull/30) requires posting it. The action itself still ignores formatted mentions, so the rule is the fix. Check in the M1 retro that iterations use it.
