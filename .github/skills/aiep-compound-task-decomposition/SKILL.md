---
name: aiep-compound-task-decomposition
description: 'Decomposes multi-domain tasks into ordered sub-tasks with specialist assignments, dependency graphs, and parallel execution opportunities. Use before specialist dispatch when a task spans 2+ agent domains.'
argument-hint: 'Full task description spanning multiple domains, with acceptance criteria and constraints.'
user-invocable: true
---
# AIEP Compound Task Decomposition

## When to Use
- Task description spans two or more specialist domains (e.g., "add an API endpoint and build the UI for it").
- Task description contains "and" or "then" connecting concerns that belong to different specialists.
- A single specialist cannot complete the task without outputs from another domain.
- Task involves coordinated changes across service boundaries, layers, or deployment targets.

## Procedure

### 1. Domain Classification
For each identifiable concern in the task description, assign exactly one primary domain:

| Domain | Indicators | Specialist |
|---|---|---|
| Frontend | UI components, React, state management, accessibility | `aiep-senior-staff-frontend` |
| Backend | API endpoints, business logic, data access, validation | `aiep-senior-staff-backend` |
| UI/UX | Design system, interaction patterns, usability, visual design | `aiep-senior-staff-ui-ux` |
| SRE | Reliability, observability, incident response, SLOs | `aiep-senior-staff-sre` |
| AI/LLM | Model integration, prompts, RAG, embeddings, inference | `aiep-senior-staff-ai-llm` |
| Architect | System design, service boundaries, ADRs, technology selection | `aiep-senior-staff-architect` |
| DevOps | CI/CD, deployment, infrastructure, release management | `aiep-senior-staff-devops` |

If a concern straddles two domains, assign it to the domain that owns the primary artifact (e.g., an API schema change is Backend even if it affects Frontend consumers).

### 2. Dependency Graph Construction
For each sub-task pair, determine the dependency relationship:

- **Blocked-by**: Sub-task B requires an output artifact from sub-task A (e.g., Frontend needs the API contract from Backend).
- **Independent**: Sub-tasks share no artifacts and can execute in any order.
- **Soft-dependency**: Sub-task B benefits from A's output but can proceed with a reasonable assumption or mock.

Represent as an adjacency list:
```
A -> B (blocked-by: API schema)
A -> C (independent)
B -> D (blocked-by: component props from B's UI)
```

### 3. Parallel Opportunity Detection
Group sub-tasks into execution waves based on the dependency graph:

- **Wave 1**: All sub-tasks with zero inbound dependencies.
- **Wave 2**: Sub-tasks whose dependencies are fully satisfied by Wave 1 outputs.
- **Wave N**: Continue until all sub-tasks are assigned.

Within each wave, sub-tasks execute in parallel. Across waves, execution is sequential.

### 4. Delegation Plan
For each sub-task, produce a delegation record:

- **ID**: Sequential identifier (e.g., `CT-1`, `CT-2`).
- **Domain**: Primary domain from step 1.
- **Specialist**: Skill file path.
- **Description**: Concrete, actionable scope statement.
- **Inputs**: Artifacts or assumptions required from upstream sub-tasks.
- **Outputs**: Artifacts this sub-task must produce for downstream consumers.
- **Wave**: Execution wave from step 3.
- **Risk**: Individual sub-task risk level (LOW/MEDIUM/HIGH/CRITICAL).

### 5. Integration Verification
After all waves complete, verify cross-domain consistency:

- Type/schema alignment between producer and consumer sub-tasks.
- API contract compatibility (request/response shapes, error codes).
- Shared state consistency (database migrations applied before dependent code).
- End-to-end test coverage that exercises the full cross-domain path.
- No orphaned artifacts or dangling references.

## Output Requirements
- Decomposed sub-task list with domain assignments and specialist skill paths.
- Dependency graph in adjacency-list format with dependency type labels.
- Execution wave assignment showing parallel groups.
- Delegation records for each sub-task (ID, domain, specialist, description, inputs, outputs, wave, risk).
- Overall compound task risk level (highest individual sub-task risk).
- Integration verification checklist.
