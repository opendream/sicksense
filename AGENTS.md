# AGENTS.md

<!-- grok-senpai:playbook:start -->

## Multi-Agent Orchestration Playbook (Grok + Claude + Codex)

### Core Principles
- Grok Build is the single orchestrator. Always start non-trivial work in Plan Mode.
- Prefer model diversity: Claude Code for deep reasoning / architecture; Codex CLI for scoped implementation and independent review; Grok subagents for simple independent pieces.
- Isolation first: every parallel or non-trivial task runs in its own Grok-native worktree.
- Treat every agent output as a proposal. Never merge without verification.

### Routing Decision Table

| Task Type | Preferred Agent | Notes |
|-----------|-----------------|-------|
| Architecture, complex multi-file, high-stakes reasoning | Claude Code | Deep coherence |
| Well-scoped implementation, mechanical changes, tests | Codex CLI | Fast + precise |
| Simple independent piece | Grok subagent | Lowest overhead |
| Independent code review | Opposite model of the implementer | Different training distribution |
| Final integration / merge decision | Grok | After all gates pass |

### Mandatory Gates (before any merge)
1. Complete Task Packet
2. Valid Result Packet returned from the implementer
3. Verification commands pass inside the worktree
4. **Review Packet** written (summary + diff handoff) for non-trivial tasks
5. Independent review by a different model, using the Review Packet
6. Human approval of the final diff

### Worktree Protocol (mandatory isolation)
- **Non-trivial and all parallel work MUST run in an isolated worktree.** Do not implement multi-file or parallel agent work on the primary checkout.
- Prefer Grok-native worktrees (`grok -w` or `grok --worktree=...`); `git worktree add` is acceptable if Grok-native is unavailable.
- Naming convention: `orch/<short-task>-<agent>`
- **One agent per worktree.** Never point two workers at the same worktree.
- Before launching a worker, confirm `Worktree Path` is a linked worktree (not the main checkout) unless the human explicitly approved in-place work for a trivial change.
- Record every active worktree in `.grok/orchestration/state.md` **before** the worker starts.
- After merge or discard → remove the worktree (`grok worktree rm` / `git worktree remove` / `gc`).
- **Refuse** to start parallel Claude/Codex jobs that would share a dirty tree.

### Task Packet, Result Packet & Review Packet
Always use the standard Task Packet when launching workers and require a Result Packet in return.

After a successful **implementation** Result Packet, produce a **Review Packet** before launching the reviewer:

- Path: `.grok/orchestration/reviews/<task_id>.md` (in the worktree or main tracker—prefer worktree, copy path into state.md)
- Template: `.grok/orchestration/REVIEW_PACKET.template.md`
- Contents: intent, what changed, diff scope (`git diff --stat` / key paths), verification table, risks, reviewer focus checklist

The reviewer must receive: **Task Packet + Review Packet + read-only worktree/diff**. Do not ask a reviewer to “just look at the branch” without a Review Packet.

- Templates: `.grok/orchestration/TASK_PACKET.template.md`, `.grok/orchestration/RESULT_PACKET.template.md`, `.grok/orchestration/REVIEW_PACKET.template.md`
- Worker skills: `.grok/skills/claude-worker/`, `.grok/skills/codex-worker/`
- Worker defaults: `.grok/orchestration/worker-config.toml`
- Active tracking: `.grok/orchestration/state.md`

### Worker models & thinking levels

**Hard defaults** (use unless overridden):

| Worker | Model | Effort |
|--------|-------|--------|
| Claude (`claude-worker`) | `fable` (Claude Fable) | `high` |
| Codex (`codex-worker`) | `gpt-5.6-sol` (Sol) | `ultra` |

