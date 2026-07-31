# Slice Discovery Prompt

Mode: `slice-discovery`

Use this prompt when the human wants to identify, rank, or prioritize
implementation candidates.

## Inputs

- Current exploration findings
- Existing candidate board: `plans-wip/0-candidate-slices.md`
- Wiki unknowns: `wiki/unknown-*.md`

## Steps

1. **Review exploration** - Read recent `exploration/sessions/*.md`

2. **Identify candidates** - Look for:
   - Bounded deliverables (one concern, clear scope)
   - Value to users (shipping this enables something useful)
   - Foundation pieces (other slices depend on this)
   - Risk reducers (proving unknowns, spikes)

3. **Assess dependencies**:
   - What must exist before this can ship?
   - What does this unblock?

4. **Classify tiers**:
   - T1: Foundation - must ship first
   - T2: Core Value - high value, few deps
   - T3: Enhancement - nice to have
   - T4: Blocked - has unresolved unknowns

5. **Update candidate board** - Add new candidates or re-rank existing

6. **Surface unknowns** - Create `wiki/unknown-U##-*.md` for blockers

## Output Format

Update `plans-wip/0-candidate-slices.md`:

```markdown
| # | Candidate | Source | Status | Dependencies | Notes |
|---|---|---|---|---|---|
| N | <name> | LEG### | proposed | #X, #Y | <context> |
```

## Constraints

- Do NOT create slice plans during discovery
- Each candidate must trace to a source
- Keep candidates small (1-3 day implementation)
- Blocked candidates go to T4 with unknown reference
