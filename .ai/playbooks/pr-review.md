---
ai_priority: tier-3
context_type: pr-workflow
load_when: reviewing-pr, submitting-pr, code-review
token_budget: low
owner: platform-team
last_reviewed: 2026-05-07
---

# Playbook: PR Review

Checklist and workflow for submitting and reviewing pull requests.

---

## Author Checklist (before requesting review)

### Code Quality
```
□ Tests added or updated (co-located with changed files)
□ All tests pass locally: pnpm test --run
□ TypeScript builds: pnpm build
□ Linter passes: pnpm lint
□ No console.log / debugger / breakpoint() left in code
□ No @ts-ignore without explanatory comment
□ No hardcoded secrets, URLs, or credentials
```

### Security
```
□ User input validated at system boundary (Zod schema)
□ All SQL uses parameterized queries
□ Auth middleware applied to new endpoints
□ No tokens, passwords, or PII in log statements
□ Error responses don't expose stack traces or file paths
```

### Architecture
```
□ Services don't access each other's databases directly
□ New environment variables documented
□ Breaking API changes follow versioning convention
□ New dependencies justified (alternatives considered)
□ Migration files are forward-only and follow naming convention
```

### PR Presentation
```
□ PR title follows: <type>: <short description>
   types: feat, fix, refactor, chore, docs, test, perf
□ PR description: what changed, why, how to test
□ If large PR: linked design doc or ADR
□ PR size target: < 400 lines (excluding migrations and generated code)
□ Linked Jira ticket in PR description
```

---

## Reviewer Checklist

### First Pass (5 min) — Is this reviewable?
```
□ PR has a description explaining what and why
□ Tests are present
□ PR is appropriately sized (not a 2000-line dump)
□ Not mixing refactor + feature in same PR
```

### Code Review
```
□ Does the code do what the description says?
□ Are edge cases handled? (empty array, null, concurrent access)
□ Is the error handling complete and correct?
□ Are there obvious N+1 queries or performance issues?
□ Does new functionality have tests covering happy path + error paths?
□ Are new abstractions clearly necessary (not premature)?
```

### Security Review (required for any auth, data, or API change)
```
□ No injection vulnerabilities (SQL, command, prompt)
□ Auth applied correctly; no unauthorized data access
□ No secrets in code or logs
□ Input validated at boundaries
```

---

## Review Etiquette

**As Author:**
- Respond to all comments, even if just "done" or "acknowledged"
- Do not resolve reviewer comments yourself
- If you disagree: explain your reasoning, don't silently change

**As Reviewer:**
- Label comments: `nit:` (optional), `must:` (required to merge), `question:` (seeking understanding)
- Approve when all `must:` items are resolved
- Do not block on `nit:` items — leave them and approve

---

## Merge Rules

```
□ At least 1 approval required (2 for shared packages, security changes)
□ All CI checks green
□ No unresolved `must:` comments
□ Squash-merge with conventional commit title
□ Delete branch after merge
```

---

## PR Types and Review Depth

| PR Type | Required Reviewers | Focus |
|---|---|---|
| Bug fix | 1 engineer | Correctness, regression test |
| Feature (internal API) | 1 engineer | Correctness, tests, API contract |
| Feature (public API) | 2 engineers | API design, backwards compat, security |
| Security change | 1 engineer + security-team | Auth flow, no secrets, OWASP |
| Shared package change | 2 engineers + affected team | Breaking changes, versioning |
| Infrastructure / migrations | 1 engineer + DBA | Safety, reversibility |

---

## Related Files

- `CONTRIBUTING.md` — branch naming, commit conventions, PR requirements
- `docs/SECURITY_RULES.md` — security review checklist
- `docs/API_CONVENTIONS.md` — API design review guidance
