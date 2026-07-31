# Runnable Task Prompts

Prompt index for Sicksense API design work. Each prompt guides
a specific work mode with clear inputs, outputs, and constraints.

## Mode Router

| Mode | Human Signal | Prompt | Primary Output |
|---|---|---|---|
| `requirement-analysis` | "understand", "explore", "analyze LEG*", "map rules" | [explore-session.md](explore-session.md) | `exploration/sessions/<id>.md` |
| `slice-discovery` | "what should we build", "discover slices", "rank candidates" | [slice-discover.md](slice-discover.md) | `plans-wip/0-candidate-slices.md` |
| `slice-authoring` | "draft plan", "plan slice N", "write slice plan" | [slice-author.md](slice-author.md) | `plans-wip/slice-N-*.md` |
| `slice-implementation` | "implement", "continue", "next phase", "test" | [slice-implementation.md](slice-implementation.md) | code + `log/sessions/<id>.md` |
| `slice-close` | "wrap slice", "promote", "compile" | [compile-session-end.md](compile-session-end.md) | `wiki/slice-N-*.md` |

## Usage

1. Classify the human request using the Mode Router.
2. Open the matching prompt file.
3. Follow the prompt's steps in order.
4. Write outputs to the designated surfaces.

## Quick Reference

### Starting a Session

```text
Session ID format: sicksense-YYYYMMDD-HHMM-<agent>-<topic>
Example: sicksense-20260624-1430-claude-LEG111-analysis
```

### File Outputs by Mode

| Mode | Primary Output | Secondary Outputs |
|---|---|---|
| requirement-analysis | `exploration/sessions/<id>.md` | None (wiki at compile only) |
| slice-discovery | `plans-wip/0-candidate-slices.md` | `wiki/unknown-*.md` |
| slice-authoring | `plans-wip/slice-N-*.md` | dependencies, unknowns |
| slice-implementation | code, tests | `log/sessions/<id>.md` |
| slice-close | `wiki/slice-N-*.md` | index updates, backlinks |
