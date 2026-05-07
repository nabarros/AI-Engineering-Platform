---
tags: [performance, optimization, profiling, caching, node, python, react]
applies_to: [src/**]
priority: medium
token_budget: medium
owner: platform-team
last_reviewed: 2026-05-07
---

# Skill: Performance Optimization

## Purpose

Patterns for diagnosing and resolving performance issues. Load when investigating slow endpoints, high latency, excessive memory use, or CPU spikes.

## Applicability

Load when: investigating slow API responses, optimizing LLM request handling, improving frontend loading times, tuning database queries. Pair with `docs/PERFORMANCE_GUIDELINES.md` for performance budgets.

---

## 1. Optimization Workflow

**Always profile before optimizing.** Do not change code based on intuition.

```
1. Measure — establish baseline metrics (p50, p95, p99 latency)
2. Profile — find where time is actually spent (traces, flame graphs)
3. Hypothesize — identify the likely bottleneck
4. Change one thing — atomic change per optimization pass
5. Measure again — compare against baseline
6. Commit if improved — document the gain in the PR
```

---

## 2. Node.js — Avoiding Event Loop Blocking

```typescript
// PROBLEM: CPU-intensive work blocks the event loop
function parseHugeJSONPayload(raw: string): ParsedPayload {
  return JSON.parse(raw); // blocks if > ~10MB
}

// SOLUTION 1: Run in worker thread for large payloads
import { runInWorker } from '@aiep/workers';

async function parseHugeJSONPayload(raw: string): Promise<ParsedPayload> {
  if (raw.length < 500_000) {
    return JSON.parse(raw); // small — safe on main thread
  }
  return runInWorker('json-parse', { payload: raw });
}

// SOLUTION 2: Streaming parse for very large payloads
import { parser as createJSONParser } from 'stream-json';
import { pipeline } from 'stream/promises';

async function parseStreamingJSON(readableStream: Readable): Promise<ParsedPayload> {
  // Parses without buffering the entire payload
}
```

---

## 3. Async Concurrency

```typescript
// PROBLEM: Sequential async operations when they could be parallel
const user = await userService.getById(userId);          // 50ms
const prompts = await promptService.listByUser(userId);  // 80ms
const quota = await quotaService.getByUser(userId);      // 40ms
// Total: ~170ms

// SOLUTION: Parallel with Promise.all
const [user, prompts, quota] = await Promise.all([
  userService.getById(userId),
  promptService.listByUser(userId),
  quotaService.getByUser(userId),
]);
// Total: ~80ms (limited by slowest)

// CAUTION: Use Promise.allSettled when individual failures are acceptable
const results = await Promise.allSettled([
  enrichmentService.getOrganizationData(orgId), // optional enrichment
  enrichmentService.getModelStats(modelId),     // optional enrichment
]);
// Core flow is not blocked if enrichment fails
```

---

## 4. Database Query Optimization

### Identify Slow Queries

```sql
-- Find slowest queries (requires pg_stat_statements extension)
SELECT
  round(mean_exec_time) as mean_ms,
  calls,
  round(total_exec_time) as total_ms,
  left(query, 120) as query
FROM pg_stat_statements
WHERE mean_exec_time > 100 -- slower than 100ms
ORDER BY mean_exec_time DESC
LIMIT 20;
```

### Analyze Query Plans

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT p.id, p.name, COUNT(v.id) as version_count
FROM prompts p
LEFT JOIN prompt_versions v ON v.prompt_id = p.id AND v.deleted_at IS NULL
WHERE p.organization_id = 'org-abc123' AND p.deleted_at IS NULL
GROUP BY p.id, p.name
ORDER BY p.created_at DESC
LIMIT 20;

-- Look for: "Seq Scan" on large tables (usually needs an index)
-- Look for: "Nested Loop" with many rows (may need JOIN order change or index)
-- Look for: high "Buffers: hit" vs "Buffers: read" ratio (cache miss)
```

### Add Targeted Indexes

```sql
-- Partial index for common filter patterns
CREATE INDEX CONCURRENTLY idx_prompts_org_active
ON prompts (organization_id, created_at DESC)
WHERE deleted_at IS NULL;

-- Covering index to avoid heap fetch (include all needed columns)
CREATE INDEX CONCURRENTLY idx_prompt_versions_lookup
ON prompt_versions (prompt_id, status)
INCLUDE (id, version_number, created_at)
WHERE deleted_at IS NULL;
```

---

## 5. Caching Strategy

```typescript
// Cache-aside pattern with TTL and stampede protection
export class CachedPromptService {
  constructor(
    private readonly promptRepo: PromptRepository,
    private readonly cache: RedisClient,
  ) {}

  async getById(id: string): Promise<Result<Prompt, 'NOT_FOUND' | 'CACHE_ERROR'>> {
    const cacheKey = `prompt:v1:${id}`;

    // 1. Try cache first
    try {
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return { ok: true, value: JSON.parse(cached) as Prompt };
      }
    } catch {
      // Cache failure is non-fatal — fall through to DB
    }

    // 2. Load from DB
    const result = await this.promptRepo.findById(id);
    if (!result.ok) return result;

    // 3. Cache the result
    try {
      await this.cache.setex(
        cacheKey,
        300, // 5 min TTL
        JSON.stringify(result.value),
      );
    } catch {
      // Cache write failure is non-fatal — log and continue
    }

    return result;
  }

  async invalidate(id: string): Promise<void> {
    await this.cache.del(`prompt:v1:${id}`).catch(() => {});
  }
}
```

What to cache:
- Prompt content fetched for inference (high-frequency read, low-frequency write)
- User session data
- Provider health status (30s TTL)

What not to cache:
- Mutation responses
- Auth token verification (security boundary)
- Metrics data

---

## 6. LLM Request Optimization

```typescript
// Token budget management
function buildOptimizedPrompt(
  systemPrompt: string,
  userMessage: string,
  context: ContextDocument[],
  maxInputTokens: number,
): string {
  const systemTokens = estimateTokens(systemPrompt);
  const userTokens = estimateTokens(userMessage);
  const overheadTokens = 200; // formatting, roles

  const availableForContext = maxInputTokens - systemTokens - userTokens - overheadTokens;

  // Include context documents until budget is exhausted
  const includedContext: string[] = [];
  let usedTokens = 0;

  for (const doc of context) {
    const docTokens = estimateTokens(doc.content);
    if (usedTokens + docTokens > availableForContext) {
      break; // budget exhausted
    }
    includedContext.push(doc.content);
    usedTokens += docTokens;
  }

  return formatPromptWithContext(systemPrompt, userMessage, includedContext);
}

// Semantic cache for LLM responses
async function cachedInference(
  request: InferenceRequest,
): Promise<Result<InferenceResponse, string>> {
  // Hash the prompt content for cache key (not userId — same prompt = same result)
  const cacheKey = `llm-cache:${createSHA256(request.prompt + request.model)}`;

  const cached = await cache.get(cacheKey);
  if (cached) {
    metrics.increment('llm.cache.hit');
    return { ok: true, value: JSON.parse(cached) };
  }

  const result = await llmProvider.complete(request);
  if (result.ok) {
    await cache.setex(cacheKey, 3600, JSON.stringify(result.value)); // 1h TTL
    metrics.increment('llm.cache.miss');
  }

  return result;
}
```

---

## 7. React Performance

```typescript
// Expensive computation: memoize
const sortedPrompts = useMemo(
  () => [...prompts].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
  [prompts], // only recompute when prompts array changes
);

// Stable callback references: useCallback
const handlePromptSelect = useCallback(
  (promptId: string) => {
    setSelectedPrompt(promptId);
    onPromptChange(promptId);
  },
  [onPromptChange], // only recreate if onPromptChange changes
);

// Large lists: virtualize (react-virtual)
const { virtualItems, totalSize } = useVirtualizer({
  count: prompts.length,
  getScrollElement: () => containerRef.current,
  estimateSize: () => 64,
  overscan: 5,
});

// Code splitting: lazy load heavy pages
const EvalDashboard = lazy(() => import('./pages/EvalDashboard'));
const ModelRegistry = lazy(() => import('./pages/ModelRegistry'));
```

---

## Anti-Patterns

| Anti-Pattern | Consequence |
|---|---|
| Optimizing without profiling | Wasted effort; may make things worse |
| Caching mutable data without TTL | Stale data served indefinitely |
| `Promise.all` for dependent operations | Incorrect execution order |
| `SELECT *` on frequently-read tables | Unnecessary data transfer; more cache misses |
| Re-rendering full list on filter change | Poor UX on large datasets |
| Fetching all records to count | Use `SELECT COUNT(*)` instead |
| Sharing one Redis instance for all cache types | Key collisions; TTL conflicts |
