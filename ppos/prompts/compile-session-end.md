# Compile Session End Prompt

Mode: `slice-close`

Use this prompt when the human wants to wrap up a slice or promote stable
findings to the wiki.

## Inputs

- Completed slice plan: `plans-wip/slice-N-*.md`
- Implementation logs: `log/sessions/*.md`
- Exploration notes: `exploration/sessions/*.md`

## Steps

1. **Verify all exit criteria** are met

2. **Create wiki slice article**: `wiki/slice-N-<short-name>.md`

3. **Promote stable findings** from exploration/logs to wiki:
   - Concepts → `wiki/concept-*.md`
   - Entities → `wiki/entity-*.md`
   - Decisions → `wiki/decision-D##-*.md`
   - Rules → `wiki/rule-*.md`

4. **Update indexes**:
   - `wiki/INDEX.md` - add new articles
   - `exploration/INDEX.md` - mark compile checkpoint
   - `plans-wip/0-candidate-slices.md` - move to "Recently Closed"

5. **Add backlinks** - Ensure bidirectional links between articles

6. **Close unknowns** that were resolved

## Output Format

Wiki slice article:

````markdown
# Slice N: <Title>

```yaml
status: completed
completed: YYYY-MM-DD
source: LEG###, LEG###
commits: [abc123, def456, ...]
```

## Summary

<What was delivered>

## Scope

<What was included/excluded>

## Key Decisions

- D##: <decision link>

## Implementation Notes

- note 1
- note 2

## Evidence

- Tests: `tests/path/to/tests`
- Commits: <list>

## Lessons Learned

- lesson 1
- lesson 2

## Related

- [concept-*.md](concept-*.md)
- [entity-*.md](entity-*.md)
````

## Promotion Rules

Only promote to wiki when:

1. Human explicitly confirms, OR
2. Implementation evidence exists (tests, commits), OR
3. Two supporting data points from sources

Do NOT promote:

- Hypotheses without verification
- Contradictory findings without resolution
- Implementation details that may change

## Constraints

- Never delete wiki history; supersede with links
- Every new wiki article must be indexed
- Maintain bidirectional backlinks
