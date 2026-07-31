# Sicksense API Workflow System

```text
version:  0.1.0
created:  2026-07-30
audience: humans and LLMs working inside ppos
```

Sicksense API KB contract: surfaces, article types, promotion rules,
recovery, and change tracking. Daily startup: [CLAUDE.md](CLAUDE.md). Runnable
prompts: [prompts/README.md](prompts/README.md).

## Purpose

Sicksense API is compiled across sessions from `LEG*` legacy artifacts,
code feedback, and human decisions. The KB prevents rediscovery
while keeping draft legacy artifacts separate from stable design memory.

Core rule: unstable knowledge stays in working surfaces; stable knowledge moves
to `wiki/` with traceable links to `LEG*` sources and implementation evidence.

## Knowledge Flow

```text
LEG source refs + conversation + code feedback
        |
        v
exploration/   log/   plans-wip/
        \        |        |
         \       |        |
          v      v        v
                wiki/
```

## Surfaces

| Surface | Path | Mutability | Purpose |
|---|---|---|---|
| Coordination | `coordination/` | session-local | Active session records for concurrent work. |
| Raw | `raw/` | source registry | Links to source artifacts, errata, and trace notes (see raw/INDEX.md). |
| Exploration | `exploration/sessions/` | session-local append-friendly | Session diary: observations, questions, contradictions, hypotheses. |
| Exploration Index | `exploration/INDEX.md` | integrator-owned compact index | Human-readable map of exploration lanes and compile checkpoints. |
| Log | `log/sessions/` | session-local append-friendly | Implementation decisions, verification, commits. |
| Plans WIP | `plans-wip/` | live | Candidate lists and active slice plans. |
| Review WIP | `plans-wip/reviews/` | live | Handoffs, review cursors, fresh review requests/outputs. |
| Wiki | `wiki/` | permanent | Authoritative sicksense memory; indexed and backlinked. |
| Sources | `../LEG*` | frozen by default | Source artifacts for sicksense behavior. |
| Code | app/frontend repos | git-owned | Runtime implementation; wiki cites commits, not code bodies. |

## Concurrent Session Protocol

Use a stable session id:

```text
sicksense-YYYYMMDD-HHMM-<agent>-<short-topic>
```

At session start, create or update:

```text
coordination/sessions/active/<session-id>.md
exploration/sessions/<session-id>.md
log/sessions/<session-id>.md        # only for implementation sessions
```

Hot shared files are integrator-owned:

```text
exploration/INDEX.md
log/sessions/<session-id>.md
plans-wip/0-candidate-slices.md
wiki/INDEX.md
wiki/*.md compiled articles
```

Non-integrator sessions must not edit those files directly. They write proposed
changes to:

```text
plans-wip/board-updates/<session-id>.md
wiki/proposals/<session-id>-*.md
```

## Wiki Article Types

| Type | Pattern | Owns |
|---|---|---|
| Concept | `concept-*.md` | Vocabulary and cross-cutting models. |
| Entity | `entity-*.md` | Aggregate shape, fields, invariants, ownership. |
| Rule | `rule-*.md` | Standalone invariant needing citation. |
| Screen | `screen-S##-*.md` | UI behavior with source traceability. |
| Context | `context-*.md` | Boundary purpose, scope, aggregates, integration. |
| Decision | `decision-D##-*.md` | Accepted choice, rationale, alternatives, consequences. |
| Slice | `slice-N-*.md` | Completed outcome, evidence, commits, lessons. |
| Unknown | `unknown-U##-*.md` | Hidden assumption, blocker, stub, resolution. |

Entity status rule: use `compiled` when identity, lifecycle, and core
invariants are stable; use `provisional` with `blocked-by:` when an aggregate
scope claim or core invariant is still named-open by an unknown.

If missing from [wiki/INDEX.md](wiki/INDEX.md), it is not consolidated.

## Promotion Rules

1. Promote only stable knowledge: explicit human confirmation, source evidence,
   implementation evidence, or two supporting data points.
2. Promote whole narratives, not isolated fragments.
3. Supersede by link; never delete history.
4. Index every wiki article.
5. Keep one source of truth per fact; link elsewhere.
6. Maintain bidirectional backlinks.

## Work Modes

Classify the human request before acting. Full router:
[prompts/README.md](prompts/README.md).

| Mode | Intent | Main surfaces | Prompt |
|---|---|---|---|
| Requirement analysis | Explore behavior from `LEG*` sources | `exploration/`, then `wiki/` at compile | [explore-session.md](prompts/explore-session.md) |
| Slice discovery | Find blockers/candidates | `wiki/unknown-*`, `plans-wip/0-candidate-slices.md` | [slice-discover.md](prompts/slice-discover.md) |
| Slice authoring | Turn candidate into plan | `plans-wip/slice-N-*.md` | [slice-author.md](prompts/slice-author.md) |
| Slice implementation | Execute active phase | code, tests, `log/`, active plan | [slice-implementation.md](prompts/slice-implementation.md) |
| Compile/close | Promote stable facts or closed slices | `wiki/`, indexes, logs | [compile-session-end.md](prompts/compile-session-end.md) |

## Compact Recovery

For long sessions, write recovery blocks in active plans or logs:

```markdown
## COMPACT-RECOVERY - 2026-07-30

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

## Source Lanes

Initial source lanes are registered in [raw/INDEX.md](raw/INDEX.md), seeded at
instantiation. Do not infer missing sources. Record gaps as unknowns or
exploration questions.
