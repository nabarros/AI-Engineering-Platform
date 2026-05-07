---
ai_priority: tier-3
context_type: data-flow
load_when: architectural-questions, cross-service-flow, debugging-request-path
token_budget: medium
owner: platform-team
last_reviewed: 2026-05-07
---

# Data Flow

Request flow diagrams for key AIEP operations.

---

## 1. LLM Inference Request (Happy Path)

```
Client
  │  POST /v1/infer
  │  Authorization: Bearer <user-jwt>
  ▼
Kong API Gateway
  │  Rate limit check (IP + API key)
  │  TLS termination
  ▼
LLM Gateway
  ├─ [1] Verify JWT → auth-service POST /internal/verify
  │          auth-service validates signature + expiry
  │          Returns: { userId, orgId, roles }
  │
  ├─ [2] Check rate limit (Redis INCR with TTL)
  │
  ├─ [3] Prompt injection scan (local heuristic + ML classifier)
  │
  ├─ [4] Semantic cache lookup (Redis vector similarity)
  │          HIT → return cached response (skip steps 5-7)
  │          MISS → continue
  │
  ├─ [5] Resolve prompt template → prompt-service GET /internal/prompts/:id
  │          Returns: compiled prompt with variables substituted
  │
  ├─ [6] Route to provider
  │       Primary: OpenAI POST /v1/chat/completions
  │       Fallback: Anthropic POST /v1/messages (if OpenAI circuit open)
  │
  ├─ [7] Normalize response → NormalizedInferenceResponse
  │
  ├─ [8] Write to semantic cache (async, non-blocking)
  │
  ├─ [9] Emit to Kafka: aiep.inference.events
  │          Consumed by: audit-service, observability-service
  │
  └─ [10] Return NormalizedInferenceResponse to client
```

**Typical latency breakdown:**
| Step | p50 | p95 |
|---|---|---|
| Auth verify | 3ms | 8ms |
| Rate limit check | 1ms | 3ms |
| Semantic cache lookup | 5ms | 15ms |
| Prompt resolution | 4ms | 10ms |
| LLM provider (GPT-4o-mini) | 200ms | 600ms |
| Response normalize + emit | 2ms | 5ms |
| **Total** | **~215ms** | **~640ms** |

---

## 2. Agent Workflow Execution

```
Client
  │  POST /v1/workflows/:id/execute
  ▼
Kong → Agent Runtime
  │
  ├─ [1] Auth verify
  ├─ [2] Load workflow definition from PostgreSQL
  ├─ [3] Validate DAG (topological sort, detect cycles)
  ├─ [4] Initialize WorkflowContext in Redis
  │
  └─ [5] Execute DAG (iterative)
         │
         ├── Step type: LLM
         │     └── Call llm-gateway POST /v1/infer
         │
         ├── Step type: Tool
         │     └── Call tool executor → external tool HTTP endpoint
         │
         ├── Step type: Transform
         │     └── Apply local transformation function (pure, in-memory)
         │
         └── Step type: Condition
               └── Evaluate expression → branch to next step
         │
         After each step:
           - Write step output to WorkflowContext (Redis)
           - Emit step event to Kafka: aiep.agent.execution
         │
  └─ [6] Return final workflow output (or stream if SSE requested)
```

---

## 3. Document Ingestion (Vector Store)

```
Client
  │  POST /v1/documents
  │  body: { content, metadata }
  ▼
Vector Store Service
  │
  ├─ [1] Auth verify
  ├─ [2] Validate document size (max 100KB per chunk)
  ├─ [3] Store document metadata in PostgreSQL (returns documentId)
  │
  └─ [4] Chunking
         │  Strategy: 512 token windows, 50 token overlap
         │  Returns: chunks[]
         │
  └─ [5] Embedding generation
         │  Call inference-service POST /internal/embed
         │  Model: text-embedding-3-small
         │  Returns: float32[1536] per chunk
         │
  └─ [6] Weaviate upsert (batch)
         │  Object per chunk: { documentId, chunkIndex, embedding, content, metadata }
         │  Upsert is idempotent on (documentId, chunkIndex)
         │
  └─ [7] Return: { documentId, chunkCount, indexedAt }
```

---

## 4. Prompt Retrieval (RAG Flow)

```
Agent Runtime (or LLM Gateway)
  │  GET /v1/vector-search
  │  body: { query, topK, orgId }
  ▼
Vector Store Service
  │
  ├─ [1] Embed query → inference-service (text-embedding-3-small)
  │
  ├─ [2] HNSW search in Weaviate
  │       Filter: { orgId: <orgId>, deleted_at: null }
  │       k: topK * 4 (over-fetch for reranking)
  │
  ├─ [3] MMR Reranking
  │       Select top-K with diversity (λ = 0.5)
  │
  └─ [4] Return: { results: [{ content, score, metadata }] }
```

---

## 5. Audit Event Flow

```
Any Service (producer)
  │
  └─ Kafka producer: topic aiep.audit.events
       Message schema:
         { eventType, actorId, orgId, resourceType, resourceId,
           action, outcome, timestamp, ipAddress, traceId }

Audit Service (consumer)
  │
  └─ Consume from aiep.audit.events
       │
       ├─ Validate schema (Avro via Schema Registry)
       ├─ Write to PostgreSQL audit_log table
       └─ For high-severity events: emit alert to PagerDuty
```

Audit events are append-only. No service can modify or delete audit log entries.

---

## Related Files

- `.ai/architecture/component-map.md` — service registry
- `.ai/architecture/system-design.md` — per-service design details
- `docs/ARCHITECTURE.md` — architecture principles
- `docs/OBSERVABILITY.md` — tracing and metrics
