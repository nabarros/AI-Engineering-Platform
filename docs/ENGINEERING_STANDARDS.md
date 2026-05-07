---
ai_priority: high
context_type: governance
load_when: writing new code, PR review, evaluating code quality
token_budget: medium
---

# Engineering Standards

## AI Agent Load Guidance

Load this file when generating new code, reviewing existing code, or making decisions about patterns, dependencies, or quality gates. This file defines the non-negotiable quality bar for all code in this repository.

---

## 1. Code Quality Standards

### Complexity Limits

| Metric | Limit | Rationale |
|--------|-------|-----------|
| Function length | 50 lines | Single responsibility |
| File length | 300 lines | Single concern per file |
| Cyclomatic complexity | ≤ 10 per function | Testability |
| Nesting depth | ≤ 4 levels | Readability |
| Function parameters | ≤ 5 (use object param for more) | API clarity |
| Class method count | ≤ 20 | Cohesion |

### Single Responsibility

Every function, class, and module does exactly one thing. When you need to describe a function with "and", it should be split.

### Naming Standards

- Names must be descriptive at their declaration site — no abbreviations in public APIs
- Boolean variables and function return values: use `is`, `has`, `can`, `should` prefix
- Avoid generic names: `data`, `value`, `result`, `temp`, `obj`, `info`
- Use domain language from `docs/DOMAIN_GLOSSARY.md` in variable and function names

```typescript
// GOOD
const isUserAuthenticated = await auth.verify(token);
const pendingInferenceRequests = await llmGateway.getPending();

// BAD
const result = await auth.check(token);
const reqs = await llmGateway.getList();
```

---

## 2. TypeScript Standards

### Strict Configuration

All TypeScript must run with `strict: true`. The following compiler options are non-negotiable:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

### Type Hygiene

- `any` is permitted only with an explanatory comment: `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- [reason]`
- Prefer `unknown` over `any` when the type is genuinely unknown
- Prefer `type` for unions and computed types; `interface` for extendable shapes
- All exported functions must have explicit return types
- Generics must have meaningful names (`TEntity`, `TResult`, not `T`, `U`)

### Error Handling Pattern

Use the `Result<T, E>` pattern for business logic operations that can predictably fail:

```typescript
type Result<T, E = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

// GOOD — explicit failure modes
async function findUser(id: string): Promise<Result<User, 'NOT_FOUND' | 'DB_ERROR'>> {
  try {
    const user = await userRepo.findById(id);
    if (!user) return { ok: false, error: 'NOT_FOUND' };
    return { ok: true, value: user };
  } catch (err) {
    logger.error({ id, err }, 'Database error in findUser');
    return { ok: false, error: 'DB_ERROR' };
  }
}

// BAD — throws for predictable failures
async function findUser(id: string): Promise<User> {
  const user = await userRepo.findById(id);
  if (!user) throw new Error('Not found');
  return user;
}
```

Reserve `throw` for truly exceptional conditions (programming errors, invariant violations).

### Module Organization

```
src/
  services/
    user/
      user.service.ts           ← business logic
      user.service.test.ts      ← co-located tests
      user.repository.ts        ← data access
      user.repository.test.ts
      user.types.ts             ← domain types
      user.schema.ts            ← Zod validation schemas
      index.ts                  ← public exports only
```

Public exports from `index.ts` form the module's API. Internal implementation files are not imported directly from outside the module.

---

## 3. Python Standards

### Type Annotations

All public functions require complete type annotations:

```python
# GOOD
async def embed_document(
    text: str,
    model: EmbeddingModel = EmbeddingModel.DEFAULT,
    namespace: str | None = None,
) -> EmbeddingResult:
    ...

# BAD
async def embed_document(text, model=None, namespace=None):
    ...
```

### Error Handling

