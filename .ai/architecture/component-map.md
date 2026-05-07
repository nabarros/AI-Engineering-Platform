---
ai_priority: tier-2
context_type: service-registry
load_when: service-discovery, port-conflicts, cross-service-changes, dependency-mapping
token_budget: low
owner: platform-team
last_reviewed: 2026-05-07
---

# Component Map

Service registry, port assignments, and dependency graph for AIEP.

---

## Service Registry

| Service | Language | Port (dev) | Port (prod) | Namespace | Owner |
|---|---|---|---|---|---|
| llm-gateway | TypeScript / Node | 3001 | — (internal) | aiep | platform-team |
| prompt-service | TypeScript / Node | 3002 | — (internal) | aiep | platform-team |
| agent-runtime | TypeScript / Node | 3003 | — (internal) | aiep | agent-team |
| vector-store-service | Python / FastAPI | 3004 | — (internal) | aiep | vector-team |
| model-registry | TypeScript / Node | 3005 | — (internal) | aiep | platform-team |
| inference-service | Python / FastAPI | 3006 | — (internal) | aiep | ml-team |
| observability-service | TypeScript / Node | 3007 | — (internal) | aiep | platform-team |
| auth-service | TypeScript / Node | 3008 | — (internal) | aiep | security-team |
| audit-service | TypeScript / Node | 3009 | — (internal) | aiep | security-team |
| API Gateway (Kong) | — | 8000 | 443 (public) | aiep-edge | infra-team |
| Weaviate | — | 8080 | — (internal) | aiep-data | infra-team |
| PostgreSQL (via PgBouncer) | — | 6432 | — (internal) | aiep-data | infra-team |
| Redis | — | 6379 | — (internal) | aiep-data | infra-team |
| Kafka | — | 9092 | — (internal) | aiep-data | infra-team |

All inter-service communication in production uses Kubernetes service names within the `aiep` namespace, not port numbers.

---

## Service Dependency Graph

```
External Clients
       │
       ▼
  Kong API Gateway (edge, TLS termination, rate limiting)
       │
       ├──► llm-gateway
       │         ├── auth-service (token verify)
       │         ├── prompt-service (fetch prompt templates)
       │         ├── inference-service (Python ML inference)
       │         ├── model-registry (model metadata)
       │         ├── Redis (semantic cache, rate limit counters)
       │         └── audit-service (inference events → Kafka)
       │
       ├──► prompt-service
       │         ├── auth-service (token verify)
       │         ├── PostgreSQL (prompt storage)
       │         ├── observability-service (usage metrics)
       │         └── audit-service (CRUD events → Kafka)
       │
       ├──► agent-runtime
       │         ├── auth-service (token verify)
       │         ├── llm-gateway (step execution)
       │         ├── prompt-service (prompt resolution)
       │         ├── Redis (workflow state)
       │         └── audit-service (execution events → Kafka)
       │
       ├──► vector-store-service
       │         ├── auth-service (token verify)
       │         ├── Weaviate (vector index)
       │         ├── inference-service (embedding generation)
       │         └── PostgreSQL (document metadata)
       │
       └──► model-registry
                 ├── auth-service (token verify)
                 └── PostgreSQL (model metadata)
```

**Rules:**
- Services never access another service's database directly
- `auth-service` is the ONLY service that issues or verifies tokens
- `audit-service` consumes from Kafka (never called synchronously by business services)
- `observability-service` is a sink only — no business services depend on it

---

## Kafka Topic Ownership

| Topic | Producer | Consumers | Partition Count | Retention |
|---|---|---|---|---|
| `aiep.inference.events` | llm-gateway | audit-service, observability-service | 12 | 7 days |
| `aiep.agent.execution` | agent-runtime | audit-service, observability-service | 6 | 7 days |
| `aiep.prompt.changes` | prompt-service | llm-gateway (cache invalidation) | 3 | 3 days |
| `aiep.vector.ingest` | vector-store-service | vector-store-service (self) | 6 | 1 day |
| `aiep.audit.events` | All services | audit-service | 12 | 90 days |

---

## Shared Packages (`packages/`)

| Package | Consumers | Purpose |
|---|---|---|
| `@aiep/auth-client` | All services | Auth-service HTTP client + types |
| `@aiep/core` | All services | Result<T,E> type, shared utilities |
| `@aiep/database` | Node.js services | Kysely wrapper, migration runner |
| `@aiep/kafka-client` | All services | Typed Kafka producer/consumer |
| `@aiep/observability` | All services | OTel setup, structured logger config |
| `@aiep/zod-schemas` | All services | Shared Zod schemas (pagination, errors) |

---

## Related Files

- `docs/ARCHITECTURE.md` — architecture principles
- `.ai/architecture/system-design.md` — detailed component design
- `.ai/architecture/data-flow.md` — request flow diagrams
- `.ai/memory/current-architecture.md` — current deployed versions
