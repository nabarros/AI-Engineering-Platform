---
tags: [refactoring, typescript, python, code-quality, safety]
applies_to: [src/**]
priority: medium
token_budget: medium
owner: platform-team
last_reviewed: 2026-05-07
---

# Skill: Refactoring Rules

## Purpose

Safe, behavior-preserving refactoring patterns. Load when improving existing code without changing behavior.

## Applicability

Load when: extracting functions/classes, renaming symbols, splitting files, reorganizing modules, or reducing code duplication. Pair with `docs/ENGINEERING_STANDARDS.md` for quality limits.

---

## Core Principle

**Behavior must be preserved.** A refactor has zero user-visible effect. Any behavior change — even fixing a bug incidentally — should be a separate commit with its own tests.

---

## 1. Pre-Refactor Checklist

Before touching any code:

```
□ Tests exist and pass for the code being changed (run: pnpm test --run src/path/to/file)
□ You understand what every changed line does
□ CI is green on main (you're not inheriting someone else's breakage)
□ The file is not in progress by another team member (check git log -5 src/path/to/file)
□ Refactor scope is limited to one module at a time
```

---

## 2. Extract Function

When to extract: a named code block makes the calling code's intent clearer.

```typescript
// BEFORE — intent buried in implementation detail
async function handleInferenceRequest(request: InferenceRequest) {
  const token = request.headers.authorization?.replace('Bearer ', '');
  if (!token) throw new AuthError('No token');
  const user = await authService.verify(token);

  const cachedResult = await redis.get(`inference:${request.id}`);
  if (cachedResult) return JSON.parse(cachedResult);

  const result = await llmProvider.complete(request.prompt);
  await redis.set(`inference:${request.id}`, JSON.stringify(result), 'EX', 300);

  return result;
}

// AFTER — intent clear at glance
async function handleInferenceRequest(request: InferenceRequest) {
  const user = await extractAndVerifyUser(request.headers);
  const cached = await getCachedInferenceResult(request.id);
  if (cached) return cached;

  const result = await llmProvider.complete(request.prompt);
  await cacheInferenceResult(request.id, result);
  return result;
}
```

Rules:
- The extracted function must have a single responsibility
- Extraction must not change branching behavior
- Test the extracted function directly if it has meaningful logic

---

## 3. Safe Rename

Use language-server rename (F2 in VS Code), not find-and-replace:

```bash
# Verify all references updated correctly after rename
git diff --stat
pnpm test --run          # all tests must pass
pnpm build               # no TypeScript errors
```

For public API or exported types:
- Rename only if the symbol is consumed within this repo
- For shared packages (`@aiep/*`): coordinate with consumers, use deprecation wrapper first

```typescript
// Deprecation wrapper (keep the old name pointing to the new one)
/** @deprecated Use `InferenceRequest` instead */
export type LLMRequest = InferenceRequest;
```

---

## 4. File Splitting

When a file exceeds ~300 lines or contains multiple distinct responsibilities:

```
BEFORE:
  src/services/prompt-service/prompt.service.ts  (800 lines)
    - prompt CRUD
    - version management
    - evaluation scoring

AFTER:
  src/services/prompt-service/
    prompt.service.ts         (CRUD — ~150 lines)
    version.service.ts        (version management — ~200 lines)
    evaluation.service.ts     (evaluation scoring — ~200 lines)
```

Steps:
1. Run tests before the split — all green
2. Create the new file with the extracted class/functions
3. Update the original file to import and re-export (for backward compat, temporarily)
4. Run tests — all green
5. Update all import sites to the new file
6. Remove re-export from original file
7. Run tests — all green
8. Commit

---

## 5. Eliminating Duplication (DRY)

Only extract when the same logic appears in 3+ places AND is stable:

```typescript
// Three services all parsing date ranges the same way:
// BEFORE (duplicated in 3 files)
const startDate = new Date(params.start ?? Date.now() - 7 * 86400 * 1000);
const endDate = new Date(params.end ?? Date.now());

// AFTER — single utility
// src/shared/date-utils.ts
export function parseDateRange(params: { start?: string; end?: string }): DateRange {
  return {
    start: params.start ? new Date(params.start) : subDays(new Date(), 7),
    end: params.end ? new Date(params.end) : new Date(),
  };
}
```

**Do not extract** if:
- The logic appears only twice
- The duplication will likely diverge (similar now but different concerns)
- The extraction creates an import cycle

---

## 6. Type Narrowing Cleanup

Replace defensive casts with proper type narrowing:

```typescript
// BEFORE — unsafe cast hides type errors
const userId = (request.user as any).id;

// AFTER — type-safe
if (!request.user?.id) {
  throw new AuthError('User not authenticated');
}
const userId = request.user.id; // TypeScript knows it's string here

// BEFORE — redundant non-null assertion
const result = maybeResult!.value;

// AFTER — explicit guard
if (!maybeResult) throw new Error('Expected result to be defined');
const result = maybeResult.value;
```

---

## 7. Python Refactoring Rules

```python
# BEFORE — mixed responsibilities
async def process_inference(request: InferenceRequest) -> InferenceResponse:
    # 1. validation
    if not request.prompt.strip():
        raise ValueError("Empty prompt")
    if len(request.prompt) > 50_000:
        raise ValueError("Prompt too long")
    # 2. rate limit check
    key = f"rate:{request.user_id}"
    if await redis.get(key):
        raise RateLimitError()
    # 3. actual inference
    response = await provider.complete(request.prompt)
    # 4. logging
    logger.info("inference complete", tokens=response.token_count)
    return response

# AFTER — separate concerns
async def process_inference(request: InferenceRequest) -> InferenceResponse:
    validate_inference_request(request)
    await check_rate_limit(request.user_id)
    response = await provider.complete(request.prompt)
    log_inference_complete(response)
    return response
```

---

## 8. Commit Granularity

Refactors should be committed as atomic changes:

```
# Good commit sequence
git commit -m "refactor: extract parseDateRange to shared date-utils"
git commit -m "refactor: split prompt.service into prompt + version + evaluation services"
git commit -m "refactor: rename LLMRequest to InferenceRequest"

# Bad — mixing refactor with behavior change
git commit -m "refactor: reorganize prompt service and fix validation bug"
```

---

## Anti-Patterns

| Anti-Pattern | Consequence |
|---|---|
| Refactoring without tests | Cannot verify behavior was preserved |
| Extracting from one-off code | Creates needless abstraction |
| Using find-and-replace for renames | Misses type aliases, string literals, docs |
| Combining refactor with bug fix | Impossible to bisect later |
| Splitting into files before understanding module | Creates wrong boundaries |
| Removing "dead code" without verifying | Dynamic imports or reflection may use it |
