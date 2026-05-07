---
ai_priority: tier-3
context_type: product-context
load_when: product-decisions, feature-design, user-impact-assessment
token_budget: low
owner: product-team
last_reviewed: 2026-05-07
---

# Product Context (AI-Optimized)

Concise product context for AI agents. Full context: `docs/PRODUCT_CONTEXT.md`.

---

## What AIEP Does

AI Engineering Platform is internal infrastructure for engineering teams to:
1. **Manage prompts** — version, test, and deploy LLM prompts across services
2. **Route LLM requests** — single gateway for all model access with provider fallback
3. **Run AI agents** — DAG-based workflow execution with tool use
4. **Search semantically** — vector store for RAG-based feature development
5. **Track AI usage** — token costs, latency, and quality metrics by team

---

## Primary Users and Their Goals

| User | Primary Goal | Pain Point Solved |
|---|---|---|
| Application engineer | Call LLMs without managing provider keys | No per-team API key management |
| Prompt engineer | Test and deploy prompt changes safely | Version control and rollback for prompts |
| ML engineer | Run evaluation pipelines on prompts | Automated eval scoring with human-in-the-loop |
| Engineering lead | See LLM cost and quality by team | Cost attribution and SLO tracking |

---

## Key Constraints

- **SOC 2 Type II compliance** — audit log required for all AI-generated content decisions
- **No external PII in LLM prompts** — prompts may not contain real user data
- **Cost governance** — each request is attributed to an organization and quota-tracked
- **Enterprise SLA** — 99.9% uptime target for LLM gateway

---

## Non-Goals

- Not a model training or fine-tuning platform
- Not a customer-facing product (internal only)
- Not a general workflow orchestration platform (Airflow, Temporal are out of scope)
- Not responsible for LLM model quality (we route to external providers)

---

## Success Metrics

| Metric | Current | Target |
|---|---|---|
| Avg LLM request latency (p95) | 420ms | ≤ 350ms |
| Provider failover rate | 2.1% | ≤ 2% |
| Prompt deployment lead time | 3 days | ≤ 4h |
| Token cost vs budget | 94% of budget used | ≤ 90% |

---

## Related Files

- `docs/PRODUCT_CONTEXT.md` — full product context with user journeys
- `docs/DOMAIN_GLOSSARY.md` — terminology definitions
- `.ai/product/domain-model.md` — domain entity relationships
