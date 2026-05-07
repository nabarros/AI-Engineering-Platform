---
ai_priority: high
context_type: governance
load_when: writing tests, evaluating test coverage, debugging test failures
token_budget: medium
---

# Testing Strategy

## AI Agent Load Guidance

Load this file when writing tests or evaluating whether existing code has adequate coverage. Load `.ai/skills/testing-jest.md` for concrete Vitest/Jest patterns.

---

## Testing Philosophy

Tests are executable documentation. A well-written test suite should communicate:
- What the system is supposed to do (test names as specifications)
- What inputs produce what outputs
- What invariants must always hold
- What failure modes have been considered

Code without tests is incomplete. A PR without tests for new behavior will not be merged.

---

## Test Types and Requirements

### Unit Tests

**Purpose:** Verify that individual functions and modules work correctly in isolation.

**Requirements:**
- All business logic functions must have unit tests
- All utility functions must have unit tests
- All data transformation logic must have unit tests
- Mock all I/O: database, HTTP calls, file system, timers, random

**Coverage gate:** 80% line coverage, 70% branch coverage per module

**Location:** Co-located with source — `foo.service.ts` → `foo.service.test.ts`

**Performance target:** Full unit suite < 30 seconds

### Integration Tests

**Purpose:** Verify that components work correctly together, including real database interactions and real external service behavior.

**Requirements:**
- All database queries must have integration tests
- All repository methods must be tested against a real database (test container)
- All API routes must have integration tests
- External service calls must use test doubles unless specifically testing integration

**Infrastructure:** Docker Compose via Testcontainers for PostgreSQL, Redis, Weaviate

**Location:** `tests/integration/{domain}/`

**Performance target:** Full integration suite < 15 minutes

### End-to-End Tests

**Purpose:** Verify complete user flows from the API surface through to persistent state.

**Requirements:**
- Critical user journeys must be covered (see `.ai/product/product-context.md` for journey list)
- Run against staging environment before production deployment
- Must not depend on production data

**Tool:** Playwright for frontend flows; custom API test harness for backend flows

**Location:** `tests/e2e/`

**Performance target:** Full E2E suite < 30 minutes

### Contract Tests

**Purpose:** Verify that API contracts (OpenAPI specs) are honoured by both producer and consumer.

**Requirements:**
- Every service that exposes an API must run contract tests in CI
- Every service that consumes an external API must run consumer-driven contract tests

**Tool:** Pact for consumer-driven contracts

**Location:** `tests/contracts/`

---

## Test Naming Convention

Test names must be full sentences that describe behaviour:

```
should [verb] [expected outcome] when [condition]
```

```typescript
// GOOD
describe('LlmGateway.route', () => {
  it('should return the primary provider response when it is available');
  it('should fall back to secondary provider when primary returns 429');
  it('should reject the request when all providers are unavailable');
  it('should increment the failed_requests counter when routing fails');
});

// BAD
describe('LlmGateway', () => {
  it('test routing');
  it('fallback works');
  it('error case');
});
```

---

## Test Structure: Arrange / Act / Assert

All tests should follow the AAA pattern with a blank line between sections:

```typescript
it('should return user data when the user exists', async () => {
  // Arrange
  const userId = 'user-123';
  const expectedUser = createUserFixture({ id: userId });
  userRepo.findById.mockResolvedValue({ ok: true, value: expectedUser });

  // Act
  const result = await userService.getUser(userId);

  // Assert
  expect(result.ok).toBe(true);
  expect(result.value).toEqual(expectedUser);
  expect(userRepo.findById).toHaveBeenCalledWith(userId);
});
```

---

## Mocking Strategy

### What to Mock in Unit Tests

- Database repositories (always)
- HTTP clients (always)
- File system operations (always)
- Time (`Date.now()`, timers) — use vitest fake timers
- Randomness (`Math.random()`, `crypto.randomUUID()`) — seed or mock

### What NOT to Mock

- Your own utility functions — they should be tested directly
- Simple data transformation logic — test the real function
- Domain model classes — use real instances

### Mock Quality

Mocks must reflect the contract of the real dependency:
- Same types as the real interface
- Same error modes (throw the same error types, same error shapes)
- Same async behaviour (don't return synchronously if the real function is async)

```typescript
// GOOD — faithful mock
const mockUserRepo = {
  findById: vi.fn<[string], Promise<Result<User, 'NOT_FOUND' | 'DB_ERROR'>>>(),
};

// BAD — returns wrong type
const mockUserRepo = {
  findById: vi.fn().mockResolvedValue(null), // real function returns Result<User, E>
};
```

---

## Test Data Management

### Fixture Functions

Create fixture builder functions rather than hardcoded objects:

```typescript
function createUserFixture(overrides: Partial<User> = {}): User {
  return {
    id: 'user-test-001',
    email: 'test@example.com',
    role: 'viewer',
    createdAt: new Date('2024-01-01'),
    ...overrides,
  };
}
```

### Database Seeding

- Integration tests seed their own data in a `beforeEach` or `beforeAll`
- Use transactions and rollback after tests to keep the database clean
- Never depend on data inserted by another test

### Test Isolation

- Every test must be independently runnable
- Tests must not share mutable state
- Tests must not depend on execution order
- Parallel test execution must be safe

---

## Regression Tests

Every bug fix **must** include a regression test that:
1. Demonstrates the bug (the test fails before the fix)
2. Verifies the fix (the test passes after the fix)
3. Guards against reintroduction

```typescript
// Regression test for issue #842: user lookup returned null for uppercase email
it('should find user regardless of email case', async () => {
  await db.users.insert({ email: 'User@Example.com', ... });
  
  const result = await userService.findByEmail('user@example.com');
  
  expect(result.ok).toBe(true);
});
```

---

## CI Test Gates

| Gate | Threshold | Blocks Merge |
|------|-----------|--------------|
| Unit tests pass | 100% | Yes |
| Integration tests pass | 100% | Yes |
| Line coverage | ≥ 80% | Yes |
| Branch coverage | ≥ 70% | Yes |
| Performance regression | > 20% slower | Warning |
| E2E tests | Staging only | Yes (deployment gate) |

---

## Flaky Test Policy

A flaky test is a test that passes or fails non-deterministically. Flaky tests are treated as bugs:

1. Mark with `it.skip` immediately with a linked issue
2. Fix root cause within 5 business days
3. If not fixed, the test is deleted and the issue remains open
4. Never merge code that causes a previously green test to become flaky

---

## Test Performance

- Slow tests are code smells — they indicate testing through too many layers
- Profile slow test suites with `vitest --reporter=verbose`
- Tests > 5 seconds individually should be reviewed for unnecessary I/O or sleep calls
- Use `--isolate false` for Vitest when sharing module instances is safe

---

## Python Testing

- `pytest` for all Python services
- `pytest-asyncio` for async tests
- `httpx` for testing FastAPI endpoints
- `freezegun` for time-dependent tests
- Fixtures in `conftest.py` at the lowest scope that makes sense

```python
# GOOD — descriptive, structured
async def test_embed_document_raises_when_weaviate_unavailable(
    agent_runtime: AgentRuntime,
    mock_weaviate: MockWeaviateClient,
) -> None:
    # Arrange
    mock_weaviate.embed.side_effect = WeaviateConnectionError("timeout")

    # Act / Assert
    with pytest.raises(ServiceUnavailableError, match="Vector store unavailable"):
        await agent_runtime.embed("test document")
```