```python
# GOOD — specific exception types
try:
    result = await weaviate_client.query(query)
except WeaviateConnectionError as e:
    logger.error("Weaviate connection failed", error=str(e))
    raise ServiceUnavailableError("Vector store unavailable") from e
except WeaviateQueryError as e:
    logger.warning("Query failed", query=query, error=str(e))
    raise InvalidQueryError(str(e)) from e

# BAD — swallowed error
try:
    result = await weaviate_client.query(query)
except Exception:
    return None
```

### Module Structure

```
src/ml/
  agent_runtime/
    __init__.py                 ← public exports
    runtime.py                  ← orchestration logic
    runtime_test.py             ← co-located tests
    models.py                   ← Pydantic models
    tools/
      __init__.py
      web_search.py
      code_execution.py
```

---

## 4. Dependency Management

### Adding a New Dependency

Before adding any new package:

1. **Search first:** Does any existing dependency cover this use case?
2. **Evaluate:** Is the package actively maintained? (last commit < 6 months)
3. **Security:** Run `npm audit` or `pip-audit`; no critical or high CVEs
4. **Size:** For frontend, check bundle impact with `bundlephobia`
5. **License:** OSI-approved license required; GPL requires legal review
6. **Document:** Record decision in `docs/DECISION_LOG.md`

### Pinned Versions

- Production dependencies: pinned to exact versions (`"fastify": "4.28.1"`)
- Dev dependencies: semver range acceptable (`"@types/node": "^20.0.0"`)
- Python: pinned in `requirements.txt`; ranges in `pyproject.toml` `[project.dependencies]`

### Dependency Update Policy

- Security patches: apply within 24 hours of CVE disclosure
- Minor updates: apply weekly in batch
- Major updates: require planning, testing, and documented migration

---

## 5. Testing Standards

Full details in `docs/TESTING_STRATEGY.md`. Summary:

- **Unit tests** required for all business logic, utilities, and data transformation
- **Integration tests** required for all database queries and external service calls
- **Coverage gate:** 80% line coverage, 70% branch coverage
- **Mutation testing:** Run monthly to validate test quality
- All tests are deterministic and repeatable without network access (unit tests)
- Tests run in < 10 minutes for the full unit suite; < 30 minutes for integration

---

## 6. Documentation Standards

### Code Comments

- Comments explain **why**, not what
- Complex algorithms require an explanation of the approach
- Remove all `TODO` comments that don't have a linked issue
- Never commit commented-out code; use `git stash` or branches

### JSDoc / Docstrings

Required for:
- All exported functions and classes
- All public module APIs (`index.ts` exports)
- All non-obvious function parameters

```typescript
/**
 * Selects the optimal LLM provider for a request based on model tier,
 * current availability, and cost constraints.
 *
 * @param request - The inference request with model preference
 * @param constraints - Cost and latency constraints for this request
 * @returns The selected provider, or an error if none are available
 */
async function selectProvider(
  request: InferenceRequest,
  constraints: ProviderConstraints,
): Promise<Result<Provider, 'NO_PROVIDERS_AVAILABLE'>>
```

---

## 7. Performance Standards

See `docs/PERFORMANCE_GUIDELINES.md` for budgets. Core rules:

- No synchronous blocking operations in async contexts
- All external I/O must have explicit timeouts
- Database queries must use indexes — explain plan for queries accessing > 10k rows
- No N+1 query patterns; use batch loading or JOINs

---

## 8. Versioning and Release Standards

- Semantic versioning for all packages and services
- `main` branch is always deployable
- Feature flags for incomplete features merged to `main`
- CHANGELOG.md updated for every release with breaking changes, new features, and fixes
- Git tags for all releases: `v{major}.{minor}.{patch}`

---

## Related Files

- Code style details → `docs/CODE_STYLE.md`
- Testing details → `docs/TESTING_STRATEGY.md`
- Performance budgets → `docs/PERFORMANCE_GUIDELINES.md`
- Error handling patterns → `docs/ERROR_HANDLING.md`
