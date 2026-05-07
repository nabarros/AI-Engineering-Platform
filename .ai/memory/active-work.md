---
ai_priority: tier-2
context_type: work-in-progress
load_when: starting-new-work, checking-active-features, sprint-planning
token_budget: low
owner: platform-team
last_reviewed: 2026-05-07
---

# Active Work

This file tracks in-flight work items. Update at the start and end of each sprint or when a feature branch is opened/merged.

**Keep entries short.** Full design is in linked ADRs, specs, or Jira tickets.

---

## In-Flight Features

### `feature/agent-tool-use` — Agent Tool Calling Support
- **Owner:** agent-team
- **Branch:** `feature/agent-tool-use`
- **Status:** 25% production rollout (feature flag `agent_tool_use`)
- **Files in progress:**
  - `src/services/agent-runtime/tools/tool-executor.ts`
  - `src/services/agent-runtime/tools/tool-registry.ts`
  - `src/services/agent-runtime/schemas/tool-call.schema.ts`
- **Do not refactor** these files without coordinating with @agent-team
- **Expected merge:** Sprint 28 (2026-05-20)

### `feature/prompt-eval-auto` — Automated Prompt Evaluation
- **Owner:** eval-team
- **Branch:** `feature/prompt-eval-auto`
- **Status:** Under development, flag disabled in production
- **Files in progress:**
  - `src/services/prompt-service/evaluation/auto-eval.service.ts`
  - `src/services/prompt-service/evaluation/llm-judge.client.ts`
- **Dependency:** Requires prompt-service v1.9+ (scheduled for Sprint 29)
- **Expected merge:** Sprint 30 (2026-06-10)

### `feature/semantic-cache` — LLM Semantic Similarity Caching
- **Owner:** platform-team
- **Branch:** `feature/semantic-cache` (merged to main, flag at 50%)
- **Status:** Gradual rollout in progress — monitoring cache hit rate and accuracy
- **Watch:** `src/services/llm-gateway/cache/semantic-cache.service.ts`
- **Target:** 100% rollout if p95 latency gain holds at ≥ 30% in week 2

---

## Blocked Work

### `feature/multi-tenant-isolation` — Per-Tenant Vector Namespacing
- **Owner:** vector-team
- **Blocked by:** Weaviate 1.25 upgrade (waiting for EKS node group update in Sprint 29)
- **Do not start** dependent work until Weaviate is upgraded

---

## Recently Merged (Last 2 Sprints)

| Feature | Merged | Notes |
|---|---|---|
| LLM Streaming v2 | 2026-04-28 | Fully enabled; supersedes old streaming in `legacy/` |
| PostgreSQL 16 upgrade | 2026-04-15 | Completed zero-downtime; PgBouncer updated to 1.22 |
| Prompt versioning UI | 2026-04-10 | Shipped in prompt-service v1.8.0 |

---

## Related Files

- `.ai/memory/current-priorities.md` — sprint goals
- `.ai/memory/implementation-status.md` — feature completion matrix
- `docs/DECISION_LOG.md` — ADRs for architectural decisions
