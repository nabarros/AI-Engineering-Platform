---
ai_priority: tier-3
context_type: glossary
load_when: unfamiliar-terms, domain-understanding, onboarding
token_budget: low
owner: platform-team
last_reviewed: 2026-05-07
---

# Domain Glossary (AI-Optimized)

Key AIEP terms only. Full glossary: `docs/DOMAIN_GLOSSARY.md`.

---

## Platform Concepts

**Model Tier** — Classification of LLM models by capability and cost: `standard` (GPT-4o-mini), `premium` (GPT-4o, Claude 3.5 Sonnet), `custom` (fine-tuned models). Used for quota and routing.

**Prompt Template** — A versioned string with `{{variable}}` placeholders. Stored in prompt-service. Has draft/active/archived lifecycle.

**Prompt Version** — Immutable snapshot of a prompt's content. Only one version per prompt is `active`. Creating a new version does not change previous versions.

**Workflow** — A DAG (directed acyclic graph) of steps executed by agent-runtime. Each step can call a tool, invoke an LLM, or trigger another workflow.

**Workflow Execution** — A runtime instance of a workflow. Has its own context object, status, and step results.

**Tool** — A function an agent can call during workflow execution. Tools are declared in `WorkflowDefinition.allowed_tools[]`.

**Semantic Cache** — Redis-based cache in llm-gateway that stores LLM responses keyed by embedding similarity. Reduces cost and latency for near-duplicate requests. Currently behind feature flag `llm-gateway.semantic-cache`.

**Eval Set** — A labeled dataset of prompt inputs and expected outputs used for automated prompt quality evaluation.

**Model Registry** — Catalog of available AI models with metadata: provider, capabilities, context window, pricing, and current status.

**Document Chunk** — A segment of an indexed document stored as a vector embedding in Weaviate. The unit of RAG retrieval.

**Organization (Org)** — The primary grouping unit. All prompts, workflows, and usage records belong to an org. Billing and quotas are org-scoped.

**Quota** — A per-org limit on token consumption per period. Enforced by llm-gateway before forwarding requests.

**Audit Log** — Immutable record of every LLM request: org, user, model, token counts, cost, and latency. Written to audit-service via Kafka topic `aiep.audit.events`.

---

## Service Nicknames

| Short Name | Full Service Name | Port |
|---|---|---|
| gateway | llm-gateway | 3001 |
| prompt-svc | prompt-service | 3002 |
| agent | agent-runtime | 3003 |
| vector-svc | vector-store-service | 3004 |
| model-reg | model-registry | 3005 |
| inference | inference-service | 3006 |
| observ | observability-service | 3007 |
| auth | auth-service | 3008 |
| audit | audit-service | 3009 |

---

## Kafka Topics

| Topic | Producer | Consumer(s) |
|---|---|---|
| `aiep.llm.requests` | llm-gateway | observability-service, audit-service |
| `aiep.audit.events` | all services | audit-service |
| `aiep.agent.events` | agent-runtime | observability-service |
| `aiep.vector.index` | vector-store-service | observability-service |

---

## Related Files

- `docs/DOMAIN_GLOSSARY.md` — full glossary with extended definitions
- `.ai/glossary/ai-terminology.md` — AI/ML terminology
- `.ai/architecture/component-map.md` — service and component map
