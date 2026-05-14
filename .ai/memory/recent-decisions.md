---
ai_priority: tier-2
context_type: decision-history
load_when: architecture-questions, rationale-needed, change-assessment
token_budget: low
owner: platform-team
last_reviewed: 2026-05-07
---

# Recent Decisions

Informal decision log for recent technical choices that don't warrant a full ADR. For formal architectural decisions, see `docs/DECISION_LOG.md`.

---

## 2026-05 (Current Month)

### Agent orchestration platform upgraded to v2 architecture
- **Date:** 2026-05-14
- **Decision:** Major upgrade to the multi-agent orchestration system: expanded from 8 to 11 agents, added compound task decomposition, confidence-based routing, and domain-aware planning
- **Rationale:** Gap analysis against Ruflo reference architecture revealed critical missing capabilities: no AI/LLM specialist, no architect agent, no DevOps agent, naive planner, no compound task handling, no routing confidence scoring
- **Key changes:**
  - 3 new specialist agents (AI/LLM, Architect, DevOps)
  - Router rewritten with 26-domain taxonomy, multi-tier confidence thresholds, progressive fallback
  - Planner rewritten with dependency graph construction, domain detection, risk assessment per step
  - Capability registry expanded with richer domain tags per agent
  - Skill orchestration enhanced with compound task protocol, token budget awareness, conflict detection
  - 4 new skills created (compound-task-decomposition, AI/LLM, architect, DevOps)
  - Policy engine enhanced with 25 risk escalation triggers and AI-specific warnings
- **Owner:** platform-architecture
- **Tests:** 33 tests passing (19 original + 14 new)
- **Revisit:** After production validation of compound routing accuracy

### Semantic cache threshold set to 0.97 for short prompts
- **Date:** 2026-05-01
- **Decision:** Apply cosine similarity threshold of 0.97 (vs global 0.95) for prompts with `estimatedTokens < 25`
- **Rationale:** Short prompt embeddings have lower variance; 0.95 was producing false positives (see known-issues.md)
- **Owner:** platform-team
- **Revisit:** After v2.5 release — may apply threshold as a function of prompt length

### Weaviate 1.25 upgrade deferred to Sprint 29
- **Date:** 2026-05-03
- **Decision:** Defer Weaviate upgrade from 1.24 to 1.25 to Sprint 29 (2026-05-20 window)
- **Rationale:** Requires EKS node group update (GPU nodes); planned maintenance window
- **Impact:** Blocks multi-tenant vector namespacing feature (see active-work.md)
- **Owner:** infra-team

---

## 2026-04

### agent-tool-use gradual rollout capped at 25%
- **Date:** 2026-04-20
- **Decision:** Hold `agent_tool_use` flag at 25% until memory leak investigation is complete
- **Rationale:** Heap growth observed at 25% — tracking in Jira AIEP-1867; increasing rollout paused
- **Owner:** agent-team
- **Revisit:** After AIEP-1867 resolved; target 100% in Sprint 28

### Adopted Kysely as query builder for new DB code
- **Date:** 2026-04-10
- **Decision:** New database queries use Kysely over raw `pg` queries (except for migrations)
- **Rationale:** Type-safe, composable, no magic; raw queries stay in migrations for clarity
- **Owner:** platform-team
- **Scope:** New code only — existing raw queries not required to migrate

### Removed Prisma from prompt-service
- **Date:** 2026-04-05
- **Decision:** Replaced Prisma ORM with Kysely + direct migration files (Flyway)
- **Rationale:** Prisma shadow DB caused issues in RDS Multi-AZ; Prisma migration history conflicted with team's Flyway workflow; Kysely type generation is simpler
- **ADR:** Documented in `docs/DECISION_LOG.md` ADR-011 (to be filed)
- **Owner:** platform-team

---

## 2026-03

### PgBouncer mode set to session (not transaction)
- **Date:** 2026-03-15
- **Decision:** Use PgBouncer session mode exclusively
- **Rationale:** Services use PostgreSQL `LISTEN/NOTIFY` for real-time events; transaction mode incompatible
- **Trade-off:** Fewer effective connections vs transaction mode; acceptable at current scale
- **Revisit:** If connection pressure increases beyond 80% of session limit

### OpenTelemetry SDK locked to v1.x
- **Date:** 2026-03-10
- **Decision:** Pin `@opentelemetry/sdk-*` to v1.x series; do not upgrade to v2.x until all services tested
- **Rationale:** v2.0 has breaking changes in span processor API; coordinated upgrade required
- **Owner:** observability-team
- **Target upgrade window:** Q3 2026

---

## Related Files

- `docs/DECISION_LOG.md` — formal ADRs (ADR-001 through ADR-010)
- `.ai/memory/current-priorities.md` — active sprint goals
- `.ai/memory/technical-debt.md` — deferred work
