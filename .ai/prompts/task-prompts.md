---
ai_priority: tier-3
context_type: task-prompts
load_when: task-decomposition, autonomous-agents, multi-step-planning
token_budget: low
owner: platform-team
last_reviewed: 2026-05-07
---

# Task Prompts

Templates for decomposing and executing common engineering tasks.

---

## Add a New REST Endpoint

```
Task: Add a new REST endpoint to [service-name].

Endpoint spec:
- Method: [GET|POST|PUT|PATCH|DELETE]
- Path: /v1/[resource]/[params]
- Purpose: [what this endpoint does]
- Auth: [required role or public]
- Request body/params: [describe or provide schema]
- Response: [describe success and error cases]

Execute in this order:
1. Write the OpenAPI spec entry (openapi/paths/[resource].yaml)
2. Create Zod schemas for request and response
3. Add the route handler in src/services/[service]/routes/[resource].routes.ts
4. Add service method in src/services/[service]/[resource].service.ts
5. Add repository method if DB access needed
6. Write tests: happy path + 400 + 401/403 + 404/409 where applicable
7. Update CHANGELOG

Standards:
- Auth: authenticate preHandler required, requireRole if not public
- Validation: Zod safeParse on all inputs; return 400 with fieldErrors on failure
- Error mapping: use centralized mapDomainErrorToHttp()
- Response envelope: { data: T } for success; { error, code } for errors
```

---

## Fix a Bug

```
Task: Fix the following bug.

Bug description: [describe what is broken]
Affected service: [service-name]
Jira ticket: [AIEP-XXXX]

Execute in this order:
1. Write a failing regression test that reproduces the bug
   - Location: tests/regression/bug-[ticket-id].test.ts
   - The test MUST fail before the fix
2. Identify the root cause (do not guess — trace through the code)
3. Apply the minimal fix
4. Verify: the regression test now passes
5. Verify: all existing tests still pass (pnpm test --run)
6. Update known-issues.md if this bug was documented there

Do NOT refactor surrounding code while fixing the bug.
Do NOT change behavior beyond what is necessary to fix the reported issue.
```

---

## Add Database Migration

```
Task: Create a database migration for [service-name].

Change description: [describe schema change]
Type: [ADD COLUMN | ADD TABLE | ADD INDEX | RENAME | DROP]
Table: [table-name]
Estimated table size: [row count or "unknown"]

Execute in this order:
1. Determine if zero-downtime approach is needed:
   - If ADD NON-NULL COLUMN: use 3-phase pattern (see migration-strategy.md)
   - If RENAME COLUMN: use 4-phase pattern
   - If ADD INDEX: use CONCURRENTLY
   - If ADD NULLABLE COLUMN or ADD TABLE: single migration is safe
2. Write migration file: migrations/V{next-seq}__{description}.sql
3. Include rollback SQL in file header comment
4. Write test: verify migration runs cleanly on empty schema
5. Update database-conventions.md if this introduces a new pattern

Standards:
- Parameterized queries only (no string interpolation)
- IF NOT EXISTS / IF EXISTS guards for idempotency
- Batch large backfills (see migration-strategy.md Section 4)
```

---

## Refactor a Service

```
Task: Refactor [file or module] in [service-name].

Motivation: [why this refactor is needed — which standard is violated]
Target state: [what the code should look like after]

Execute in this order:
1. Confirm all tests pass before touching code: pnpm test --run src/path/to/file
2. Identify the refactor type:
   - Extract function: see refactoring-rules.md Section 2
   - Split file: see refactoring-rules.md Section 4
   - Rename symbol: use language server rename (F2), not find/replace
3. Apply the refactor
4. Run tests after each structural change — tests must always pass
5. Run build: pnpm build (no new TypeScript errors)
6. Commit: "refactor: [description]"

Rules:
- No behavior changes
- No bug fixes in the same PR
- No style changes mixed with structural changes
```

---

## Write Tests for Existing Code

```
Task: Write tests for [file/function/class] in [service-name].

Coverage target: [line coverage %, or "happy path + all errors"]
Priority: [unit | integration | both]

For each public function or endpoint, write:
1. Happy path test (expected success case)
2. Each documented error path (NOT_FOUND, DUPLICATE, AUTH_ERROR, etc.)
3. Edge cases: empty input, maximum values, concurrent access if applicable

Standards:
- Test file: co-located with source file (same directory, .test.ts suffix)
- Test naming: "should [verb] [outcome] when [condition]"
- Mocking: mock all I/O (DB, HTTP, Redis) — never real external calls
- Factory functions: use createX() fixtures — not inline objects
- AAA structure: Arrange / Act / Assert with blank line between sections

After writing:
- pnpm test --run src/path/to/file.test.ts — must all pass
- pnpm test --coverage src/path/to/file.ts — check coverage met target
```

---

## Related Files

- `.ai/prompts/system-prompts.md` — system-level role prompts
- `.ai/prompts/review-prompts.md` — code review prompts
- `.ai/instructions/ai-agent-operating-rules.md` — agent execution governance
