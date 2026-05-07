---
tags: [api, rest, fastify, typescript, openapi]
applies_to: [src/services/**]
priority: high
token_budget: medium
owner: platform-team
last_reviewed: 2026-05-07
---

# Skill: API Design

## Purpose

Patterns for implementing REST API endpoints in Fastify services. Load when adding or modifying API endpoints.

## Applicability

Load when: creating new endpoints, modifying request/response contracts, implementing validation, handling auth middleware, or building API clients.

Pair with: `docs/API_CONVENTIONS.md` for URL and envelope conventions.

---

## 1. Route Definition Pattern

All routes follow a consistent structure in Fastify:

```typescript
// src/services/prompt-service/routes/prompts.routes.ts
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { PromptService } from '../prompt.service';

// Define schemas with Zod (converted to JSON Schema for Fastify)
const GetPromptParams = z.object({
  id: z.string().min(1),
});

const CreatePromptBody = z.object({
  name: z.string().min(1).max(200).trim(),
  content: z.string().min(1).max(50_000),
  modelTier: z.enum(['standard', 'premium', 'custom']),
  tags: z.array(z.string().max(50)).max(20).default([]),
});

const promptRoutes: FastifyPluginAsync = async (fastify) => {
  const promptService = fastify.diContainer.resolve(PromptService);

  // GET single resource
  fastify.get<{ Params: z.infer<typeof GetPromptParams> }>(
    '/prompts/:id',
    {
      preHandler: [fastify.authenticate], // auth first
      schema: {
        tags: ['prompts'],
        summary: 'Get prompt by ID',
        params: zodToJsonSchema(GetPromptParams),
        response: { 200: zodToJsonSchema(PromptResponse), 404: zodToJsonSchema(ErrorResponse) },
      },
    },
    async (request, reply) => {
      const params = GetPromptParams.safeParse(request.params);
      if (!params.success) {
        return reply.status(400).send({ error: 'Invalid parameters', code: 'VALIDATION_ERROR' });
      }

      const result = await promptService.getById(params.data.id);

      if (!result.ok) {
        if (result.error === 'NOT_FOUND') {
          return reply.status(404).send({ error: 'Prompt not found', code: 'PROMPT_NOT_FOUND' });
        }
        request.log.error({ error: result.error }, 'Unexpected error fetching prompt');
        return reply.status(500).send({ error: 'Internal error', code: 'INTERNAL_ERROR' });
      }

      return reply.status(200).send({ data: result.value });
    },
  );

  // POST create
  fastify.post<{ Body: z.infer<typeof CreatePromptBody> }>(
    '/prompts',
    {
      preHandler: [fastify.authenticate, fastify.requireRole('editor')],
      schema: { ... },
    },
    async (request, reply) => {
      const body = CreatePromptBody.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: body.error.flatten().fieldErrors,
        });
      }

      const result = await promptService.create(request.user.id, body.data);

      if (!result.ok) {
        if (result.error === 'DUPLICATE') {
          return reply.status(409).send({ error: 'Prompt with this name already exists', code: 'DUPLICATE' });
        }
        request.log.error({ error: result.error }, 'Failed to create prompt');
        return reply.status(500).send({ error: 'Internal error', code: 'INTERNAL_ERROR' });
      }

      return reply.status(201).send({ data: result.value });
    },
  );
};

export default promptRoutes;
```

---

## 2. Authentication and Authorization

Always apply auth before business logic:

```typescript
// Auth middleware: fastify plugin
fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
  const token = request.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return reply.status(401).send({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
  }

  const result = await authService.verifyToken(token);
  if (!result.ok) {
    return reply.status(401).send({ error: 'Invalid or expired token', code: 'AUTH_TOKEN_INVALID' });
  }

  request.user = result.value;
});

// Role check middleware
fastify.decorate('requireRole', (role: UserRole) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user.roles.includes(role)) {
      return reply.status(403).send({ error: 'Insufficient permissions', code: 'FORBIDDEN' });
    }
  };
});
```

**Order of preHandlers always:** `[authenticate, authorize, rateLimit, validate]`

---

## 3. Pagination

All list endpoints must support cursor or page-based pagination:

```typescript
const ListPromptsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['createdAt', 'name', 'updatedAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  model: z.string().optional(),
  status: z.enum(['active', 'archived', 'draft']).optional(),
});

// Response includes pagination meta
return reply.status(200).send({
  data: prompts,
  meta: {
    page: query.page,
    pageSize: query.pageSize,
    total: totalCount,
    hasMore: query.page * query.pageSize < totalCount,
  },
});
```

---

## 4. Spec-First Workflow

**Always write the OpenAPI spec before the implementation:**

```yaml
# openapi/paths/prompts.yaml
/v1/prompts/{id}:
  get:
    operationId: getPromptById
    summary: Get a prompt by ID
    tags: [prompts]
    security:
      - bearerAuth: []
    parameters:
      - in: path
        name: id
        required: true
        schema: { type: string, example: pmt-abc123 }
    responses:
      "200":
        description: Prompt found
        content:
          application/json:
            schema: { $ref: '#/components/schemas/PromptResponse' }
      "404":
        $ref: '#/components/responses/NotFound'
```

Generate TypeScript types from the spec with `openapi-typescript`. The spec is the source of truth.

---

## 5. Error Mapping

Centralize domain error → HTTP status mapping:

```typescript
function mapDomainErrorToHttp(
  error: string,
  reply: FastifyReply,
  logger: Logger,
  context: Record<string, unknown>,
): void {
  const mapping: Record<string, { status: number; message: string }> = {
    NOT_FOUND:          { status: 404, message: 'Resource not found' },
    DUPLICATE:          { status: 409, message: 'Resource already exists' },
    FORBIDDEN:          { status: 403, message: 'Access denied' },
    VALIDATION_ERROR:   { status: 400, message: 'Invalid input' },
    MODEL_UNAVAILABLE:  { status: 503, message: 'Service temporarily unavailable' },
    RATE_LIMIT:         { status: 429, message: 'Too many requests' },
  };

  const mapped = mapping[error];
  if (mapped) {
    reply.status(mapped.status).send({ error: mapped.message, code: error });
    return;
  }

  // Unexpected error
  logger.error({ error, ...context }, 'Unmapped domain error');
  reply.status(500).send({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
}
```

---

## 6. Rate Limiting

Apply rate limiting at the route level for endpoints with different limits than the global default:

```typescript
fastify.register(rateLimitPlugin, {
  global: false, // apply per-route
});

fastify.post('/v1/prompts/:id/execute',
  {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    preHandler: [fastify.authenticate],
  },
  handler,
);
```

---

## 7. API Versioning

When making breaking changes:

```typescript
// Register new version
fastify.register(v2PromptRoutes, { prefix: '/v2' });
fastify.register(v1PromptRoutes, { prefix: '/v1' }); // keep for deprecation period

// Add deprecation headers to v1 routes
fastify.addHook('onSend', async (request, reply) => {
  if (request.url.startsWith('/v1')) {
    reply.header('Deprecation', 'true');
    reply.header('Sunset', 'Sat, 01 Jun 2025 00:00:00 GMT');
    reply.header('Link', '</v2/prompts>; rel="successor-version"');
  }
});
```

---

## Anti-Patterns

| Anti-Pattern | Correct Pattern |
|---|---|
| Trusting request.body without validation | Always validate with Zod |
| Returning raw DB errors | Map to domain errors; return code + message |
| Exposing stack traces | Log internally; return generic message |
| Business logic in route handler | Delegate to service layer |
| Auth check inside business logic | Auth always in preHandler |
| Pagination without a limit | Always enforce maximum pageSize |

---

## Checklist

Before merging an API change:
- [ ] OpenAPI spec written/updated before implementation
- [ ] Zod validation on all request body, params, and query
- [ ] Auth preHandler applied
- [ ] All error cases map to appropriate HTTP status codes
- [ ] Pagination supported on list endpoints
- [ ] Rate limiting applied on expensive endpoints
- [ ] Integration tests cover happy path + 400 + 404 + 401
