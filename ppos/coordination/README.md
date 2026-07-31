# Coordination

Session records and integration packets for concurrent work on Sicksense API
design.

## Session Record Template

Create in `sessions/active/<session-id>.md`:

````markdown
# Session: sicksense-YYYYMMDD-HHMM-<agent>-<topic>

```yaml
started: YYYY-MM-DD HH:MM
agent: <agent name>
mode: requirement-analysis | slice-discovery | slice-authoring | slice-implementation | slice-close
status: active | paused | closed
```

## Role Split

- Coordinator:
- Planner/Author:
- Phase Writer:
- Reviewer:
- Integrator/Committer:

## Write Lanes

- exploration: `exploration/sessions/<session-id>.md`
- log: `log/sessions/<session-id>.md` (if implementation)
- board update: `plans-wip/board-updates/<session-id>.md`
- wiki proposals: `wiki/proposals/<session-id>-*.md`

## Current Step

<What is being worked on>

## Next Steps

1. step 1
2. step 2

## Blockers

- None
````

## Folder Structure

```
coordination/
├── README.md           # This file
└── sessions/
    ├── active/         # Currently running sessions
    ├── closed/         # Completed sessions
    └── done/           # Archived sessions
```

## Rules

- One session record per active session
- Move to `closed/` when session ends normally
- Move to `done/` after findings are integrated
- Non-integrator sessions write integration packets here for review

## COMPACT-RECOVERY Template

> **This is a TEMPLATE, not a live block.** Copy it into your active session
> record (or active plan/log) and fill it in *only* when there is real state to
> recover. The recovery gate resumes from the latest *filled* block; never leave
> an empty copy of this where the gate could pick it up.

```markdown
## COMPACT-RECOVERY - <date>

- feature root: ppos
- session id:
- write lanes:
  - exploration:
  - log:
  - board update:
  - wiki proposals:
- mode:
- active prompt:
- active plan:
- role classification:
  - coordinator:
  - planner/author:
  - phase writer:
  - reviewer:
  - integrator/committer:
- current owner:
- last completed step:
- next permitted step:
- must read before acting:
- do not:
- verification/commit state:
```
