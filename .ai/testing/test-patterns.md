---
ai_priority: tier-3
context_type: test-patterns
load_when: writing-tests, test-quality-review
token_budget: medium
owner: platform-team
last_reviewed: 2026-05-07
---

# Test Patterns

Concrete test patterns with full examples. For strategy and coverage requirements, see `docs/TESTING_STRATEGY.md`.

---

## 1. Service Unit Test

```typescript
// src/services/prompt-service/prompt.service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PromptService } from './prompt.service';
import { createPromptRepositoryMock, createPrompt, createCreatePromptInput } from './test-utils/mocks';

describe('PromptService', () => {
  let service: PromptService;
  let promptRepo: ReturnType<typeof createPromptRepositoryMock>;

  beforeEach(() => {
    promptRepo = createPromptRepositoryMock();
    service = new PromptService({ promptRepo });
  });

  describe('create', () => {
    it('should create a prompt and return it when input is valid', async () => {
      // Arrange
      const input = createCreatePromptInput({ name: 'Test Prompt', modelTier: 'standard' });
      const expected = createPrompt({ name: 'Test Prompt' });
      promptRepo.save.mockResolvedValue({ ok: true, value: expected });

      // Act
      const result = await service.create('usr-001', input);

      // Assert
      expect(result.ok).toBe(true);
      expect(result.value?.name).toBe('Test Prompt');
      expect(promptRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Test Prompt', modelTier: 'standard' })
      );
    });

    it('should return DUPLICATE error when name already exists in org', async () => {
      // Arrange
      promptRepo.save.mockResolvedValue({ ok: false, error: 'DUPLICATE' });

      // Act
      const result = await service.create('usr-001', createCreatePromptInput());

      // Assert
      expect(result.ok).toBe(false);
      expect(result.error).toBe('PROMPT_DUPLICATE');
    });

    it('should return SERVICE_ERROR and log when repository throws DB_ERROR', async () => {
      // Arrange
      const logger = { error: vi.fn() };
      service = new PromptService({ promptRepo, logger });
      promptRepo.save.mockResolvedValue({ ok: false, error: 'DB_ERROR', cause: new Error('timeout') });

      // Act
      const result = await service.create('usr-001', createCreatePromptInput());

      // Assert
      expect(result.ok).toBe(false);
      expect(result.error).toBe('SERVICE_ERROR');
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'usr-001' }),
        expect.stringContaining('Failed to create prompt'),
      );
    });
  });
});
```

---

## 2. Route Handler Test (Fastify)

```typescript
// src/services/prompt-service/routes/prompts.routes.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { buildTestApp } from '../test-utils/app-builder';

describe('POST /v1/prompts', () => {
  let app: ReturnType<typeof buildTestApp>;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  it('should return 201 and created prompt when request is valid', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/prompts',
      headers: { authorization: 'Bearer valid-editor-token' },
      payload: { name: 'My Prompt', content: 'Hello {{name}}', modelTier: 'standard' },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.data).toMatchObject({ name: 'My Prompt' });
    expect(body.data.id).toBeDefined();
  });

  it('should return 400 with field errors when required fields are missing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/prompts',
      headers: { authorization: 'Bearer valid-editor-token' },
      payload: { name: '' }, // missing content and modelTier
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.details).toBeDefined();
  });

  it('should return 401 when no auth token provided', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/prompts',
      payload: { name: 'My Prompt', content: '...', modelTier: 'standard' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('should return 403 when user has viewer role (not editor)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/prompts',
      headers: { authorization: 'Bearer valid-viewer-token' },
      payload: { name: 'My Prompt', content: '...', modelTier: 'standard' },
    });

    expect(response.statusCode).toBe(403);
  });

  it('should return 409 when prompt name already exists', async () => {
    // Create first
    await app.inject({ method: 'POST', url: '/v1/prompts', headers: { authorization: 'Bearer valid-editor-token' }, payload: { name: 'Duplicate', content: '...', modelTier: 'standard' } });

    // Create duplicate
    const response = await app.inject({ method: 'POST', url: '/v1/prompts', headers: { authorization: 'Bearer valid-editor-token' }, payload: { name: 'Duplicate', content: '...', modelTier: 'standard' } });

    expect(response.statusCode).toBe(409);
    expect(JSON.parse(response.body).code).toBe('DUPLICATE');
  });
});
```

---

## 3. Python Service Test

```python
# src/ml/inference-service/tests/test_inference_service.py
import pytest
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4
from app.inference.inference_service import InferenceService
from app.inference.schemas import InferenceRequest

@pytest.fixture
def mock_provider():
    provider = AsyncMock()
    provider.complete.return_value = MagicMock(
        content="Test response",
        input_tokens=10,
        output_tokens=20,
        model="gpt-4o-mini",
    )
    return provider

@pytest.fixture
def service(mock_provider):
    return InferenceService(provider=mock_provider)

@pytest.fixture
def inference_request():
    return InferenceRequest(
        id=str(uuid4()),
        prompt="Test prompt",
        model_tier="standard",
        max_tokens=500,
        user_id="usr-001",
    )

class TestInferenceService:
    async def test_should_return_response_when_provider_succeeds(
        self, service, mock_provider, inference_request
    ):
        # Arrange (done in fixtures)

        # Act
        result = await service.infer(inference_request)

        # Assert
        assert result.ok is True
        assert result.value.content == "Test response"
        mock_provider.complete.assert_called_once_with(inference_request.prompt)

    async def test_should_return_error_when_provider_rate_limited(
        self, service, mock_provider, inference_request
    ):
        # Arrange
        mock_provider.complete.side_effect = RateLimitError("Rate limit exceeded")

        # Act
        result = await service.infer(inference_request)

        # Assert
        assert result.ok is False
        assert result.error == "RATE_LIMITED"

    async def test_should_log_error_when_provider_fails(
        self, service, mock_provider, inference_request, caplog
    ):
        # Arrange
        mock_provider.complete.side_effect = Exception("Connection error")

        # Act
        await service.infer(inference_request)

        # Assert
        assert "inference failed" in caplog.text.lower()
```

---

## 4. Mock Factory Examples

```typescript
// src/services/prompt-service/test-utils/mocks.ts
import { vi } from 'vitest';
import type { PromptRepository } from '../repositories/prompt.repository';

export function createPromptRepositoryMock(): jest.Mocked<PromptRepository> {
  return {
    findById: vi.fn().mockResolvedValue({ ok: true, value: createPrompt() }),
    findByOrg: vi.fn().mockResolvedValue({ ok: true, value: { items: [], total: 0, page: 1, pageSize: 20 } }),
    save: vi.fn().mockResolvedValue({ ok: true, value: createPrompt() }),
    softDelete: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
  };
}

export function createPrompt(overrides: Partial<Prompt> = {}): Prompt {
  return {
    id: 'pmt-test-001',
    orgId: 'org-test-001',
    name: 'Test Prompt',
    modelTier: 'standard',
    status: 'active',
    tags: [],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

export function createCreatePromptInput(overrides: Partial<CreatePromptInput> = {}): CreatePromptInput {
  return {
    name: 'Test Prompt',
    content: 'Hello {{name}}',
    modelTier: 'standard',
    tags: [],
    ...overrides,
  };
}
```

---

## Related Files

- `docs/TESTING_STRATEGY.md` — strategy and coverage requirements
- `.ai/skills/testing-jest.md` — Vitest patterns and configuration
- `.ai/testing/coverage-standards.md` — coverage requirements by module type
