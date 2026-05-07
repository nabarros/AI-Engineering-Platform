---
ai_priority: tier-2
context_type: sprint-priorities
load_when: starting-work, sprint-planning, task-selection
token_budget: low
owner: platform-team
last_reviewed: 2026-05-07
---

# Current Priorities

Sprint 27 goals (2026-05-05 – 2026-05-16). Update at each sprint boundary.

---

## Sprint 27 Goals

### P0 — Must Complete
1. **Resolve agent heap growth** (AIEP-1867) — required before `agent_tool_use` rollout can continue beyond 25%
2. **Semantic cache accuracy improvements** (AIEP-1842) — dynamic threshold based on prompt length; deploy hotfix to llm-gateway
3. **Prompt Service idempotency keys** (AIEP-1831) — add `Idempotency-Key` header support to prevent duplicate prompts on retry

### P1 — Target Complete
4. **Tool executor timeout → 504 mapping** (AIEP-1855) — expose `TOOL_TIMEOUT` to clients as proper HTTP 504
5. **Vector store deduplication fix** (AIEP-1802) — deduplicate search results in `vectorSearchPipeline`
6. **Model Registry pagination** — add pagination to `GET /v1/models`

### P2 — If Time Allows
7. **Agent DAG validation at submission time** — return 400 for cyclic workflows at creation
8. **Delete legacy streaming code** — `src/services/llm-gateway/streaming/legacy/` (stable for 30 days post-v2 cutover)

---

## Do Not Touch This Sprint

- **Weaviate 1.25 upgrade** — scheduled for Sprint 28 maintenance window (infra-team dependency)
- **OpenTelemetry v2 upgrade** — Q3 2026 coordinated upgrade (all services must move together)
- **Prompt eval auto feature** — eval-team is mid-implementation; no external changes to prompt-service evaluation paths

---

## Engineering Health Goals (Ongoing)

| Metric | Current | Target |
|---|---|---|
| Unit test coverage (avg) | 73% | ≥ 80% |
| p95 API latency (llm-gateway) | 420ms | ≤ 350ms |
| Production error rate | 0.12% | ≤ 0.10% |
| Open security findings | 3 medium | 0 medium |
| Flaky test count | 7 | ≤ 3 |

---

## Upcoming Sprint 28 (2026-05-19)

- Weaviate 1.25 upgrade (infra-team)
- `agent_tool_use` rollout to 50% (if heap issue resolved in Sprint 27)
- Provider abstraction normalization layer (llm-gateway)
- Integration tests for agent-runtime tool execution

---

## Related Files

- `.ai/memory/active-work.md` — in-flight feature branches
- `.ai/memory/implementation-status.md` — feature completion matrix
- `.ai/memory/technical-debt.md` — debt backlog for sprint planning
