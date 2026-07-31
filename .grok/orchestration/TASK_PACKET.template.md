# Task Packet Template (grok-senpai)

Copy this file (or paste into the worker prompt) when launching a **claude-worker** or **codex-worker**. See **AGENTS.md** for gates, routing, and thinking-level policy.

```yaml
task_id: <short-id>                 # e.g. feat-auth-001
agent: codex | claude
mode: implementation | independent_review
role: dev | review                  # human-facing role; maps to mode
role_source: default_routing | human_override
worktree_path: <absolute path>      # required isolated worktree for non-trivial work
branch: orch/<short-task>-<agent>
created_by: grok-senpai-orchestrator
parent_task_id: <optional>
allow_primary_checkout: false       # true only if human approved in-place trivial work
review_packet_path: <optional>      # required for independent_review; e.g. .grok/orchestration/reviews/<task_id>.md

# Worker model & effort (optional — defaults from worker-config.toml)
# Defaults: claude → fable + high | codex → gpt-5.6-sol + ultra
# Natural-language choices are resolved before launch; worker_model is the CLI value.
worker_model: <optional>            # e.g. fable | opus | sonnet | gpt-5.6-sol
worker_effort: <optional>           # claude: low|medium|high|xhigh|max
                                    # codex:  low|medium|high|xhigh|max|ultra
worker_model_alias: <optional>      # friendly display value, e.g. fable | sol
# Omit both fields to use high/ultra defaults. Only lower when policy + task shape allow.

goal: |
  <what to accomplish>

scope:
  in_scope:
    - <item>
  out_of_scope:
    - <item>

acceptance_criteria:
  - <criterion>
  - verification_commands all pass inside the worktree

verification_commands:
  - command: <shell command>
    expect: pass

constraints:
  - Stay strictly inside the worktree
  - Prefer minimal, high-quality changes
  - Do not expand scope
  - Treat output as a proposal; grok-senpai orchestrator reviews independently

deliverables:
  - <files / Result Packet>
```

After launch, record the task in `.grok/orchestration/state.md`.
