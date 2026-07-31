# CLAUDE.md - Sicksense API PPOS Knowledge Base

Daily handbook for contributors in this feature's PPOS KB (`ppos`). Full contract:
[system-description.md](system-description.md). Prompt index:
[prompts/README.md](prompts/README.md).

## Startup

1. Read this file.
2. Read [system-description.md](system-description.md).
3. Skim [README.md](README.md).
4. Read [raw/INDEX.md](raw/INDEX.md).
5. Read [wiki/INDEX.md](wiki/INDEX.md).
6. Read [exploration/INDEX.md](exploration/INDEX.md).
7. Establish a session lane unless the current request is read-only:
   `coordination/sessions/active/<session-id>.md` and
   `exploration/sessions/<session-id>.md`.
8. Classify the work mode from the current human request.
9. If the mode is `slice-authoring` or `slice-implementation`, run the Role
   Classification Gate below before opening the active prompt.
10. Open the matching prompt before acting.

## Compact Recovery Gate

Mandatory after compaction, resume, interruption, or unclear continuity. Do not
trust chat memory or implicit skill activation.

1. Re-read this file, [system-description.md](system-description.md), and
   [prompts/README.md](prompts/README.md).
2. Find the latest `COMPACT-RECOVERY` block in active `exploration/`, `log/`, or
   `plans-wip/`; prefer the active session record when one exists.
3. Re-classify mode and open the active prompt named there.
4. Continue only with `next permitted step`.
5. If no block exists, reconstruct from files and write one before continuing.

If the human request conflicts with recovery, surface the conflict and let the
new request choose the mode.

## Mode Gate

Do not infer mode from old chat or active files alone.

| Mode | Human signal | Main surface | Prompt |
|---|---|---|---|
| `requirement-analysis` | understand, explore, analyze `LEG*`, map rules | `exploration/`, wiki only at compile | [explore-session](prompts/explore-session.md) |
| `slice-discovery` | what should we build, discover/rank/pick slices | `plans-wip/0-candidate-slices.md` | [slice-discover](prompts/slice-discover.md) |
| `slice-authoring` | draft plan, plan slice N | `plans-wip/slice-N-*.md` | [slice-author](prompts/slice-author.md) |
| `slice-implementation` | continue, next phase, implement, review, test | code + active plan + `log/` | [slice-implementation](prompts/slice-implementation.md) |
| `slice-close` | wrap/promote slice after committed exit criteria | `wiki/slice-N-*.md` | [compile-session-end](prompts/compile-session-end.md) |

## Role Classification Gate

Required before `slice-authoring` or `slice-implementation` begins.

Classify and state:

- active coordinator: owns workflow decisions and next-step authority
- planner/author: drafts or updates the slice plan
- phase writer: mutates the implementation write set, if any
- reviewer: performs authoring/phase review and whether that review is blocking
- integrator/committer: accepts evidence, logs, and commits

Use this precedence:

1. Latest explicit human instruction.
2. Active `COMPACT-RECOVERY` block.
3. Active slice plan role pin.
4. Default: human is coordinator/integrator; Claude assists as bounded
   planner/writer/reviewer only when assigned.

If a role is missing, state the default before acting.

## Wiki Rhythm

Do not update `wiki/` mid-conversation unless the human explicitly says
"record this" or "this is confirmed".

- During conversation: append observations, quotes, questions, source refs,
  contradictions, and hypotheses to `exploration/sessions/<session-id>.md`.
- At wrap/consolidate: run
  [compile-session-end](prompts/compile-session-end.md).
- Promote only stable observations. Keep unresolved choices as unknowns.
- Entity pages use `compiled` only when identity, lifecycle, and core
  invariants are stable; otherwise use `provisional` with `blocked-by:`.

## Key Rules

- `LEG*` files in `../` are legacy artifacts; do not edit them during
  sicksense design work unless the task explicitly asks for source-spec
  correction.
- `raw/` is a source registry and errata lane, not a place to copy full source
  requirements.
- `exploration/` and `log/` are append-friendly; never rewrite past-day entries.
  For new concurrent work, prefer session-local files under
  `exploration/sessions/` and `log/sessions/`.
- `wiki/` is the accumulator: indexed, backlinked, and stable.
- Use requirement IDs (`LEG111`, `LEG211`, etc.) in filenames, headings, and
  traceability notes.
- Implementation work in `sicksense` uses `feature branches from master`. Docs may stay on the docs default branch.

## Rule Mismatch

If these rules do not fit a real case, do not override silently. Log the
mismatch in today's exploration and surface it to the human.
