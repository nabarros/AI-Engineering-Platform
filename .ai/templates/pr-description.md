---
ai_priority: tier-3
context_type: template
load_when: creating-pr, writing-pr-description
token_budget: low
owner: platform-team
last_reviewed: 2026-05-07
---

# Template: PR Description

```markdown
## What

[One sentence describing what this PR does.]

[2-3 sentences of additional context if needed: why this change, what problem it solves.]

Jira: [AIEP-XXXX]

---

## Type of Change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] Feature (non-breaking change that adds functionality)
- [ ] Breaking change (changes existing API contract or behavior)
- [ ] Refactor (no behavior change — structural improvement only)
- [ ] Chore (deps, config, CI, docs)

---

## Changes

<!-- List significant changes. Focus on non-obvious decisions. -->

- Added `X` to handle edge case `Y`
- Changed `Z` from `A` to `B` because `reason`
- Removed `legacy/foo` — superseded by `bar` (rolled out 100%)

---

## How to Test

<!-- Steps for a reviewer to verify this works locally or in staging. -->

1. Run: `pnpm test --run src/services/<service>/`
2. Start the service and call: `curl -X POST http://localhost:3001/v1/...`
3. Expected result: `{ data: { ... } }`

---

## Checklist

- [ ] Tests added/updated
- [ ] All tests pass (`pnpm test --run`)
- [ ] Build passes (`pnpm build`)
- [ ] No secrets or credentials in code
- [ ] Auth applied to new endpoints
- [ ] If migration: reviewed for zero-downtime safety
- [ ] If new env var: added to deployment secrets

---

## Screenshots / Output (if applicable)

<!-- For UI changes: before/after screenshots. For API: example request/response. -->

---

## Notes for Reviewer

<!-- Anything that needs special attention, areas of uncertainty, or explanations of non-obvious decisions. -->
```

---

## PR Title Format

```
<type>(<scope>): <short description>

Types: feat | fix | refactor | chore | docs | test | perf | security
Scope: service name or component (optional)

Examples:
feat(llm-gateway): add semantic cache for inference responses
fix(prompt-service): prevent duplicate versions on concurrent save
refactor(agent-runtime): extract tool executor to separate class
chore: upgrade @opentelemetry/sdk to 1.28.0
```
