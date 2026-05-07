---
ai_priority: high
context_type: architecture
load_when: architecture questions, service design, adding new services, API design
token_budget: medium
---

# Architecture

## AI Agent Load Guidance

Load this file when you need to understand service boundaries, communication patterns, or are making decisions that affect system design. Always pair with `.ai/architecture/component-map.md` for the current service inventory and `.ai/memory/current-architecture.md` for the current state (which may diverge from the target architecture here).

---

## Architecture Principles

### 1. Bounded Service Ownership
Each service owns its data exclusively. No service reads directly from another service's database. All cross-service data access is via API calls or Kafka events.

### 2. Spec-First API Design
All API contracts are defined in OpenAPI (REST) or AsyncAPI (events) before implementation begins. The spec is the source of truth.

### 3. Defense in Depth
Every layer of the stack applies security controls independently. API gateway enforces auth; services validate again; database uses row-level security where applicable.

### 4. Observability as a First-Class Requirement
Every service emits structured logs, metrics, and distributed traces from day one. Observability is not added retrospectively.

### 5. Explicit Over Implicit
Prefer explicit configuration, explicit dependencies, and explicit error handling over magic, defaults, and silent failures.

### 6. Fail Fast, Fail Loud
Systems should detect and surface errors at the earliest possible point. Silent degradation is harder to debug and more dangerous than loud failures.

---

## Service Architecture

### API Gateway (`api-gateway`)
- Entry point for all client traffic
- Responsibilities: JWT verification, rate limiting (per user and per API key), request routing, response compression, CORS
- Does NOT implement business logic
- Forwards `x-user-id`, `x-request-id`, `x-trace-id` headers downstream
- Technology: TypeScript, Fastify, fastify-rate-limit

### LLM Gateway (`llm-gateway`)
- Unified abstraction over multiple LLM providers
- Responsibilities: provider selection, retry with exponential backoff, cost tracking, token counting, response caching (for idempotent prompts), streaming relay
- Provider priority order defined per model tier in configuration
- Emits `llm.request.completed` Kafka events for observability
- Technology: TypeScript, Fastify

### Prompt Service (`prompt-service`)
- Source of truth for all prompt templates
- Responsibilities: prompt versioning (semver), A/B test configuration, environment-specific deployments (staging/production), approval workflows for promotion
- Prompts are stored as structured YAML with metadata, not raw strings
- Technology: TypeScript, Fastify, PostgreSQL

### Agent Runtime (`agent-runtime`)
- Executes multi-step AI agent workflows
- Responsibilities: workflow graph execution, tool calling, memory context management, execution tracing, timeout enforcement
- Workflows defined as JSON DAGs
- Maximum execution time: 5 minutes (configurable per workflow)
- Technology: Python, FastAPI, LangGraph (internal fork)

### Vector Store (`vector-store`)
- Managed embeddings and semantic search service
- Responsibilities: document ingestion, chunking strategy, embedding generation, namespace management, hybrid search (BM25 + vector)
- Backed by Weaviate
- Technology: Python, FastAPI, Weaviate client

### Model Registry (`model-registry`)
- Catalog of all AI models and their variants
- Responsibilities: model metadata, evaluation results, version lineage, capability declarations, deprecation management
- Technology: TypeScript, Fastify, PostgreSQL

### Auth Service (`auth-service`)
- Single source of truth for authentication and authorization
- Responsibilities: user authentication (OAuth2, API keys), JWT issuance, RBAC policy enforcement, session management
- ALL other services defer to this service for auth decisions — they do not implement their own
- Technology: TypeScript, Fastify, PostgreSQL, Redis

### AI Observability (`ai-observability`)
- Real-time analytics for AI usage
- Responsibilities: latency percentiles, cost aggregation, accuracy tracking, drift detection, SLO alerting, usage dashboards
- Consumes from Kafka; writes to Prometheus + time-series store
- Technology: Python, FastAPI, Prometheus, ClickHouse

### Audit Service (`audit-service`)
- Immutable compliance log for all AI actions
- Responsibilities: recording who ran what prompt/model/agent, when, with what inputs and outputs, for compliance and debugging
- Append-only; records are never deleted
- Technology: TypeScript, Fastify, PostgreSQL (append-only tables)

---

## Communication Patterns

### Synchronous (REST)
Used for: user-facing APIs, real-time data queries, request/response flows

```
Client → API Gateway → [Service A]
                    ↘
                      [Service A] → [Service B] (via typed HTTP client)
```

Rules:
- Use typed clients generated from OpenAPI specs
- All calls must have timeouts (default: 5s; configurable per route)
- Retry only on idempotent operations (GET, PUT, DELETE) with exponential backoff + jitter
- Circuit breakers on all downstream calls

### Asynchronous (Kafka)
Used for: events, audit logs, observability data, background jobs, cross-service side effects

```
[Service A] → kafka topic → [Service B, Service C]
```

Rules:
- Topics named: `{domain}.{entity}.{event}` (e.g., `ai.llm.request.completed`)
- Messages must include: `event_id`, `timestamp`, `source_service`, `trace_id`, `schema_version`
- Consumer groups named: `{service}-{topic}-consumer`
- Dead letter queues required for all critical topics
- Schema validation via Confluent Schema Registry

### Streaming (WebSocket)
Used for: real-time LLM token streaming to frontend clients

- Managed exclusively by the API Gateway
- LLM Gateway streams to API Gateway via SSE; API Gateway relays to client via WebSocket
- Maximum session duration: 30 minutes

---

## Data Architecture

### Database Ownership

Each service owns a dedicated PostgreSQL schema. No foreign keys across schemas.

```
postgres://aiep/{service_name}  ← dedicated schema per service
```

### Data Hierarchy

```
Service → Schema → Tables → Rows
                              ↕
             (no cross-schema JOINs in application code)
```

### Shared Read Patterns

When Service B needs data owned by Service A:
1. **Preferred:** Service B calls Service A's API
2. **Acceptable for analytics:** Service B reads from Service A's Kafka event stream and maintains its own read model
3. **Never:** Service B issues a direct SQL query to Service A's schema

---

## Security Architecture

- Network: Kubernetes NetworkPolicy restricts inter-pod communication to declared routes only
- Auth: All inter-service calls carry a service identity JWT (mTLS planned for next quarter)
- Secrets: Kubernetes Secrets + AWS Secrets Manager; rotated automatically every 90 days
- Data: PII is encrypted at rest (AES-256) and in transit (TLS 1.3)
- Audit: All data access is recorded by the audit-service

---

## Architecture Decision Records

Significant architectural decisions are recorded as ADRs. See `docs/DECISION_LOG.md` for the full list, and `.ai/templates/adr.md` for the template.

---

## Related Files

- Service registry → `.ai/architecture/component-map.md`
- Data flow diagrams → `.ai/architecture/data-flow.md`
- Current state → `.ai/memory/current-architecture.md`
- API conventions → `docs/API_CONVENTIONS.md`
- Security rules → `docs/SECURITY_RULES.md`
