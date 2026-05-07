---
ai_priority: tier-3
context_type: technical-debt
load_when: refactoring, sprint-planning, scope-assessment
token_budget: low
owner: platform-team
last_reviewed: 2026-05-07
---

# Technical Debt

Deferred work, known shortcuts, and areas that need improvement. Not bugs — these are deliberate trade-offs or areas where the implementation does not meet full quality standards yet.

**Priority:** 🔴 High · 🟡 Medium · 🟢 Low

---

## Active Debt

### 🔴 LLM Gateway: Provider abstraction leaks implementation details
- **Location:** `src/services/llm-gateway/providers/openai.provider.ts`
- **Issue:** OpenAI-specific response fields (e.g., `finish_reason`, `usage.completion_tokens`) are mapped directly to internal types without normalization. Adding a new provider requires modifying the core response type.
- **Target:** Extract a proper provider normalization layer; define `NormalizedInferenceResponse` in the provider contract
- **Effort:** Medium (~1 sprint)
- **Why deferred:** Semantic cache feature took priority; flagged for Sprint 29

### 🔴 Prompt Service: No request-level idempotency on create
- **Location:** `src/services/prompt-service/routes/prompts.routes.ts`
- **Issue:** POST `/v1/prompts` is not idempotent — duplicate network retries create duplicate prompts
- **Target:** Add `Idempotency-Key` header support per `docs/API_CONVENTIONS.md`
- **Effort:** Low (~3 days including tests)
- **Why deferred:** Workaround exists (client deduplication by name); low-priority for internal API

### 🟡 Agent Runtime: Workflow DAG not validated at submission time
- **Location:** `src/services/agent-runtime/workflow/dag-validator.ts`
- **Issue:** Circular dependency detection only runs at execution start, not at workflow creation. Invalid workflows silently fail at runtime.
- **Target:** Add DAG validation at `POST /v1/workflows` time; return 400 with cycle details
- **Effort:** Low (~2 days)
- **Why deferred:** Only affects workflows with explicit DAG loops (rare in practice)

### 🟡 Vector Store: Embeddings generated synchronously on document ingest
- **Location:** `src/services/vector-store-service/ingest/document-ingester.ts`
- **Issue:** Embedding generation blocks the ingest HTTP response. Large documents (> 10K tokens) cause p99 latency spikes on the ingest endpoint.
- **Target:** Async ingest — return job ID immediately, process embeddings via Kafka consumer
- **Effort:** Large (~2 sprints; requires Kafka topic + consumer + status polling endpoint)
- **Why deferred:** Ingest volume is currently low; will be addressed when ingest rate increases

### 🟡 Model Registry: No pagination on model list endpoint
- **Location:** `src/services/model-registry/routes/models.routes.ts`
- **Issue:** `GET /v1/models` returns all models without pagination. Currently ~50 models (manageable), but will degrade with more fine-tuned model variants.
- **Target:** Add standard pagination (`page`, `pageSize`, `meta`) per API conventions
- **Effort:** Low (~1 day)
- **Why deferred:** Small catalog size makes this non-urgent

### 🟢 Test Coverage: Integration tests missing for agent-runtime tool execution
- **Location:** `src/services/agent-runtime/tools/`
- **Issue:** Tool executor has unit tests only. No integration tests with real tool endpoints (mock HTTP only).
- **Target:** Add integration test suite using Testcontainers + mock tool server
- **Effort:** Medium (~3 days)
- **Why deferred:** Tool use feature still in gradual rollout; integration tests planned before 100% rollout

### 🟢 TypeScript: Several `// @ts-ignore` in legacy streaming code
- **Location:** `src/services/llm-gateway/streaming/legacy/` (4 files)
- **Issue:** Legacy streaming code (superseded by v2 implementation) still has `@ts-ignore` without explanatory comments.
- **Target:** Delete legacy directory (streaming v2 is 100% rolled out) or add explanatory comments
- **Effort:** Low — prefer deletion after v2 is confirmed stable for 30 days (2026-05-28)

---

## Resolved Debt (Last Quarter)

| Item | Resolved | Sprint | Notes |
|---|---|---|---|
| N+1 queries in prompt list endpoint | 2026-04-15 | Sprint 25 | Replaced with JOIN-based batch query |
| Missing circuit breaker on LLM provider | 2026-03-20 | Sprint 23 | Added Hystrix-style breaker |
| PgBouncer not enforcing statement timeout | 2026-03-05 | Sprint 22 | Added `statement_timeout=5s` to pool config |

---

## Debt Introduction Policy

When introducing new debt, add an entry here with:
- Clear description of the shortcut taken
- Why it was deferred (deadline, complexity, low priority)
- Effort estimate
- Location in codebase

Do not leave undocumented shortcuts. A `// TODO` in code must always have a corresponding entry here.

---

## Related Files

- `.ai/memory/known-issues.md` — active bugs
- `.ai/memory/current-priorities.md` — sprint goals
- `docs/DECISION_LOG.md` — formal architecture decisions
