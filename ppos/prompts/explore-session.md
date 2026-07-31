# Explore Session Prompt

Mode: `requirement-analysis`

Use this prompt when the human wants to understand, explore, or analyze `LEG*`
legacy artifacts without committing to implementation.

## Inputs

- Human question or exploration goal
- Source IDs (e.g., LEG111, LEG211)
- Prior exploration notes (if any)

## Steps

1. **Create session file** if not exists:
   `exploration/sessions/sicksense-YYYYMMDD-HHMM-<agent>-<topic>.md`

2. **Read the legacy code/artifacts** listed in `raw/INDEX.md`. For each: recover what it does, infer the entities/rules/states it implements, note integration points, and flag any code whose behavior you cannot yet explain as an unknown.

3. **Extract observations** - For each requirement:
   - Key entities mentioned
   - Business rules and constraints
   - Workflow states and transitions
   - Integration points with other modules
   - UI screens implied

4. **Record in session file**:
   - Observations with source citations
   - Questions that arise
   - Contradictions or ambiguities
   - Hypotheses about behavior

5. **Cross-reference** with existing wiki articles and exploration notes

6. **Identify unknowns** - Things that need clarification

## Output Format

```markdown
# Exploration: <topic>

Session: sicksense-YYYYMMDD-HHMM-<agent>-<topic>
Date: YYYY-MM-DD
Source: LEG###, LEG###

## Goal

<What we're trying to understand>

## Observations

### From LEG###

- observation 1 (line N)
- observation 2 (line N)

### From LEG###

- observation 1 (line N)

## Questions

1. question 1
2. question 2

## Hypotheses

- If X then Y (needs verification)

## Unknowns Identified

- U##: description

## Next Steps

- action 1
- action 2
```

## Constraints

- Do NOT edit `wiki/` during exploration
- Do NOT edit source `LEG*` files
- Append to session file; never rewrite history
- Cite specific line numbers when referencing sources
