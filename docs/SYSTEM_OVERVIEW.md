---
ai_priority: high
context_type: orientation
load_when: first contact with codebase, architecture questions, onboarding
token_budget: medium
---

# System Overview

## AI Agent Load Guidance

Load this file when you need a complete mental model of the system. After reading, load `.ai/architecture/component-map.md` for the service inventory and `.ai/architecture/data-flow.md` for communication patterns.

---

## What the System Does

The AI Engineering Platform (AIEP) is the internal AI infrastructure for engineering teams. It provides:

1. **LLM Gateway** — Unified interface for multiple AI providers (OpenAI, Anthropic, internal models). Handles routing, rate limiting, cost tracking, and fallbacks.

2. **Prompt Management** — Version-controlled prompt library with A/B testing, evaluation pipelines, and production deployment workflows.

3. **Agent Orchestration** — Runtime for multi-step AI agent workflows with tool calling, memory management, and execution tracing.

4. **AI Observability** — Real-time metrics on model latency, cost, accuracy, and drift. Alerting on SLO violations.

5. **Vector Store API** — Managed embeddings and semantic search over enterprise knowledge bases.

6. **Model Registry** — Versioned catalog of models, fine-tuned variants, and their evaluation results.

---

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
│  Internal Apps  ·  Developer Tools  ·  Agent Pipelines           │
└───────────────────────────┬──────────────────────────────────────┘
                            │ REST / WebSocket / gRPC
┌───────────────────────────▼──────────────────────────────────────┐
│                          API Gateway                             │
│          (auth, rate limiting, routing, observability)           │
└───────┬──────────────┬────────────────┬──────────┬───────────────┘
        │              │                │          │
   ┌────▼────┐   ┌─────▼──────┐  ┌────▼────┐  ┌──▼──────┐
   │  LLM    │   │  Prompt    │  │ Agent   │  │ Vector  │
   │ Gateway │   │  Service   │  │ Runtime │  │  Store  │
   └────┬────┘   └─────┬──────┘  └────┬────┘  └──┬──────┘
        │              │              │           │
┌───────▼──────────────▼──────────────▼───────────▼───────────────┐
│                     Event Bus (Kafka)                            │
└───────┬──────────────┬──────────────┬──────────────┬────────────┘
        │              │              │              │
   ┌────▼────┐   ┌─────▼──────┐  ┌───▼──────┐  ┌───▼──────┐
   │   AI    │   │  Model     │  │  Audit   │  │  Cost    │
   │  Obs.   │   │  Registry  │  │  Log     │  │ Tracker  │
   └─────────┘   └────────────┘  └──────────┘  └──────────┘
```

---

## Service Inventory

| Service | Language | Responsibility | Port |
|---------|---------|---------------|------|
| `api-gateway` | TypeScript | Auth, routing, rate limiting | 3000 |
| `llm-gateway` | TypeScript | Multi-provider LLM routing | 3001 |
| `prompt-service` | TypeScript | Prompt versioning and deployment | 3002 |
| `agent-runtime` | Python | Agent workflow execution | 8001 |
| `vector-store` | Python | Embeddings and semantic search | 8002 |
| `model-registry` | TypeScript | Model catalog and metadata | 3003 |
| `ai-observability` | Python | Metrics, traces, cost analytics | 8003 |
| `auth-service` | TypeScript | Authentication and authorization | 3004 |
| `audit-service` | TypeScript | Compliance and audit logging | 3005 |

---

## Data Storage

| Store | Technology | Used By |
|-------|-----------|---------|
| Primary DB | PostgreSQL 16 | All services (separate schemas) |
| Cache | Redis 7 | Gateway, auth, rate limiting |
| Vector DB | Weaviate | Vector store service |
| Message Bus | Apache Kafka | All async communication |
| Object Storage | S3-compatible | Prompt versions, model artifacts |
| Time-series | Prometheus | Observability metrics |

---

## Key Integration Patterns

- **Sync:** REST over HTTP/2 for user-facing APIs and inter-service queries
- **Async:** Kafka for events, audit logs, cost tracking, and observability data
- **Streaming:** WebSocket for real-time LLM token streaming to clients
- **Batch:** Scheduled jobs via Kubernetes CronJobs for evaluation pipelines

---

## Deployment Topology

- **Environments:** `development` → `staging` → `production`
- **Production:** AWS EKS, multi-AZ, 3 replicas minimum per service
- **Staging:** Single-AZ, 1 replica per service
- **Development:** Docker Compose on local machine

---

## Ownership

| Domain | Team |
|--------|------|
| API Gateway + Auth | Platform Team |
| LLM Gateway + Model Registry | AI Infrastructure Team |
| Prompt Service | AI Product Team |
| Agent Runtime | AI Workflows Team |
| Vector Store | Data Platform Team |
| Observability | SRE Team |

---

## Related Files

- Detailed service design → `.ai/architecture/system-design.md`
- Service dependency graph → `.ai/architecture/component-map.md`
- Data flow diagrams → `.ai/architecture/data-flow.md`
- Product goals → `.ai/product/product-context.md`
- Domain glossary → `docs/DOMAIN_GLOSSARY.md`
