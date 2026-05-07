---
ai_priority: high
context_type: governance
load_when: performance optimization, reviewing database queries, caching design, load testing
token_budget: low
---

# Performance Guidelines

## AI Agent Load Guidance

Load this file when optimizing code, designing caching strategies, or reviewing queries for performance. Load `.ai/skills/performance-optimization.md` for implementation patterns.

---

## Performance Budgets

### API Response Time (P95)

| Endpoint Category | Target | Warning | Critical |
|-------------------|--------|---------|---------|
| Read endpoints (GET) | < 100ms | > 200ms | > 500ms |
| Write endpoints (POST/PUT/PATCH) | < 200ms | > 500ms | > 1s |
| Complex queries | < 500ms | > 1s | > 2s |
| LLM inference (first token) | < 500ms | > 1s | > 2s |
| Vector search | < 200ms | > 500ms | > 1s |
| File upload | < 2s | > 5s | > 10s |

### Resource Limits (Per Service Instance)

| Resource | Target | Limit |
|----------|--------|-------|
| CPU | < 50% average | < 80% sustained |
| Memory | < 512MB | < 1GB |
| Open file descriptors | < 1000 | < 4096 |
| DB connection pool | < 10 active | < 20 |

---

## 1. TypeScript / Node.js Performance

### Event Loop

- **No blocking operations** on the main thread: no synchronous file I/O, no CPU-heavy loops
- CPU-intensive work (embedding generation, large data transformation) goes to a worker thread or separate process
- Use `setImmediate` for splitting long synchronous chains; use `process.nextTick` sparingly

```typescript
// BAD — blocks event loop
const data = fs.readFileSync('large-file.json'); // synchronous I/O

// GOOD — non-blocking
const data = await fs.promises.readFile('large-file.json');
```

### Async Concurrency

```typescript
// BAD — sequential when operations are independent
const user = await userRepo.findById(userId);
const plan = await planRepo.findById(user.planId);
const usage = await usageRepo.findByUser(userId);

// GOOD — concurrent
const [user, usage] = await Promise.all([
  userRepo.findById(userId),
  usageRepo.findByUser(userId),
]);
const plan = await planRepo.findById(user.value.planId);
```

Use `Promise.all` for concurrent independent operations. Use sequential only when output of one is input of another.

### Memory Management

- Avoid creating large arrays in memory — use streams for processing large datasets
- Use `Buffer.allocUnsafe` only when you immediately fill the buffer
- Pool expensive objects (database connections, HTTP clients) — never create per-request
- Clear caches with TTL — never grow unbounded

---

## 2. Database Performance

### Query Optimization

Every query touching > 50k rows must have:
1. An index that supports the WHERE / ORDER BY clause
2. An EXPLAIN ANALYZE plan reviewed before merge
3. A query execution time assertion in integration tests

```sql
-- Check query plan before deploying
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT p.id, p.name, pv.content
FROM prompts p
JOIN prompt_versions pv ON pv.prompt_id = p.id AND pv.status = 'active'
WHERE p.model_id = $1 AND p.deleted_at IS NULL
ORDER BY p.created_at DESC
LIMIT 20;
```

### N+1 Prevention

Detect and eliminate N+1 patterns in code review:

```typescript
// BAD — N+1 (1 query for list + N queries for each item's details)
const prompts = await db.query('SELECT * FROM prompts LIMIT 20');
for (const prompt of prompts) {
  prompt.versions = await db.query('SELECT * FROM prompt_versions WHERE prompt_id = $1', [prompt.id]);
}

// GOOD — single JOIN query
const prompts = await db.query(`
  SELECT p.*, json_agg(pv) AS versions
  FROM prompts p
  LEFT JOIN prompt_versions pv ON pv.prompt_id = p.id
  WHERE p.id = ANY($1)
  GROUP BY p.id
`, [promptIds]);
```

### Connection Pooling

- Use PgBouncer in transaction mode for all production database connections
- Never exceed the configured pool size (`max: 20` per service)
- Set `statement_timeout = 30s` on all queries to prevent runaway queries
- Set `lock_timeout = 5s` to prevent lock contention from blocking the pool

---

## 3. Caching Strategy

### Cache Layers

| Layer | Technology | TTL | Use For |
|-------|-----------|-----|---------|
| In-process | Node.js Map + TTL | 30s–5min | Hot config, feature flags |
| Distributed | Redis | 1min–24hr | Session data, API results, rate limits |
| CDN | CloudFront | Per resource | Static assets, public API responses |

### Cache Key Design

```typescript
// Pattern: {service}:{resource}:{id}:{variant}
const cacheKey = `prompt-service:prompt:${promptId}:active-version`;

// Include version for cache invalidation
const cacheKey = `model-registry:model:${modelId}:v${schemaVersion}`;
```

### Cache Invalidation

- Event-driven invalidation preferred over TTL for consistency
- Publish `{resource}.updated` Kafka events; subscribers invalidate their caches
- TTL as fallback only — don't rely on TTL for consistency
- Never cache security-sensitive data (auth decisions, rate limit counters) in application layer; use Redis only with short TTL

### What NOT to Cache

- PII or user-specific data in shared caches
- Mutable user session state without user-scoped cache keys
- Large binary blobs (> 1MB) — use object storage with signed URLs instead

---

## 4. Frontend Performance

### Bundle Budget

| Asset | Warning | Critical |
|-------|---------|---------|
| Initial JS bundle | > 150KB gzipped | > 250KB gzipped |
| Initial CSS bundle | > 50KB gzipped | > 100KB gzipped |
| Route chunk | > 50KB gzipped | > 100KB gzipped |
| Total page weight (mobile) | > 500KB | > 1MB |

### Rendering Performance

- Core Web Vitals targets: LCP < 2.5s, INP < 200ms, CLS < 0.1
- All images have explicit `width` and `height` attributes
- LCP image uses `loading="eager"` and is preloaded
- Route-level code splitting for all non-critical paths
- Memoize expensive computations with `useMemo`; memoize stable callbacks with `useCallback`

---

## 5. LLM Request Optimization

### Token Budget Management

- Count tokens before sending (use `tiktoken` or equivalent)
- Set explicit `max_tokens` on every inference request
- Context compression for long conversations: summarize history beyond the last N turns
- Stream responses rather than waiting for completion when latency matters

### Caching LLM Responses

Idempotent prompts (same input → deterministic output) may be cached:
- Cache key: SHA-256 hash of `{model}:{prompt_hash}:{parameters}`
- TTL: 24 hours for semantic cache, 1 hour for exact match cache
- Do NOT cache prompts with `temperature > 0` or user-personalized content

### Batching

When processing multiple items, batch where the model supports it:
```typescript
// Prefer batch embedding over sequential calls
const embeddings = await llmGateway.embedBatch(documents, { batchSize: 100 });
```

---

## Performance Testing Requirements

- Load tests must be run before every major release
- Baseline performance benchmarks stored in `tests/benchmarks/`
- Performance regression > 20% in P95 latency is a blocker for merge
- Use `k6` for API load testing; `Lighthouse CI` for frontend

---

## Related Files

- Performance optimization skill → `.ai/skills/performance-optimization.md`
- Database conventions → `docs/DATABASE_CONVENTIONS.md`
- Observability → `docs/OBSERVABILITY.md`
