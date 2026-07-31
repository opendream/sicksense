# Review Packet Template (grok-senpai)

Written by the **implementer** (or Grok immediately after a successful Result Packet).
Consumed by the **reviewer** (opposite model). Path convention:

`.grok/orchestration/reviews/<task_id>.md`

---

```markdown
# Review Packet — <task_id>

## Meta
- Task ID: <task_id>
- Implementer agent: claude | codex
- Worktree Path: <absolute path>
- Branch: orch/<short-task>-<agent>
- Worker model / effort: <e.g. gpt-5.6-sol / ultra>
- Reviewer should use: opposite model (see AGENTS.md)

## Intent (from Task Packet)
<1–3 sentences: what was requested>

## What changed
- <bullet: behavior / API / files>
- <bullet>
- <bullet>

## Diff scope
Run in the worktree and paste or summarize:

```bash
git status --short
git diff --stat
git diff
```

Key paths:

- path/one (added|modified|deleted)
- path/two (added|modified|deleted)

## Verification
| Command | Outcome | Notes |
|---------|---------|-------|
| `...` | pass \| fail | ... |

## Risks / non-goals
- <risk or explicitly out of scope>

## Ask the reviewer
Focus on (check all that apply):

- [ ] Correctness vs acceptance criteria
- [ ] Edge cases
- [ ] Security
- [ ] Missing / weak tests
- [ ] Deviations from Task Packet scope
- [ ] API / contract breaks

## Attachments
- Result Packet: <inline or path>
- Full Task Packet: <reference>
```

---

## Orchestrator rules

1. Do **not** start independent review without a Review Packet for non-trivial tasks.
2. Reviewer receives: Task Packet + Review Packet + worktree diff (read-only).
3. Reviewer returns a Result Packet (`mode: independent_review`) with findings.
4. Human still approves the final diff before merge.
