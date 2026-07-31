# Slice Implementation Prompt

Mode: `slice-implementation`

Use this prompt when the human wants to execute an accepted slice plan.

## Inputs

- Accepted slice plan: `plans-wip/slice-N-*.md`
- Current phase being executed
- Existing codebase context

## Steps

1. **Run Role Classification Gate** (see CLAUDE.md)

2. **Create log session file**: `log/sessions/sicksense-YYYYMMDD-HHMM-<agent>-slice-N-phase-X.md`

3. **Review phase tasks** from slice plan

4. **Execute tasks**:
   - Port or re-document the recovered behavior. Verify each change **against the legacy system's observed behavior**; a test must reproduce the legacy outcome before any refactor.
   - Write tests alongside implementation
   - Commit with meaningful messages

5. **Verify exit criteria** for the phase

6. **Update slice plan** - Mark completed tasks

7. **Log decisions** in session file

## Output Format

Log file structure:

```markdown
# Implementation Log: Slice N Phase X

Session: sicksense-YYYYMMDD-HHMM-<agent>-slice-N-phase-X
Date: YYYY-MM-DD
Slice: N - <title>
Phase: X - <phase name>

## Tasks Completed

- [x] task 1 (commit: abc123)
- [x] task 2 (commit: def456)

## Decisions Made

### D1: <decision title>

Context: <why this came up>
Decision: <what we chose>
Rationale: <why>

## Issues Encountered

- issue 1: resolution

## Verification

- [x] Tests pass
- [x] Smoke test: <scenario>

## Next Steps

- <what's next>
```

## Constraints

- Follow `sicksense` code patterns
- Commit per `feature branches from master`
- Run tests before marking complete
- Do NOT skip exit criteria
