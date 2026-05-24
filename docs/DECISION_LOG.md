---
ai_priority: medium
context_type: decision-history
load_when: architecture decisions, understanding why the system is designed this way, avoiding revisiting resolved debates
token_budget: low
---

# Decision Log

## AI Agent Load Guidance

Load this file when you encounter an architectural pattern and need to understand why it was chosen, or when you are about to propose a change that may conflict with a recorded decision. Do NOT re-open decided items without new information.

---

## Format

Each entry follows the ADR (Architecture Decision Record) format. Full ADR documents are in `.ai/architecture/adrs/`.

---

## ADR-001: Spec-First API Design

**Status:** Accepted  
**Date:** 2024-01-10  
**Decision:** All API contracts must be written in OpenAPI before implementation begins. The spec is the authoritative contract.

**Context:** Teams were implementing APIs inconsistently, leading to contract drift between documentation and behaviour.

**Alternatives considered:** Code-first (generate spec from code), no spec at all.

**Rationale:** Spec-first forces thinking about the contract before implementation, enables consumer-driven contract testing, and eliminates documentation-implementation drift.

---

## ADR-002: Result<T, E> Pattern for Business Logic

**Status:** Accepted  
**Date:** 2024-01-12  
**Decision:** All service-layer operations that can predictably fail return `Result<T, E>` with typed error codes. Exceptions reserved for truly exceptional conditions.

**Context:** Try/catch patterns were swallowing errors and making failure modes invisible in type signatures.

**Alternatives considered:** Throwing typed exceptions, using `Option<T>` for missing resources.

**Rationale:** `Result<T, E>` makes all failure modes explicit in the type signature, forces callers to handle errors, and avoids exception-as-flow-control anti-pattern.

---

## ADR-003: Bounded Database Ownership

**Status:** Accepted  
**Date:** 2024-01-15  
**Decision:** Each service owns a dedicated PostgreSQL schema. No service issues queries against another service's schema. Cross-service data access via API or Kafka events.

**Context:** Early prototypes had services issuing direct cross-service DB queries, creating tight coupling and data ownership ambiguity.

**Alternatives considered:** Shared database with per-table ownership, separate PostgreSQL instances per service.

**Rationale:** Schema-level separation enforces service boundaries without the operational overhead of separate PostgreSQL instances. API/event-based access enables independent evolution and explicit contracts.

---

## ADR-004: Kafka for Async Inter-Service Communication

**Status:** Accepted  
**Date:** 2024-01-18  
**Decision:** All asynchronous inter-service communication uses Kafka. No direct service-to-service async calls (no queues between specific service pairs).

**Context:** Needed a scalable, replayable event bus for observability data, audit logging, and side effects.

**Alternatives considered:** RabbitMQ, direct async HTTP calls, Redis Streams.

**Rationale:** Kafka provides event replay (critical for observability backfill), high throughput for AI telemetry data, and a natural event log for audit requirements.

---

## ADR-005: Auth Service as Sole Authentication Authority

**Status:** Accepted  
**Date:** 2024-01-20  
**Decision:** A dedicated `auth-service` handles all authentication and authorization. Other services verify JWTs but never implement authentication logic.

**Context:** Risk of inconsistent auth implementations across services; RBAC logic scattered across multiple codebases.

**Alternatives considered:** Auth per service, API Gateway-only auth.

**Rationale:** Centralizing auth reduces attack surface, enables consistent RBAC policy, simplifies auditing, and eliminates the risk of N independent auth implementations with different vulnerabilities.

---

## ADR-006: Weaviate for Vector Storage

**Status:** Accepted  
**Date:** 2024-02-05  
**Decision:** Weaviate is the vector database for all embedding storage and semantic search.

**Context:** Needed a production-grade vector database with hybrid search, multi-tenancy, and self-hosted deployment option.

**Alternatives considered:** Pinecone, pgvector, Qdrant, Chroma.

**Rationale:** Weaviate supports hybrid search (BM25 + vector), has multi-tenancy for namespace isolation, is self-hostable (data residency compliance), and has strong operational maturity.

---

## ADR-007: Feature Flags for In-Progress Features

**Status:** Accepted  
**Date:** 2024-02-10  
**Decision:** Features incomplete at the time of merge are gated behind feature flags rather than living in long-running branches.

**Context:** Long-lived feature branches caused painful merge conflicts and delayed integration.

**Alternatives considered:** Feature branches, draft PRs, deploy branches.

**Rationale:** Feature flags enable continuous integration while controlling feature exposure. They also enable canary rollouts and A/B testing in production.

---

## ADR-008: OpenTelemetry for Distributed Tracing

**Status:** Accepted  
**Date:** 2024-02-15  
**Decision:** All services use the OpenTelemetry SDK for tracing. Backend: Datadog APM.

**Context:** Needed vendor-neutral observability instrumentation that could work with multiple backends.

**Alternatives considered:** Datadog SDK directly, Jaeger, custom tracing.

**Rationale:** OpenTelemetry is the industry standard for vendor-neutral observability. Switching backends (e.g., from Datadog to another tool) requires no code changes.

---

## ADR-009: TypeScript Strict Mode Mandatory

**Status:** Accepted  
**Date:** 2024-01-08  
**Decision:** All TypeScript code in this repository runs with `strict: true`. No exceptions without team approval.

**Context:** Inconsistent TypeScript configurations across services led to runtime errors that strict mode would have caught at compile time.

**Alternatives considered:** Per-service configuration, gradual strict adoption.

**Rationale:** The benefits of strict mode (catching null dereferences, implicit any) outweigh the migration cost. Starting all new services strict from day one eliminates the migration debt.

---

## ADR-010: Pydantic v2 for Python Data Validation

**Status:** Accepted  
**Date:** 2024-03-01  
**Decision:** All Python services use Pydantic v2 for data model definition and validation.

**Context:** Inconsistent validation patterns across Python services; Pydantic v1 has known performance limitations.

**Alternatives considered:** dataclasses, marshmallow, attrs, Pydantic v1.

**Rationale:** Pydantic v2 provides 5-50x performance improvement over v1, excellent TypeScript-like type safety for Python, and is the de facto standard for FastAPI services.

---

## ADR-011: P0 Mitigation Baseline for Connector and Collaboration Runtime

**Status:** Accepted  
**Date:** 2026-05-24  
**Decision:** Implement a deterministic mitigation baseline for P0 roadmap items in orchestration runtime using contract-first connector modules and collaboration runtime controls.

**Context:** P0 execution lanes required immediate risk reduction and demonstrable progress before full production hardening could be completed.

**Alternatives considered:** Keep P0 tasks in planning-only state, implement only docs-level commitments.

**Rationale:** A code-level mitigation baseline enables test-gated progress now while preserving compatibility with later production hardening, rollout, and telemetry enhancements.

---

## Adding New Decisions

Use the ADR template at `.ai/templates/adr.md`. Record decisions here as summary entries once approved. Full ADR documents live in `.ai/architecture/adrs/`.
