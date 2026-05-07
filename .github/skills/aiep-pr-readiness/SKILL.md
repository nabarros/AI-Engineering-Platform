---
name: aiep-pr-readiness
description: 'Performs pre-PR readiness checks for AI-Engineering-Platform: security, tests, contract consistency, and documentation updates. Use before opening a PR.'
argument-hint: 'Provide the change scope (files or feature) and intended PR goal.'
user-invocable: true
---
# AIEP PR Readiness

## When to Use
- Before creating a pull request.
- After a significant feature, refactor, or bug fix.

## Procedure
1. Validate security constraints:
   - No hardcoded secrets.
   - No auth bypass patterns.
   - Parameterized SQL only.
2. Validate quality gates:
   - Relevant tests exist and pass.
   - No new lint/type errors in touched areas.
3. Validate contracts and docs:
   - API changes aligned with `docs/API_CONVENTIONS.md`.
   - Public interface updates reflected in docs/changelog where required.
4. Validate operational impact:
   - Logging/error responses are safe.
   - Performance-sensitive changes include safeguards.
5. Return a findings-first report with severity.

## Output Requirements
- Blocking issues.
- Non-blocking recommendations.
- Missing tests/docs checklist.
- Go/No-Go recommendation for PR.
