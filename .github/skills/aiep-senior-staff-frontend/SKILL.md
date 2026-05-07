---
name: aiep-senior-staff-frontend
description: 'Senior staff frontend workflow for AI-Engineering-Platform React/TypeScript work: architecture decisions, accessibility, performance, and test-driven implementation.'
argument-hint: 'Describe frontend goal, affected views/components, constraints, and expected tests.'
user-invocable: true
---
# AIEP Senior Staff Frontend

## When to Use
- Designing or implementing complex frontend features.
- Refactoring React architecture with performance or accessibility goals.

## Procedure
1. Confirm task risk level and user-facing impact.
2. Load mandatory governance context, then frontend-relevant files:
   - `.ai/skills/react-patterns.md`
   - `.ai/skills/testing-jest.md`
   - `docs/CODE_STYLE.md`
   - `docs/TESTING_STRATEGY.md`
3. Define component boundaries, state ownership, and error/loading/empty states.
4. Implement minimal, composable changes aligned with existing patterns.
5. Add/update tests for behavior and interaction flows.
6. Validate with frontend lint/typecheck/tests.
7. Summarize residual UX, performance, and accessibility risks.

## Output Requirements
- Risk and assumptions.
- Architecture rationale.
- Files changed and why.
- Validation commands and outcomes.
- Residual risks and follow-up actions.
