# F-009: The Codex GitHub integration answers "create a Codex account" even for the owner

- Status: open
- Area: Review (Codex)
- Source: owner
- Found: 2026-11-22
- Evidence: [#16](https://github.com/MiguelSWolf/agentic-tracking/pull/16), [#17](https://github.com/MiguelSWolf/agentic-tracking/pull/17), [#18](https://github.com/MiguelSWolf/agentic-tracking/pull/18)

## What happened

`@codex review` answered "To use Codex here, create a Codex account and connect to github", even when typed by the owner, with GitHub connected and the app installed on all repositories. Codex reviews are run by the owner and posted by hand.

## Proposed fix

Open a support ticket with OpenAI. Fallback: `openai/codex-action` with an `OPENAI_API_KEY` secret, dispatched by `agent-implement`.
