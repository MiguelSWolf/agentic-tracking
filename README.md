# agentic-tracking

Event-sourced tracking (UTMs → attribution key → journey → conversion), built agentically:
Claude implements, CodeRabbit reviews, Codex audits each milestone, a human decides and merges.
Rules for agents: [AGENTS.md](AGENTS.md). Decisions: [docs/adr](docs/adr).

## Bootstrap (once, locally — everything after this runs in GitHub Actions)

```bash
# 1. repo (inside the unzipped bundle)
sed -i 's/@YOUR_GITHUB_USER/@<your-handle>/g' .github/CODEOWNERS
ln -s ../.agents/skills .claude/skills
git init -b main && git add -A && git commit -m "chore: bootstrap agentic workflow"
gh repo create agentic-tracking --public --source . --push

# 2. secrets
claude setup-token                       # copy the token
gh secret set CLAUDE_CODE_OAUTH_TOKEN    # paste it
gh secret set LINEAR_API_KEY             # Linear → Settings → API → personal key

# 3. apps
#   Claude GitHub App:  run `/install-github-app` inside Claude Code
#   CodeRabbit:         install the GitHub App on this repo
#   Codex:              ChatGPT Plus → Codex → connect GitHub → create environment → install "Codex for Linear"
```

GitHub → Settings → General → Pull Requests: allow **only squash merging**, with the default
commit message set to **"Pull request title and description"**. The PR body (why, what, decisions,
plan and owner feedback) then lands in `git log`, so git is the single source of truth.

Then in GitHub → Settings → Rules: ruleset on `main` with *require PR*, *1 approval*,
*require review from Code Owners*, *require status checks (ci)*, *block force pushes*.
Enable secret scanning (free on public repos).

Linear: follow [.github/linear-labels.md](.github/linear-labels.md) and import [linear/m0-issues.md](linear/m0-issues.md).

## Running an issue

1. Linear: issue in Todo + label `agent:ready` (G0).
2. GitHub → Actions → **agent-implement** → `issue_id=TRK-n`, `phase=plan` → plan appears on the Linear issue.
3. Reply with changes (and re-run plan) or add `plan:approved` (G1).
4. Run again with `phase=implement` → PR ready for review.
5. `@claude <request>` on the PR to iterate (G3). Mark ready, approve, merge (G2).
