---
ai_priority: tier-3
context_type: review-prompts
load_when: code-review, security-review, pr-review
token_budget: low
owner: platform-team
last_reviewed: 2026-05-07
---

# Review Prompts

Focused prompts for specific code review scenarios.

---

## Security Review

```
Review the following code for security vulnerabilities.

Focus exclusively on:
- SQL injection (parameterized queries used?)
- Command injection (user input passed to shell/eval?)
- Prompt injection (user input passed to LLM without sanitization?)
- Authentication bypass (all routes protected?)
- Authorization gaps (role checks applied?)
- Secret exposure (credentials hardcoded or logged?)
- Unvalidated input (Zod validation at all entry points?)
- Information disclosure in error responses

For each finding, provide:
- Location (file:line if available)
- Vulnerability type
- Severity: CRITICAL | HIGH | MEDIUM
- One-line description
- Recommended fix

Ignore style, naming, and non-security issues.

CODE TO REVIEW:
<code>
```

---

## API Contract Review

```
Review the following API endpoint(s) against AIEP API conventions.

Check:
1. URL structure: /v{n}/{resource}/{id}/{sub-resource} (plural nouns, kebab-case)
2. HTTP methods: correct verb for operation (GET=read, POST=create, PUT=replace, PATCH=update, DELETE=remove)
3. Status codes: 200/201/204 for success, 400/401/403/404/409/422/500 for errors
4. Response envelope: { data: T } for success, { error: string, code: string } for errors
5. Pagination: list endpoints have page + pageSize + meta?
6. Validation: input validated with Zod schema?
7. Auth: authenticate + requireRole preHandlers present?

Flag each violation with: [VIOLATION] <convention> — <what's wrong> — <how to fix>

API CODE:
<code>
```

---

## Test Quality Review

```
Review the following tests for quality and completeness.

Assess:
1. Coverage: are happy path + all error paths + edge cases covered?
2. Structure: Arrange/Act/Assert pattern used?
3. Naming: "should [verb] [outcome] when [condition]" format?
4. Isolation: tests reset state in beforeEach? No shared mutable state?
5. Mocking: only I/O dependencies mocked (not pure business logic)?
6. Assertions: specific assertions (not just toEqual({}))? Error paths explicitly tested?
7. Flakiness risk: any timing dependencies, real timeouts, or global state?

Provide:
- Missing test cases list
- Quality issues list
- Overall assessment: ADEQUATE | NEEDS IMPROVEMENT | INSUFFICIENT

TESTS TO REVIEW:
<code>
```

---

## Performance Review

```
Review the following code for performance issues.

Check for:
1. N+1 queries (DB queries inside loops)
2. Missing database indexes (WHERE/JOIN/ORDER BY columns)
3. Sequential async operations that could be parallelized (Promise.all)
4. Unbounded queries (missing LIMIT)
5. Large payload handling (SELECT * on large tables)
6. Missing caching for expensive, repeated operations
7. Event loop blocking (CPU-intensive work on main thread)
8. Memory leaks (event listeners not removed, large closures)

For each finding:
- Location
- Issue type
- Estimated impact: HIGH | MEDIUM | LOW
- Recommended fix

CODE TO REVIEW:
<code>
```

---

## Related Files

- `.ai/prompts/system-prompts.md` — full system prompts for each role
- `.ai/prompts/task-prompts.md` — task-oriented prompts
- `docs/SECURITY_RULES.md` — security rules reference
