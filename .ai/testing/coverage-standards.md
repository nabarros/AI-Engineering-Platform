---
ai_priority: tier-3
context_type: coverage-standards
load_when: writing-tests, coverage-review, ci-failures
token_budget: low
owner: platform-team
last_reviewed: 2026-05-07
---

# Coverage Standards

Coverage requirements by module type. These are enforced in CI.

---

## Coverage Gates (CI Enforcement)

| Module Type | Lines | Branches | Functions | Notes |
|---|---|---|---|---|
| Service layer (`*.service.ts`) | 85% | 75% | 90% | Core business logic — high coverage required |
| Repository layer (`*.repository.ts`) | 80% | 70% | 85% | DB code — integration tests count toward coverage |
| Route handlers (`*.routes.ts`) | 80% | 70% | 85% | Happy path + all status codes |
| Utility functions (`*.utils.ts`) | 90% | 80% | 95% | Pure functions — should be easy to cover fully |
| Shared packages (`packages/*/src`) | 90% | 80% | 95% | Shared code has higher standard |
| Configuration modules (`*.config.ts`) | 60% | 50% | 70% | Often env-dependent; integration tests cover |
| Migration files (`migrations/*.sql`) | N/A | N/A | N/A | SQL files exempt from coverage |
| Generated code (`*.generated.ts`) | N/A | N/A | N/A | Excluded from coverage |
| Test utilities (`test-utils/**`) | N/A | N/A | N/A | Excluded from coverage |

---

## Vitest Coverage Configuration

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        '**/*.d.ts',
        '**/test-utils/**',
        '**/mocks/**',
        '**/*.generated.ts',
        '**/migrations/**',
        '**/index.ts',         // re-export barrel files
        '**/*.config.ts',
      ],
      thresholds: {
        // Global minimum (individual file thresholds in package configs)
        lines: 80,
        branches: 70,
        functions: 80,
        perFile: false,        // enforce globally, not per-file
      },
      reporter: ['text', 'lcov', 'json-summary'],
    },
  },
});
```

---

## What Coverage Does and Does Not Prove

**Coverage measures:** Was this code executed during tests?

**Coverage does NOT measure:** Were the correct assertions made? Were edge cases validated?

### Example: High coverage, bad tests

```typescript
// 100% line coverage — but no assertions
it('should process request', async () => {
  const result = await service.processRequest(createRequest());
  // missing: expect(result.ok).toBe(true);
  // missing: expect(result.value).toMatchObject({ ... });
});
```

Coverage gates prevent gaps in execution. Code review enforces assertion quality.

---

## How to Measure Coverage Locally

```bash
# Run coverage for a single service
pnpm vitest run --coverage src/services/prompt-service

# Run with detailed per-file report
pnpm vitest run --coverage --reporter=verbose src/services/prompt-service

# Generate HTML report
pnpm vitest run --coverage --coverage.reporter=html
open coverage/index.html
```

---

## Coverage Exemptions

To exempt specific lines from coverage (use sparingly):

```typescript
// For unreachable code that TypeScript requires
/* v8 ignore next */
throw new Error('This code path should never be reached');

// For defensive fallbacks that are intentionally hard to test
/* v8 ignore next 3 */
if (!process.env.REQUIRED_VAR) {
  throw new Error('Missing REQUIRED_VAR environment variable');
}
```

Add a comment explaining why the exemption is justified. Exemptions are reviewed in PR.

---

## Python Coverage Configuration

```toml
# pyproject.toml
[tool.pytest.ini_options]
addopts = "--cov=app --cov-report=term-missing --cov-report=xml"

[tool.coverage.run]
source = ["app"]
omit = [
  "app/tests/**",
  "app/migrations/**",
  "**/test_*.py",
  "**/*_test.py",
]

[tool.coverage.report]
fail_under = 80
show_missing = true
```

---

## Related Files

- `docs/TESTING_STRATEGY.md` — testing philosophy and strategy
- `.ai/testing/test-patterns.md` — concrete test patterns
- `.ai/skills/testing-jest.md` — Vitest configuration and patterns
