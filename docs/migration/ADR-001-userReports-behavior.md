# ADR-001: `GET /users/:id/reports` behavior

## Status

**Accepted (inventory truth)** — decision on fix vs bug-for-bug deferred.

## Context

Multi-reviewer comparison (independent Grok report, Fable Max, Codex Sol Ultra) found a mismatch between intended “user report history” and implementation.

## Decision (documentation)

Document **actual** behavior as the production contract until product decides otherwise.

## Actual behavior (code)

Source: `api/controllers/UsersController.js` → `userReports`.

1. Load access token from `?accessToken=`.
2. Forbid unless `accessToken.userId == :id` (path).
3. Run:

```sql
SELECT * FROM reports r
ORDER BY r."createdAt" DESC
LIMIT $offset OFFSET $limit;

SELECT COUNT(r.id) AS total FROM reports r;
```

**No `WHERE "userId" = :id`.**  
Items and `count` are **global** (paginated latest reports system-wide), not filtered to that user.

Tests only create reports for one user, so they do not expose the leak.

## Options for Python rewrite

| Option | Pros | Cons |
|--------|------|------|
| **A. Bug-for-bug** | Matches live clients that may rely on global feed | Continues privacy leak |
| **B. Fix filter by userId** | Correct semantics | Breaks any client expecting global list |
| **C. New path for correct history; keep old as-is** | Safest if clients are unknown | Two endpoints to maintain |

## Default recommendation

**C** if any external client is uncertain; otherwise product call after traffic capture.

## Consequences

- Inventory and OpenAPI must not claim “user’s reports only” without an ADR updating this file.
- Characterization tests must use **two users with reports** to prove filter behavior.
