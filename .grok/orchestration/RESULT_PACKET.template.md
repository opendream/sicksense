# Result Packet Templates (grok-senpai)

Workers must end with a Result Packet. Formats differ slightly by agent. See **AGENTS.md** and the worker skills.

## Recommended next actions (shared)

`merge` · `needs_review` · `iterate` · `discard` · `escalate_to_human`

## Codex (structured text)

```
Result Packet
Task ID: <same as Task Packet>
Status: success | partial | failed
Agent: codex
Mode: implementation | independent_review
Role: dev | review
Role Source: default_routing | human_override
Worktree Path: ...
Branch: ...
Worker Model Alias: sol
Worker Model: gpt-5.6-sol
Worker Effort: ultra
Summary
<2-5 sentences>
Files Changed
path (added|modified|deleted)
Tests & Verification
Command: ... → pass | fail
Notes: ...
Confidence
<1-5> (short justification)
Open Questions / Risks
...
Findings (independent_review only; omit or leave empty for implementation)
- [blocker|major|minor|nit] <title> — <detail>
Recommended Next Action
merge | needs_review | iterate | discard | escalate_to_human
```

## Claude (JSON preferred)

```json
{
  "task_id": "...",
  "status": "success | partial | failed",
  "agent": "claude",
  "mode": "implementation | independent_review",
  "role": "dev | review",
  "role_source": "default_routing | human_override",
  "summary": "1-3 sentence overview",
  "files_changed": ["path1", "path2"],
  "tests_run": [
    {"command": "...", "outcome": "pass | fail", "notes": "..."}
  ],
  "confidence": 1,
  "open_questions": [],
  "risks": [],
  "recommended_next_action": "merge | needs_review | iterate | escalate_to_human | discard",
  "findings": [
    {"severity": "blocker | major | minor | nit", "title": "...", "detail": "..."}
  ],
  "worker_model_alias": "fable",
  "worker_model": "fable",
  "worker_effort": "high"
}
```

(`confidence` is an integer 1–5. `findings` is required for `independent_review` — use `[]` when none; optional/empty for implementation.)

## Orchestrator rules

- Treat every Result Packet as a **proposal**.
- Require the role source and the model/effort actually used for an auditable launch.
- Do not merge until mandatory gates pass (see `AGENTS.md`).
