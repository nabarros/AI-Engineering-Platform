---
ai_priority: medium
context_type: product-knowledge
load_when: building new features, evaluating user stories, prioritization decisions
token_budget: low
---

# Product Context

## AI Agent Load Guidance

Load this file when you need to understand *why* features exist, *who* uses the system, or *what* business outcomes matter. This context helps AI agents make better design decisions aligned with product goals.

---

## Product Vision

The AI Engineering Platform (AIEP) makes every engineer at the organization an effective builder of AI-powered products. We remove the infrastructure complexity so teams can focus on what their AI features should do, not how to run them safely at scale.

---

## Users

### Primary: Internal Engineering Teams

Teams building products that need AI capabilities. They want:
- Reliable, fast LLM access without managing provider accounts or rate limits
- A library of tested, versioned prompt templates they can reuse
- Visibility into AI costs and performance across their features
- Simple APIs that don't require deep AI expertise

Pain points we solve:
- "We can't reliably track AI costs per team or feature"
- "Prompts are scattered in code, no versioning, no testing"
- "When OpenAI has an outage, all our AI features break"
- "We don't know if our prompts are degrading over time"

### Secondary: AI/ML Engineers

Engineers building and evaluating AI models and workflows. They want:
- Fine-grained observability (latency, token usage, accuracy by model)
- A/B testing infrastructure for prompt changes
- Agent workflow primitives without building from scratch
- Vector store management for RAG applications

### Tertiary: Engineering Leadership

VPs and Directors who need:
- Cost dashboards per team and per feature
- Risk visibility (what AI features are in production, what data do they access)
- Compliance evidence (audit trail for AI decisions)

---

## Core User Journeys

These must be covered by E2E tests:

1. **Consume LLM via API** — Team makes an LLM request, gets a response, sees it in their cost dashboard
2. **Create and deploy a prompt** — Engineer creates a prompt template, tests it with an eval set, promotes to production
3. **Build an agent workflow** — Engineer defines a multi-step workflow, executes it, inspects the trace
4. **Search a knowledge base** — Engineer embeds documents, queries them semantically, gets relevant results
5. **View AI cost report** — Leader views cost breakdown by team and model for the month

---

## Business Constraints

- **Cost governance:** Total AI spend is budgeted per team. Teams must not be able to exceed their budget without approval
- **Data residency:** Customer PII must not leave the designated data region (EU or US)
- **Audit trail:** All AI decisions on customer data require an audit log entry
- **SOC 2 compliance:** The system must maintain SOC 2 Type 2 compliance
- **Model availability:** P99.9 availability for LLM routing with at least one provider available

---

## Non-Goals

What AIEP explicitly does NOT do:

- Training or fine-tuning models (use the ML Platform team's tooling)
- Storing large datasets (use the Data Platform)
- Serving external (customer-facing) AI features directly (AIEP is an internal platform)
- Replacing product-specific AI logic (we provide primitives, not full AI products)

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Teams using AIEP | > 80% of engineering teams within 12 months |
| LLM request success rate | > 99.5% |
| Prompt deployment time (from create to production) | < 1 hour |
| AI cost visibility | 100% of spend attributed to a team |
| Developer onboarding time | < 30 minutes from zero to first LLM call |

---

## Related Files

- Domain model → `.ai/product/domain-model.md`
- Domain glossary → `docs/DOMAIN_GLOSSARY.md`
- System overview → `docs/SYSTEM_OVERVIEW.md`
