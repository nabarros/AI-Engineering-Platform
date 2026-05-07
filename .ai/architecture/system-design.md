---
ai_priority: tier-3
context_type: architecture-deep-dive
load_when: architectural-questions, service-design, cross-service-changes
token_budget: medium
owner: platform-team
last_reviewed: 2026-05-07
---

# System Design

Detailed component design for AIEP services. For the high-level overview, see `docs/ARCHITECTURE.md`. This file focuses on implementation-level design decisions.

---

## LLM Gateway — Internal Design

The LLM Gateway is the single ingress point for all LLM inference requests. No service calls LLM providers directly.

```
Client Request
      │
      ▼
 Rate Limiter ──► 429 if exceeded
      │
      ▼
 Auth Verify ──► 401/403 if invalid
      │
      ▼
 Prompt Injection
    Filter ──► 400 if injection detected
      │
      ▼
 Semantic Cache ──► HIT: return cached response
      │ MISS
      ▼
 Provider Router
  ┌───┴────┐
  │        │
  ▼        ▼
OpenAI  Anthropic
  │        │
  └───┬────┘
      │ First success wins (fallback chain)
      ▼
 Response Normalizer
      │
      ▼
 Cache Writer (async, non-blocking)
      │
      ▼
 Metrics Recorder
      │
      ▼
  Response to Client
```

**Key implementation decisions:**
- Provider calls are made with circuit breakers; tripped circuit causes immediate fallback
- Semantic cache lookup uses cosine similarity > threshold (not exact match)
- Cache writes are fire-and-forget — cache failure never fails a request
- Metrics are written to Redis and flushed to Prometheus by a background job

---

## Prompt Service — Data Model

```
Organization ──< Prompt >──< PromptVersion
                    │
                    ├── tags: string[]
                    ├── model_tier: enum
                    └── status: draft | active | archived

PromptVersion
  ├── version_number: sequential (per prompt)
  ├── content: string (template with {{variables}})
  ├── variables_schema: JSON Schema
  ├── status: draft | active | archived
  └── eval_scores: JSON (optional)
```

**Soft delete:** Both `prompts` and `prompt_versions` use `deleted_at` timestamp (never hard-delete).

**Version activation:** Only one version per prompt can be `active` at a time — enforced by partial unique index:
```sql
CREATE UNIQUE INDEX idx_one_active_version
ON prompt_versions (prompt_id)
WHERE status = 'active' AND deleted_at IS NULL;
```

---

## Agent Runtime — Workflow Execution

Workflows are modeled as Directed Acyclic Graphs (DAGs) where each node is a step:

```typescript
type WorkflowDefinition = {
  id: string;
  steps: Step[];
  edges: Edge[]; // { from: stepId, to: stepId }
};

type Step =
  | { type: 'llm'; promptId: string; modelTier: ModelTier }
  | { type: 'tool'; toolId: string; params: Record<string, unknown> }
  | { type: 'transform'; fn: string; inputMapping: Record<string, string> }
  | { type: 'condition'; expression: string; branches: { true: string; false: string } };
```

**Execution model:**
1. Topological sort determines execution order
2. Steps with no unresolved dependencies execute in parallel (via `Promise.all`)
3. Each step's output is stored in a `WorkflowContext` map (stepId → output)
4. Context is persisted to Redis after each step (fault tolerance)
5. On recovery, execution resumes from last completed step

---

## Auth Service — Token Lifecycle

```
Login ──► issue access token (RS256, 15min) + refresh token (opaque, 7d)
              │
         ┌────┴────────────────┐
         │                     │
    Resource access      Token refresh
    (verify JWT locally)  (exchange refresh for new access)
         │                     │
    [fast path —          [slower path —
     no auth-service        requires auth-service
     call needed]           validation]
```

**Why RS256:** Public key can be distributed to services for local verification. Services verify the JWT signature without calling auth-service on every request. This is the fast path for normal operation.

**Internal service-to-service tokens:** Services use short-lived tokens (1h) issued to service accounts. These bypass the user JWT verification path and are validated against a service registry in auth-service.

---

## Vector Store — Indexing Pipeline

```
Document Ingested
       │
       ▼
 Chunking Strategy
  (size: 512 tokens, overlap: 50)
       │
       ▼
 Embedding Generation
  (OpenAI text-embedding-3-small, 1536 dim)
       │
       ▼
 Metadata Enrichment
  (source, org_id, doc_type, created_at)
       │
       ▼
 Weaviate Upsert
  (idempotent on document_id + chunk_index)
```

**Query pipeline:**
1. Embed query with same model
2. Weaviate HNSW approximate nearest neighbor search (top 20)
3. MMR reranking (Maximal Marginal Relevance) for diversity (top 5)
4. Return with similarity scores and metadata

---

## Cross-Service Communication Patterns

### Synchronous (REST)
Used for: user-facing requests, auth verification, model registry lookups
- Timeout: 3s for auth, 5s for internal, 30s for LLM inference
- Retry: 3 attempts with exponential backoff for idempotent operations
- Circuit breaker: open after 5 consecutive failures in 10s window

### Asynchronous (Kafka)
Used for: audit events, observability data, async document ingestion, agent execution events
- Producer acks: `all` (leader + all ISR replicas)
- Consumer group per service per topic
- Dead letter queue for messages failing after 3 processing attempts
- Message schema enforced via Schema Registry (Avro)

---

## Related Files

- `docs/ARCHITECTURE.md` — architecture principles and overview
- `.ai/architecture/component-map.md` — service registry with ports
- `.ai/architecture/data-flow.md` — data flow diagrams
- `docs/DECISION_LOG.md` — formal ADRs
