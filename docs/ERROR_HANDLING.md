---
ai_priority: high
context_type: patterns
load_when: implementing error handling, reviewing error propagation, debugging failures
token_budget: low
---

# Error Handling

## AI Agent Load Guidance

Load this file when generating any code that can fail. Error handling patterns are enforced by CI linting. Check for compliance in self-review.

---

## Core Principle

**Every failure must be explicitly handled, meaningfully classified, and cleanly propagated.** Swallowed errors and generic catch-all handlers are bugs.

---

## TypeScript Error Patterns

### Result Type

Use `Result<T, E>` for predictable, domain-level failures in business logic:

```typescript
// Type definition (from @aiep/core)
type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E; cause?: unknown };

// Creating results
const success = <T>(value: T): Result<T, never> => ({ ok: true, value });
const failure = <E>(error: E, cause?: unknown): Result<never, E> => ({ ok: false, error, cause });
```

```typescript
// GOOD — explicit failure modes as union types
async function deployPrompt(
  promptId: string,
): Promise<Result<DeployedPrompt, 'PROMPT_NOT_FOUND' | 'VERSION_NOT_FOUND' | 'MODEL_UNAVAILABLE' | 'DB_ERROR'>> {
  const prompt = await promptRepo.findById(promptId);
  if (!prompt.ok) return failure(prompt.error === 'NOT_FOUND' ? 'PROMPT_NOT_FOUND' : 'DB_ERROR');

  const model = await modelRegistry.getActive(prompt.value.modelId);
  if (!model.ok) return failure('MODEL_UNAVAILABLE', model.error);

  return promptRepo.setActive(promptId, prompt.value.version);
}

// Consuming
const result = await deployPrompt(id);
if (!result.ok) {
  switch (result.error) {
    case 'PROMPT_NOT_FOUND':
      return reply.status(404).send({ error: 'Prompt not found', code: result.error });
    case 'MODEL_UNAVAILABLE':
      return reply.status(503).send({ error: 'Model unavailable', code: result.error });
    default:
      logger.error({ error: result.error, cause: result.cause }, 'Unexpected deploy error');
      return reply.status(500).send({ error: 'Internal error', code: 'INTERNAL_ERROR' });
  }
}
```

### Exception vs Result

Use `throw` for:
- Programming errors (invariant violations, type mismatches)
- Unrecoverable infrastructure failures (disk full, OOM)
- Errors that represent bugs, not domain outcomes

Use `Result` for:
- Resource not found
- Validation failures
- Quota exceeded
- External service temporarily unavailable

### HTTP Handler Error Handling

```typescript
// Route handler pattern
fastify.post('/v1/prompts/:id/deploy', async (request, reply) => {
  const { id } = request.params;

  // 1. Validate input at boundary
  const body = DeployRequestSchema.safeParse(request.body);
  if (!body.success) {
    return reply.status(400).send({
      error: 'Invalid request',
      code: 'VALIDATION_ERROR',
      details: body.error.flatten().fieldErrors,
    });
  }

  // 2. Execute business logic
  const result = await promptService.deploy(id, body.data);

  // 3. Map domain errors to HTTP responses
  if (!result.ok) {
    return mapErrorToHttpResponse(result.error, reply);
  }

  // 4. Return success
  return reply.status(200).send({ data: result.value });
});
```

### Global Error Handler

Register a global error handler for unexpected exceptions:

```typescript
fastify.setErrorHandler((error, request, reply) => {
  // Log with context — never expose to client
  logger.error(
    { err: error, requestId: request.id, path: request.url },
    'Unhandled error',
  );

  // Never expose internal error details
  reply.status(500).send({
    error: 'An unexpected error occurred',
    code: 'INTERNAL_ERROR',
    requestId: request.id, // include for support traceability
  });
});
```

---

## Python Error Patterns

### Custom Exception Hierarchy

```python
class AiepError(Exception):
    """Base exception for all AIEP errors."""
    code: str = 'INTERNAL_ERROR'
    http_status: int = 500

class NotFoundError(AiepError):
    code = 'NOT_FOUND'
    http_status = 404

class ValidationError(AiepError):
    code = 'VALIDATION_ERROR'
    http_status = 400

class ServiceUnavailableError(AiepError):
    code = 'SERVICE_UNAVAILABLE'
    http_status = 503

class ModelUnavailableError(ServiceUnavailableError):
    code = 'MODEL_UNAVAILABLE'
```

### FastAPI Exception Handler

```python
@app.exception_handler(AiepError)
async def aiep_error_handler(request: Request, exc: AiepError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.http_status,
        content={
            "error": str(exc),
            "code": exc.code,
            "requestId": request.headers.get("x-request-id"),
        },
    )

@app.exception_handler(Exception)
async def generic_error_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error("Unhandled exception", exc_info=exc, request_id=request.headers.get("x-request-id"))
    return JSONResponse(
        status_code=500,
        content={
            "error": "An unexpected error occurred",
            "code": "INTERNAL_ERROR",
            "requestId": request.headers.get("x-request-id"),
        },
    )
```

### Context Preservation

```python
# GOOD — preserves exception chain and context
try:
    result = await weaviate.query(embedding)
except WeaviateConnectionError as exc:
    raise ServiceUnavailableError("Vector store unavailable") from exc

# BAD — loses original exception context
try:
    result = await weaviate.query(embedding)
except Exception:
    raise ServiceUnavailableError("Vector store unavailable")
```

---

## Logging Error Context

Every error log must include structured context. Never log errors without context.

```typescript
// GOOD — structured, contextual
logger.error(
  {
    userId: request.user.id,
    promptId: id,
    error: result.error,
    duration: Date.now() - startTime,
  },
  'Prompt deployment failed',
);

// BAD — useless for debugging
logger.error('Error deploying prompt');
logger.error(err); // logs entire error object without structure
```

### Log Levels

| Level | When to Use |
|-------|------------|
| `error` | Operation failed; human may need to investigate |
| `warn` | Degraded behavior; recoverable; may indicate systemic issue |
| `info` | Business-significant events (user authenticated, deployment completed) |
| `debug` | Developer diagnostic detail; disabled in production by default |
| `trace` | Very verbose; only in local dev |

---

## Async Error Propagation

```typescript
// GOOD — all promises handled
const results = await Promise.allSettled([
  enrichWithMetadata(prompt),
  recordAuditEvent(prompt.id),
]);

for (const result of results) {
  if (result.status === 'rejected') {
    logger.warn({ reason: result.reason }, 'Non-critical background task failed');
  }
}

// BAD — floating promise
enrichWithMetadata(prompt); // fire-and-forget with no error handling
```

---

## Anti-Patterns

| Pattern | Problem |
|---------|---------|
| Empty catch block | Error is silently swallowed |
| `catch (e) { return null }` | Converts error into ambiguous null |
| `catch (e) { throw e }` | Adds no value; removes context |
| `console.error(err.message)` | Loses stack; unstructured |
| Returning `-1` or `false` for errors | Ad-hoc error signaling |
| Generic `Error` with string messages | No machine-readable error code |
| Catching and re-throwing without `cause` | Breaks error chain |
