@AGENTS.md

# Claude-specific notes

- Shared skills are in `.agents/skills/` (exposed as `.claude/skills`). Use `issue-flow` for any Linear issue.
- In CI you run non-interactively. You cannot ask questions mid-run: if blocked, write what you need
  into your output file and stop.
- Plan phase: write the plan to `.agent-out/plan.md` and change nothing else.
- Implement phase: only start if the workflow told you the plan was approved (`plan:approved`).
- Never push to `main`, never force-push, never edit protected zones (see AGENTS.md).
- Prefer the smallest change that meets the acceptance criteria.
