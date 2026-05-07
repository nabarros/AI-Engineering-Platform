---
tags: [testing, vitest, jest, typescript, unit, integration]
applies_to: [src/**/*.test.ts, tests/**]
priority: high
token_budget: medium
owner: platform-team
last_reviewed: 2026-05-07
---

# Skill: Testing with Vitest/Jest

## Purpose

Patterns for writing effective unit and integration tests. Load when writing tests, fixing flaky tests, or reviewing test quality.

## Applicability

Load when: writing tests, adding test coverage, debugging test failures. Pair with `docs/TESTING_STRATEGY.md` for strategy and coverage requirements.

---

## 1. Test File Structure

```typescript
// src/services/llm-gateway/routing.service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RoutingService } from './routing.service';
import { createProviderRegistryMock } from '../test-utils/mocks';

describe('RoutingService', () => {
  // Arrange: shared setup
  let routingService: RoutingService;
  let providerRegistry: ReturnType<typeof createProviderRegistryMock>;

  beforeEach(() => {
    providerRegistry = createProviderRegistryMock();
    routingService = new RoutingService({ providerRegistry });
  });

  describe('route', () => {
    it('should return primary provider response when primary is available', async () => {
      // Arrange
      const request = createInferenceRequest({ modelTier: 'standard' });
      providerRegistry.getAvailable.mockResolvedValue([
        createProvider({ name: 'openai', priority: 1 }),
        createProvider({ name: 'anthropic', priority: 2 }),
      ]);
      providerRegistry.call.mockResolvedValue({ ok: true, value: createInferenceResponse() });

      // Act
      const result = await routingService.route(request);

      // Assert
      expect(result.ok).toBe(true);
      expect(providerRegistry.call).toHaveBeenCalledWith('openai', request);
      expect(providerRegistry.call).toHaveBeenCalledTimes(1); // no unnecessary calls
    });

    it('should fall back to secondary provider when primary returns 429', async () => {
      // Arrange
      providerRegistry.call
        .mockResolvedValueOnce({ ok: false, error: 'RATE_LIMITED' }) // primary fails
        .mockResolvedValueOnce({ ok: true, value: createInferenceResponse() }); // fallback succeeds

      // Act
      const result = await routingService.route(createInferenceRequest());

      // Assert
      expect(result.ok).toBe(true);
      expect(providerRegistry.call).toHaveBeenCalledTimes(2);
    });

    it('should return MODEL_UNAVAILABLE error when all providers fail', async () => {
      // Arrange
      providerRegistry.call.mockResolvedValue({ ok: false, error: 'PROVIDER_ERROR' });

      // Act
      const result = await routingService.route(createInferenceRequest());

      // Assert
      expect(result.ok).toBe(false);
      expect(result.error).toBe('MODEL_UNAVAILABLE');
    });

    it('should increment failed_requests metric when routing fails', async () => {
      // Arrange
      const metricsCollector = createMetricsCollectorMock();
      const service = new RoutingService({ providerRegistry, metrics: metricsCollector });
      providerRegistry.call.mockResolvedValue({ ok: false, error: 'PROVIDER_ERROR' });

      // Act
      await service.route(createInferenceRequest());

      // Assert
      expect(metricsCollector.increment).toHaveBeenCalledWith('routing.failed', { reason: 'PROVIDER_ERROR' });
    });
  });
});
```

---

## 2. Mock Factory Pattern

Create mock factories — not inline `vi.fn()` — for consistent, typed mocks:

```typescript
// src/services/llm-gateway/test-utils/mocks.ts
import { vi } from 'vitest';
import type { ProviderRegistry } from '../providers/registry';
import type { InferenceResponse, Provider } from '../types';

export function createProviderRegistryMock(): jest.Mocked<ProviderRegistry> {
  return {
    getAvailable: vi.fn().mockResolvedValue([createProvider()]),
    call: vi.fn().mockResolvedValue({ ok: true, value: createInferenceResponse() }),
    register: vi.fn(),
    getHealth: vi.fn().mockResolvedValue('healthy'),
  };
}

// Fixture builders: sensible defaults, easy to override
export function createProvider(overrides: Partial<Provider> = {}): Provider {
  return {
    name: 'openai',
    priority: 1,
    modelTier: 'standard',
    maxTokens: 128_000,
    isHealthy: true,
    ...overrides,
  };
}

export function createInferenceRequest(overrides: Partial<InferenceRequest> = {}): InferenceRequest {
  return {
    id: 'req-test-001',
    prompt: 'Test prompt',
    modelTier: 'standard',
    maxTokens: 500,
    userId: 'usr-test-001',
    ...overrides,
  };
}

export function createInferenceResponse(overrides: Partial<InferenceResponse> = {}): InferenceResponse {
  return {
    id: 'resp-test-001',
    content: 'Test response',
    inputTokens: 10,
    outputTokens: 20,
    provider: 'openai',
    model: 'gpt-4o-mini',
    durationMs: 250,
    ...overrides,
  };
}
```

---

## 3. Testing Async and Time-Dependent Code

```typescript
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('RetryService', () => {
  beforeEach(() => {
    vi.useFakeTimers(); // control time
  });

  afterEach(() => {
    vi.useRealTimers(); // always restore
  });

  it('should retry after exponential backoff delay', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('Temporary failure'))
      .mockRejectedValueOnce(new Error('Temporary failure'))
      .mockResolvedValue('success');

    const retryPromise = retryWithBackoff(operation, { maxRetries: 3, baseDelay: 100 });

    // First attempt fails immediately
    await vi.advanceTimersByTimeAsync(0);
    expect(operation).toHaveBeenCalledTimes(1);

    // First retry after 100ms
    await vi.advanceTimersByTimeAsync(100);
    expect(operation).toHaveBeenCalledTimes(2);

    // Second retry after 200ms (exponential)
    await vi.advanceTimersByTimeAsync(200);
    expect(operation).toHaveBeenCalledTimes(3);

    const result = await retryPromise;
    expect(result).toBe('success');
  });
});
```

---

## 4. Integration Tests with Testcontainers

```typescript
// tests/integration/prompt.repository.test.ts
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('PromptRepository (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let db: DatabaseClient;
  let repo: PromptRepository;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();

    db = await createDatabaseClient({
      connectionString: container.getConnectionUri(),
    });

    await db.migrate(); // run migrations
    repo = new PromptRepository(db);
  }, 60_000); // generous timeout for container startup

  afterAll(async () => {
    await db.close();
    await container.stop();
  });

  it('should save and retrieve a prompt', async () => {
    // Arrange
    const input = { name: 'Test Prompt', content: 'Hello {name}', modelTier: 'standard' as const };

    // Act
    const saveResult = await repo.save(input);
    expect(saveResult.ok).toBe(true);

    const getResult = await repo.findById(saveResult.value!.id);

    // Assert
    expect(getResult.ok).toBe(true);
    expect(getResult.value?.name).toBe(input.name);
    expect(getResult.value?.content).toBe(input.content);
  });

  it('should return NOT_FOUND for a deleted prompt', async () => {
    // Arrange
    const saveResult = await repo.save({ name: 'To Delete', content: '...', modelTier: 'standard' });
    const id = saveResult.value!.id;
    await repo.softDelete(id);

    // Act
    const result = await repo.findById(id);

    // Assert
    expect(result.ok).toBe(false);
    expect(result.error).toBe('NOT_FOUND');
  });
});
```

---

## 5. Snapshot Testing

Use snapshot testing only for stable, non-critical outputs (e.g., generated report structures). Don't snapshot for logic-heavy code — write explicit assertions.

```typescript
// ACCEPTABLE — stable API response shape
it('should return consistent response structure', async () => {
  const response = await app.inject({ method: 'GET', url: '/v1/prompts/pmt-001' });
  expect(JSON.parse(response.body)).toMatchSnapshot();
});

// BAD USE CASE — snapshots for business logic
it('should calculate cost correctly', () => {
  expect(calculateCost(1000, 'gpt-4o')).toMatchSnapshot(); // use explicit assertion
  // CORRECT: expect(calculateCost(1000, 'gpt-4o')).toBe(0.005);
});
```

---

## 6. Testing Error Paths

Every error path must be explicitly tested:

```typescript
describe('UserService.getUser', () => {
  it('should return NOT_FOUND when user does not exist', async () => {
    userRepo.findById.mockResolvedValue({ ok: false, error: 'NOT_FOUND' });
    const result = await userService.getUser('usr-nonexistent');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('USER_NOT_FOUND');
  });

  it('should log error and return DB_ERROR when repository fails', async () => {
    userRepo.findById.mockResolvedValue({ ok: false, error: 'DB_ERROR', cause: new Error('Connection timeout') });
    const result = await userService.getUser('usr-001');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('SERVICE_ERROR');
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'usr-001' }),
      expect.stringContaining('User lookup failed'),
    );
  });
});
```

---

## Anti-Patterns

| Anti-Pattern | Correct Pattern |
|---|---|
| Testing implementation details (private methods) | Test public API and observable behavior |
| `any` types in test code | Use proper types in mocks and fixtures |
| `sleep()` or `setTimeout()` in tests | Use fake timers |
| Shared mutable state between tests | Reset in `beforeEach` |
| One giant test file | Multiple focused `describe` blocks, split files if > 200 lines |
| `.only` or `.skip` committed to main | Only in local debugging |
| Inline fixture objects | Fixture builder functions |

---

## Vitest Configuration

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      thresholds: { lines: 80, branches: 70, functions: 80 },
      exclude: ['**/*.d.ts', '**/test-utils/**', '**/mocks/**'],
    },
    isolate: true,
    testTimeout: 10_000,
  },
});
```
