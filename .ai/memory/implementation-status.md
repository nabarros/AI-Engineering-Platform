---
ai_priority: tier-2
context_type: feature-status
load_when: scope-assessment, feature-discovery, estimating-work
token_budget: low
owner: platform-team
last_reviewed: 2026-05-07
---

# Implementation Status

Feature completion matrix across AIEP services. Update when features ship or scope changes.

**Status codes:** ✅ Complete · 🔄 In Progress · ⏳ Planned · ❌ Not Planned

---

## LLM Gateway

| Feature | Status | Version | Notes |
|---|---|---|---|
| Provider routing | ✅ | v2.0 | OpenAI (primary), Anthropic (fallback) |
| Failover / circuit breaker | ✅ | v2.1 | Hystrix-style, 5s window |
| Streaming responses | ✅ | v2.4 | v2 implementation; legacy removed |
| Request queue (burst buffer) | ✅ | v2.2 | Redis-backed queue |
| Semantic cache | 🔄 | v2.4 | 50% rollout; flag `semantic_cache` |
| Prompt injection detection | ✅ | v2.3 | Pre-inference filter |
| Multi-modal input (images) | ⏳ | — | Planned Q3 2026 |
| Fine-tuned model routing | ❌ | — | Not on roadmap |

---

## Prompt Service

| Feature | Status | Version | Notes |
|---|---|---|---|
| Prompt CRUD | ✅ | v1.0 | — |
| Prompt versioning | ✅ | v1.8 | Full history; diff view in UI |
| Prompt templates (variables) | ✅ | v1.2 | `{{variable}}` syntax |
| Prompt tagging | ✅ | v1.4 | Array of tags, indexed |
| Prompt sharing / permissions | ✅ | v1.6 | Owner + viewer + editor RBAC |
| A/B testing (eval routing) | ⏳ | — | Planned Sprint 31 |
| Automated evaluation | 🔄 | v1.9 | Flag `prompt_eval_auto`; flag disabled |
| Prompt marketplace | ❌ | — | Not planned; out of scope |

---

## Agent Runtime

| Feature | Status | Version | Notes |
|---|---|---|---|
| Sequential step execution | ✅ | v1.0 | — |
| DAG workflow support | ✅ | v1.2 | Directed acyclic graph workflows |
| Tool calling (function use) | 🔄 | v1.4 | 25% rollout; flag `agent_tool_use` |
| Human-in-the-loop steps | ⏳ | — | Planned Q3 2026 |
| Agent state persistence | ✅ | v1.3 | Redis-backed; 24h TTL |
| Parallel step execution | ⏳ | — | Planned Q4 2026 |
| Streaming agent output | 🔄 | v1.4 | In-progress; tied to tool-use branch |

---

## Vector Store Service

| Feature | Status | Version | Notes |
|---|---|---|---|
| Document indexing (Weaviate) | ✅ | v1.0 | HNSW; OpenAI 1536-dim embeddings |
| Semantic search | ✅ | v1.0 | Top-K with MMR reranking |
| Hybrid search (BM25 + vector) | ✅ | v1.1 | Weaviate native |
| Multi-tenant namespacing | 🔄 | — | Blocked; waiting Weaviate 1.25 upgrade |
| Embedding model selection | ⏳ | — | Planned Q3 2026 |

---

## Auth Service

| Feature | Status | Version | Notes |
|---|---|---|---|
| JWT issue / verify | ✅ | v3.0 | RS256, 15min access + 7d refresh |
| API key management | ✅ | v3.1 | Bcrypt-hashed; scoped permissions |
| RBAC (viewer/editor/admin) | ✅ | v3.0 | — |
| SSO (SAML 2.0) | ✅ | v3.2 | Okta + generic IdP |
| MFA | ⏳ | — | Planned Q3 2026 |

---

## Observability

| Feature | Status | Notes |
|---|---|---|
| Distributed tracing (OTEL) | ✅ | All services instrumented |
| Structured logging (JSON) | ✅ | pino (Node) + structlog (Python) |
| Prometheus metrics | ✅ | Standard + custom LLM metrics |
| Grafana dashboards | ✅ | Per-service + cross-service overview |
| LLM-specific metrics | ✅ | Token usage, cost, latency by provider |
| Cost attribution | 🔄 | Per-org cost tagging; 80% complete |
| Anomaly detection alerts | ⏳ | Planned Q4 2026 |

---

## Related Files

- `.ai/memory/active-work.md` — current in-flight items
- `.ai/memory/technical-debt.md` — deferred work
- `.ai/memory/current-priorities.md` — sprint priorities
