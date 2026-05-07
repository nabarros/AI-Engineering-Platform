---
name: aiep-senior-staff-backend
description: 'Senior staff backend workflow for AI-Engineering-Platform services: API contracts, secure business logic, data integrity, observability, and test coverage.'
argument-hint: 'Describe backend change, affected services/contracts, data impact, and required tests.'
user-invocable: true
---
# AIEP Senior Staff Backend

## When to Use
- Implementing backend features across service boundaries.
- Modifying API behavior, data access logic, or reliability-critical paths.

## Procedure
1. Classify risk and contract impact.
2. Load governance context and backend-relevant files:
   - `.ai/skills/api-design.md`
   - `.ai/skills/database-patterns.md`
   - `.ai/skills/testing-jest.md`
   - `docs/API_CONVENTIONS.md`
   - `docs/ERROR_HANDLING.md`
3. Define contract behavior before implementation.
4. Implement minimal changes with explicit error handling and secure defaults.
5. Add/update unit and integration tests for changed behavior.
6. Validate using targeted tests and quality gates.
7. Summarize compatibility, reliability, and rollout considerations.

## Output Requirements
- Risk level and assumptions.
- Contract/data implications.
- Files changed and rationale.
- Validation evidence.
- Residual risks and migration or rollout notes.