Configured in `.grok/orchestration/worker-config.toml`. Skills must pass these flags **explicitly** on every invoke (do not rely on the user's global CLI defaults).

**Grok may override** via Task Packet when `[policy].allow_override = true`:

```yaml
worker_model: fable           # concrete CLI id; claude example
worker_model_alias: fable     # friendly name retained for display/audit
worker_effort: high           # claude: low|medium|high|xhigh|max
                              # codex:  low|medium|high|xhigh|max|ultra
```

**Effort routing (when Grok delegates level):**

| Task shape | Claude effort | Codex effort |
|------------|---------------|--------------|
| Architecture, security, multi-file, ambiguous | `max` | `ultra` or `max` |
| Independent code review | `max` | `max` or `ultra` |
| Normal feature / solid implementation | `high`–`max` | `high`–`ultra` |
| Tiny mechanical edit, single file, clear tests | `high` (floor) | `high` (floor) |

If `policy.enforce_floors` is true (default), never go below `min_effort_claude` / `min_effort_codex` (default `high`). Prefer the defaults (**high** / **ultra**) when unsure; raise Claude to `max` (or switch to `opus`) only for architecture, security, or high-stakes review.

### Natural-language model and effort selection

Humans may choose a worker model and effort in ordinary language. Grok resolves the phrase before writing or launching the Task Packet:

```text
[<agent>] [<model-alias> [<version>]] [<effort>]
```

Examples:

| Human phrase | Resolved Task Packet intent |
|--------------|-----------------------------|
| `use claude Opus 5 max` | `agent: claude`, `worker_model_alias: opus`, `worker_model: opus`, `worker_effort: max` |
| `codex sol ultra` | `agent: codex`, `worker_model_alias: sol`, `worker_model: gpt-5.6-sol`, `worker_effort: ultra` |
| `review with sonnet high` | review role, `worker_model_alias: sonnet`, `worker_model: sonnet`, `worker_effort: high` |

Resolution rules:

1. Recognize `claude`, `codex`, `claude-worker`, and `codex-worker` as agent tokens.
2. Resolve model names through `.grok/orchestration/model-aliases.toml`. Stock mappings include `opus → opus`, `claude-opus-5 → claude-opus-5`, `fable → fable`, `sonnet → sonnet`, and `sol → gpt-5.6-sol`.
3. Treat an optional bare version such as `5` or `5.6` as advisory when the alias is otherwise unambiguous.
4. Accept effort tokens case-insensitively: `low`, `medium`, `high`, `xhigh`, `max`, `ultra`. Claude does not support `ultra`; clamp it to `max` and disclose that adjustment in the launch echo.
5. If the model is ambiguous or unknown, do not launch. Ask the human with likely candidates unless `policy.allow_unknown_model = true`, in which case a raw model id may pass through.
6. Write both the friendly `worker_model_alias` and the resolved CLI value in `worker_model`; never send only the human phrase to a worker.

Model/effort precedence, highest first:

1. Explicit `worker_model` / `worker_effort` already present in this turn's Task Packet
2. Natural-language resolution for this turn
3. Defaults in `.grok/orchestration/worker-config.toml`
4. Skill fallbacks (`fable`/`high` for Claude; `gpt-5.6-sol`/`ultra` for Codex)

After resolution, apply configured effort floors. Task Packet overrides are allowed only when `policy.allow_override = true`.

When `policy.require_launch_echo = true` (the default), show the resolved plan before every invoke:

```text
Launch plan
- agent: claude | role: dev | source: human_override
- model: fable (cli: fable)
- effort: high
- worktree: /absolute/worktree/path
```

For an already-approved or non-interactive launch, still write the same Launch plan into the Task Packet or the task row's `Notes` before invoking the worker.

### Per-turn role overrides

Default routing remains the Routing Decision Table above. A human can override it for the current orchestration turn/task chain:

| Human role | Task Packet `role` | Task Packet `mode` |
|------------|--------------------|--------------------|
| `dev`, `implement`, `implementation` | `dev` | `implementation` |
| `review`, `reviewer`, `independent_review` | `review` | `independent_review` |

- With no explicit role words, set `role_source: default_routing`.
- With an explicit assignment such as `claude dev, codex review` or `codex implement, claude review`, honor it and set `role_source: human_override`.
- An override expires with the current task chain; it does not change project defaults.
- `both review` may launch two independent reviews only when the human explicitly requests it.
- The independent reviewer still receives the Task Packet + Review Packet and should use a different model from the implementer. Role overrides do not remove or reorder merge gates.

### Worker visibility and progress heartbeats

Grok owns progress visibility; workers do not need to write progress files or emit self-heartbeats.

1. Before launch, create `.grok/orchestration/logs/<task_id>.log` and a `state.md` row containing the resolved role, model, effort, worktree, branch, start time, log path, and (after launch) PID.
2. Launch the worker as a background job and capture its stdout/stderr into that log so Grok remains interactive. Use the **canonical log-capture launch** below (or equivalent).
3. Poll once immediately after launch, approximately every **2 minutes** while the process is alive, and once on exit. A human asking “status?” triggers an immediate poll.
4. Poll only observable signals: process state (`kill -0 $PID` or equivalent), a redacted non-empty worker-I/O log tail, `git status -sb`, and `git diff --stat` in the assigned worktree.
5. Post a short heartbeat to chat and update the same `state.md` row on every poll. On exit, record `done`/`failed`, the final signal, and the Result Packet.

#### Canonical log-capture launch

```bash
TASK_ID="<task_id>"
LOG=".grok/orchestration/logs/${TASK_ID}.log"
mkdir -p "$(dirname "$LOG")"
# Replace <worker-command> with the full claude/codex invoke from the worker skill.
# Prefer tee so the log grows while you can still stream when attached.
(
  cd "<Worktree Path>" && <worker-command>
) >"$LOG" 2>&1 &
WORKER_PID=$!
# Record WORKER_PID + LOG in state.md (PID column + Log column) before the first heartbeat.
```

Equivalent one-liner form (when the shell already has cwd set):

```bash
<worker-command> 2>&1 | tee -a ".grok/orchestration/logs/<task_id>.log" &
WORKER_PID=$!
```

Do **not** launch workers only in the foreground without a log path when heartbeats are expected — the log is the primary signal for phase heuristics.

Heartbeat format:

```text
⏱ heartbeat · <task_id> · <elapsed>
agent: claude (dev) · model: fable · effort: high
phase: starting | running | testing | finishing | stalled?
last signal: <redacted log or git signal>
worktree: <N files changed, M lines>
blocker: none | <short>
next ping: ~2m
```

Keep heartbeats to roughly 6–10 lines. Infer `starting` before meaningful output, `running` when logs/files change, `testing` from verification activity, and `finishing` from Result Packet-like output. Mark `stalled?` only after neither log nor git signals change for two consecutive pings (about 4 minutes). Raw logs are gitignored and may contain sensitive output; redact before copying a signal into chat or `state.md`.

The orchestrator loop is:

```text
launch background worker → record PID + log path in state.md
while process is alive (kill -0 $PID):
  wait/poll with ~2m timeout
  inspect worker I/O + worktree signals
  emit chat heartbeat + update state.md
parse Result Packet on exit → continue the existing gates
```

### Roles
- **Human:** States goals in plain language; approves or rejects final diffs. Does **not** manually drive worktrees, packets, or worker selection.
- **Grok (orchestrator):** Owns the full loop below for every non-trivial task. This file is your operating manual.

### How Grok runs a task
1. Confirm the repo is git-backed (worktrees require git).
2. Create an isolated worktree (`orch/<short-task>-<agent>`); record it in `state.md`.
3. Resolve natural-language model/effort and any role override; write a complete Task Packet and echo the Launch plan.
4. Launch the matching worker skill **only inside that worktree**, capture its output, and maintain ~2-minute heartbeats until it exits.
5. Collect the Result Packet; confirm verification passed inside the worktree.
6. Write a **Review Packet** (template + diff summary) for non-trivial tasks.
7. Launch independent review with a **different model** in a dedicated review setup (read-only; same worktree OK if read-only, or a fresh worktree checkout of the branch). Pass Task Packet + Review Packet + diff.
8. Present the final diff (and review findings) to the human; merge only after approval; clean up the worktree.
9. Keep `.grok/orchestration/state.md` accurate; reset between major efforts if useful.

### Example
See `examples/clamp/` for a complete walkthrough of implementation → review → polish using this playbook.

<!-- grok-senpai:playbook:end -->

