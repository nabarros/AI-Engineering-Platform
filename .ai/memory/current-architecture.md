---
ai_priority: tier-2
context_type: architecture-state
load_when: architecture-questions, service-discovery, version-checks
token_budget: low
owner: platform-team
last_reviewed: 2026-05-07
---

# Current Architecture State

This file reflects the current deployed state of the platform. Update when services are upgraded, configurations change, or new components are added.

---

## Service Versions (Production)

| Service | Version | Runtime | Base Image | Last Deploy |
|---|---|---|---|---|
| llm-gateway | 2.4.1 | Node 20.12 | node:20-alpine | 2026-04-28 |
| prompt-service | 1.8.0 | Node 20.12 | node:20-alpine | 2026-04-20 |
| agent-runtime | 1.3.2 | Node 20.12 | node:20-alpine | 2026-04-15 |
| vector-store-service | 1.1.0 | Python 3.12 | python:3.12-slim | 2026-04-10 |
| model-registry | 1.2.3 | Node 20.12 | node:20-alpine | 2026-04-05 |
| inference-service | 2.1.0 | Python 3.12 | python:3.12-slim | 2026-04-25 |
| observability-service | 1.0.5 | Node 20.12 | node:20-alpine | 2026-03-30 |
| auth-service | 3.2.1 | Node 20.12 | node:20-alpine | 2026-03-15 |
| audit-service | 1.0.2 | Node 20.12 | node:20-alpine | 2026-03-10 |

---

## Infrastructure State

| Component | Version | Cluster | Config Note |
|---|---|---|---|
| PostgreSQL | 16.2 | RDS Multi-AZ | 200 connection pool via PgBouncer 1.22 |
| Redis | 7.2 | ElastiCache | Cluster mode disabled; 2 replicas |
| Weaviate | 1.24 | EKS pod | HNSW index; 1536-dim embeddings (OpenAI) |
| Kafka | 3.6 | MSK | 3 brokers, replication factor 3 |
| Kubernetes | 1.29 | EKS us-east-1 | 3 node groups (general, ml-cpu, ml-gpu) |

---

## Active Feature Flags

| Flag | Status | Owner | Purpose |
|---|---|---|---|
| `llm_streaming_v2` | enabled (100%) | llm-team | New streaming implementation — fully rolled out |
| `agent_tool_use` | enabled (25%) | agent-team | Tool use capability for agent runtime — gradual rollout |
| `semantic_cache` | enabled (50%) | platform-team | Semantic similarity caching for LLM responses |
| `prompt_eval_auto` | disabled | eval-team | Automated prompt evaluation on save — under development |

---

## LLM Provider Status

| Provider | Status | Models Available | Rate Limit (RPM) |
|---|---|---|---|
| OpenAI | Active (primary) | gpt-4o, gpt-4o-mini | 10,000 |
| Anthropic | Active (fallback) | claude-3-5-sonnet-20241022 | 4,000 |

---

## Current Kubernetes Resource Limits

| Service | CPU Request | CPU Limit | Memory Request | Memory Limit | Replicas |
|---|---|---|---|---|---|
| llm-gateway | 250m | 1000m | 512Mi | 2Gi | 3 |
| prompt-service | 100m | 500m | 256Mi | 1Gi | 3 |
| inference-service | 500m | 2000m | 1Gi | 4Gi | 2 |
| vector-store-service | 250m | 1000m | 512Mi | 2Gi | 2 |

---

## Related Files

- `docs/ARCHITECTURE.md` — architectural design (stable)
- `docs/DEPLOYMENT_GUIDE.md` — deployment process
- `.ai/memory/known-issues.md` — current known issues
- `.ai/memory/recent-decisions.md` — recent configuration decisions
