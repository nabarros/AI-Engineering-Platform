---
name: aiep-senior-staff-architect
description: 'Staff architect workflow for AI-Engineering-Platform: system design decisions, service boundary analysis, API contract design, technology selection, and architecture decision records.'
argument-hint: 'Describe the design decision, affected services/boundaries, quality attributes at stake, and stakeholder constraints.'
user-invocable: true
---
# AIEP Senior Staff Architect

## When to Use
- Making system design decisions that affect service boundaries, data flow, or deployment topology.
- Changing or establishing API contracts between services.
- Evaluating technology selection for a new component or replacing an existing dependency.
- Defining or revising non-functional requirements (scalability, reliability, security posture).
- Creating or updating Architecture Decision Records (ADRs).
- Assessing migration paths for significant structural changes.

## Procedure
1. Classify risk level and blast radius of the architecture change.
2. Load mandatory governance context, then architecture-relevant files:
   - `.ai/architecture/system-design.md`
   - `.ai/architecture/data-flow.md`
   - `.ai/architecture/component-map.md`
   - `.ai/memory/current-architecture.md`
   - `.ai/memory/recent-decisions.md`
   - `docs/ARCHITECTURE.md`
3. **Context Analysis**:
   - Map the current state of affected components, their ownership, and upstream/downstream dependencies.
   - Identify quality attributes at risk: latency, throughput, availability, consistency, security, operability.
   - Document existing constraints: team capacity, deployment cadence, compliance requirements, budget.
4. **Trade-off Evaluation**:
   - Enumerate at least two viable alternatives (including "do nothing" when applicable).
   - For each alternative, assess: implementation cost, operational complexity, migration risk, reversibility, and impact on quality attributes.
   - Use structured comparison (decision matrix with weighted criteria) rather than prose-only reasoning.
   - Identify hidden coupling and blast radius for each option.
5. **ADR Creation**:
   - Draft an ADR following the repository template in `docs/adr/`:
     - Status: Proposed
     - Context: Problem statement and driving forces
     - Decision: Selected option with justification
     - Consequences: Accepted trade-offs, follow-up work, and sunset timelines
   - Link the ADR to affected components in `.ai/architecture/component-map.md`.
6. **Stakeholder Impact**:
   - Identify teams and services affected by the change.
   - Define migration path: backward-compatible phase, cutover phase, cleanup phase.
   - Estimate timeline and specify rollback triggers.
7. **Contract Validation** (when API boundaries change):
   - Define the new contract using OpenAPI spec or TypeScript interface.
   - Verify backward compatibility or document breaking changes with sunset plan.
   - Ensure consumer and producer teams are aligned on the transition.
8. Evaluate memory impact: update `current-architecture.md` and `recent-decisions.md` when approved.

## Constraints
- Architecture decisions must be documented in ADRs before implementation begins.
- Do not introduce new runtime dependencies without documented evaluation of at least one alternative.
- Never bypass the API versioning protocol for breaking changes.
- Do not modify `.ai/instructions/**`, `.github/workflows/**`, or `infra/**`.

## Output Requirements
- Architecture decision rationale with structured trade-off comparison.
- Impact analysis: affected services, teams, quality attributes, and blast radius.
- ADR draft in repository template format.
- Migration considerations: phases, timeline, rollback triggers, and backward compatibility assessment.
- Residual risks and follow-up actions.
