# Slice Author Prompt

Mode: `slice-authoring`

Use this prompt when the human wants to turn a candidate into a concrete
implementation plan.

## Inputs

- Candidate from `plans-wip/0-candidate-slices.md`
- legacy artifacts (LEG###)
- Related wiki articles
- Dependencies from other slices

## Steps

1. **Run Role Classification Gate** (see CLAUDE.md)

2. **Create slice plan file**: `plans-wip/slice-N-<short-name>.md`

3. **Define scope**:
   - What's included
   - What's explicitly excluded
   - Sources traced

4. **Identify phases**:
   - Backend domain/infra
   - Backend API
   - Frontend
   - Integration/E2E

5. **List exit criteria**:
   - Tests passing
   - Smoke test scenarios
   - Documentation updates

6. **Note dependencies and risks**

## Output Format

````markdown
# Slice N: <Title>

```yaml
status: draft | accepted | in-progress | completed
tier: T1 | T2 | T3
source: LEG###, LEG###
depends-on: [slice-M, ...]
blocks: [slice-P, ...]
```

## Scope

### Included

- item 1
- item 2

### Excluded

- item 1

## Phases

### Phase 1: Backend Domain

- [ ] task 1
- [ ] task 2

### Phase 2: Backend API

- [ ] task 1

### Phase 3: Frontend

- [ ] task 1

## Exit Criteria

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Smoke: <scenario>

## Risks

- risk 1: mitigation

## Open Questions

- question 1
````

## Constraints

- Get human approval before moving to `accepted`
- Each phase should be independently verifiable
- Exit criteria must be testable
