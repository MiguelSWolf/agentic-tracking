# Documentation

All documentation lives under `docs/`, organised by purpose. The layout is guided by
[Diátaxis](https://diataxis.fr/) (tutorials, how-to, reference, explanation) without forcing it.

- **Linear** keeps the history (why and when something changed).
- **`docs/`** keeps the current state (what is true now).
- **The PR** links the two.

The rules for keeping docs and behaviour in sync are in
[ADR-0012](adr/0012-living-specs-and-docs.md). Code standards are governed by
[ADR-0013](adr/0013-code-standards-foundation.md). The ADR index is
[`adr/README.md`](adr/README.md) (generated); read it before planning any change.

## Folders

| Folder | Purpose | Diátaxis | Written by | Must be updated when |
| --- | --- | --- | --- | --- |
| [`adr/`](adr/README.md) | Decisions and their rationale. Protected zone. | explanation | Owner commits; agents draft via the `write-adr` skill | A decision is made, changed or superseded |
| [`specs/`](specs/README.md) | Living spec per capability. | reference | Whoever changes behaviour, in the same PR | Any PR that changes a capability's behaviour |
| [`code-standards/`](code-standards/README.md) | Normative rules (MUST/SHOULD/MAY) with rule IDs. | reference | Owner; filled by the code-standards issue | A standard is added or changed |
| [`infra/`](infra/README.md) | Running and operating the system. | how-to | The PR that changes infra or operations | Infra, ports, scripts or operating steps change |
| [`workflow/`](workflow/README.md) | How work flows: roles, gates, Linear and GitHub, skills. | explanation + reference | Owner or agent, linking to protected sources | Gates, workflows, roles or skills change |
| [`audits/`](audits/README.md) | Milestone audit reports. | reference | Codex via `code-health-audit` | End of each milestone |
| [`retros/`](retros/README.md) | Milestone retrospectives. | explanation | Owner | End of each milestone |

## Rules

- Link to the source of a rule instead of copying it.
- One topic, one place. If two docs disagree, fix the one that is not the source.
- An empty folder carries a short `README.md`, never a `.gitkeep`.
- Everything is in English.
