---
ai_priority: tier-3
context_type: template
load_when: writing-feature-spec, planning-new-feature
token_budget: low
owner: platform-team
last_reviewed: 2026-05-07
---

# Template: Feature Specification

Use for any feature that spans multiple services, requires new API contracts, or involves > 1 sprint of work. Smaller features can skip this template.

---

```markdown
# Feature Spec: {Feature Name}

**Jira:** AIEP-XXXX
**Author:** @engineer
**Status:** Draft | In Review | Approved | Implemented
**Target:** Sprint {N} / Q{Q} {YEAR}

---

## Problem Statement

What user or system problem does this solve? Why does it matter?

Describe:
- Who is affected (user type or service)
- What pain point or missing capability exists
- What the cost of not solving this is

---

## Proposed Solution

High-level description of the solution.

Include:
- What will be built
- What will NOT be built (out of scope)
- Key user-facing changes (if any)

---

## API Contract (if applicable)

Describe new or changed endpoints. Write OpenAPI spec before implementation.

### New Endpoints

**POST /v1/{resource}**
- Auth: viewer | editor | admin | none
- Request: `{ field1: string, field2: number }`
- Response 201: `{ data: { id: string, ... } }`
- Response 400: `{ error: "Validation failed", code: "VALIDATION_ERROR" }`
- Response 409: `{ error: "Already exists", code: "DUPLICATE" }`

### Changed Endpoints

**GET /v1/{resource}** — adding new optional query parameter
- New param: `?filter=value`
- Backwards compatible: yes (parameter is optional, default behavior unchanged)

---

## Data Model (if applicable)

New tables, columns, or schema changes.

```sql
-- New table
CREATE TABLE {table_name} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ...
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
```

Migration strategy: [single migration | multi-phase | describe]

---

## Service Changes

| Service | Change Type | Description |
|---|---|---|
| {service-name} | New route | POST /v1/... |
| {service-name} | Schema change | Add column X to table Y |
| {service-name} | Kafka producer | Emit event to topic Z |

---

## Dependencies and Blockers

- Depends on: {other feature or infra change}
- Blocked by: {what must be done first}

---

## Testing Plan

| Test Type | What | Pass Criteria |
|---|---|---|
| Unit | Service logic | All paths covered |
| Integration | DB + service | Happy path + errors |
| E2E | Full user flow | Scenario passes |
| Contract | New API contract | Pact test added |

---

## Rollout Plan

- Feature flag: `{flag_name}` (default: disabled)
- Phase 1: Enable for internal team (5%)
- Phase 2: Enable for pilot customers (25%)
- Phase 3: Full rollout (100%)
- Rollback trigger: error rate > 1% or p95 > 2s

---

## Open Questions

- [ ] Question 1 — owner: @engineer — due: YYYY-MM-DD
- [ ] Question 2 — owner: @engineer — due: YYYY-MM-DD
```

---

## Guidelines

- **Write the spec before starting implementation.** Implementation begins only when spec is Approved.
- **API contracts are immutable once approved.** Changes require a new spec or addendum.
- **Keep scope explicit.** "Out of scope" section prevents scope creep.
- **Link the Jira ticket.** Spec and implementation must be traceable.
