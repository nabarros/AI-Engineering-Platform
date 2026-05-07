---
ai_priority: tier-3
context_type: domain-model
load_when: data-modeling, schema-design, understanding-entities
token_budget: low
owner: platform-team
last_reviewed: 2026-05-07
---

# Domain Model

Core entities, their relationships, and ownership.

---

## Entity Relationship Overview

```
Organization
  │
  ├──< User (belongs to one org; has roles)
  │
  ├──< Prompt (owned by org)
  │         └──< PromptVersion (versions of a prompt)
  │                   └──< EvalScore (quality scores per version)
  │
  ├──< Workflow (agent workflow definition)
  │         └──< WorkflowStep (nodes in the DAG)
  │         └──< WorkflowExecution (runtime instance)
  │                   └──< StepExecution (per-step result)
  │
  ├──< Document (indexed for vector search)
  │         └──< DocumentChunk (Weaviate vector record)
  │
  ├──< ModelConfig (org-level model tier quotas)
  │
  └──< UsageRecord (per-request audit + billing data)
```

---

## Core Entities

### Organization
- Primary grouping unit; all resources belong to an org
- Service owner: auth-service (identity), prompt-service (quota)
- Key fields: `id (UUID)`, `name`, `plan (free|pro|enterprise)`, `quota_limits (JSON)`

### User
- Belongs to exactly one organization
- Roles: `viewer | editor | admin`
- Service owner: auth-service
- Key fields: `id`, `org_id`, `email`, `roles[]`, `last_login_at`

### Prompt
- A named, versioned LLM prompt template
- Belongs to an organization; visible to all org members
- Service owner: prompt-service
- Key fields: `id`, `org_id`, `name`, `model_tier`, `status (draft|active|archived)`, `tags[]`
- Constraint: `name` is unique within an organization

### PromptVersion
- A specific version of a prompt's content
- Only one version per prompt can be `active` at a time
- Key fields: `id`, `prompt_id`, `version_number (sequential)`, `content (template string)`, `variables_schema (JSON Schema)`, `status`
- Immutable once created (edit creates a new version)

### Workflow
- A DAG of steps executed by the agent runtime
- Belongs to an organization
- Service owner: agent-runtime
- Key fields: `id`, `org_id`, `name`, `definition (JSON DAG)`, `status (draft|active|archived)`

### WorkflowExecution
- A runtime instance of a workflow execution
- Key fields: `id`, `workflow_id`, `initiator_user_id`, `status (pending|running|completed|failed)`, `context (JSON)`, `started_at`, `completed_at`
- Stored in Redis (hot path) and PostgreSQL (audit)

### Document
- A document indexed in the vector store for RAG
- Belongs to an organization
- Service owner: vector-store-service
- Key fields: `id`, `org_id`, `title`, `source_url`, `content_hash`, `status (indexing|indexed|failed)`

### UsageRecord
- Immutable audit record of each LLM request
- Service owner: audit-service (written via Kafka)
- Key fields: `id`, `org_id`, `user_id`, `prompt_id`, `model`, `input_tokens`, `output_tokens`, `cost_usd`, `latency_ms`, `provider`, `timestamp`
- Append-only; never updated or deleted

---

## Soft Delete Convention

All mutable entities use soft delete (`deleted_at TIMESTAMPTZ`):
- `Prompt`, `PromptVersion`, `Workflow`, `Document`
- All queries must filter `WHERE deleted_at IS NULL`

Exceptions (never deleted):
- `UsageRecord` — immutable audit record
- `WorkflowExecution` — historical record

---

## Cross-Service Entity Access

| Entity | Owner Service | How Others Access |
|---|---|---|
| Organization / User | auth-service | Token payload (no direct DB access) |
| Prompt | prompt-service | REST API `GET /internal/prompts/:id` |
| Workflow | agent-runtime | Internal DB (service owns it) |
| Document chunks | vector-store-service | REST API `POST /v1/search` |
| UsageRecord | audit-service | Kafka consumer writes; reports API reads |

---

## Related Files

- `docs/DATABASE_CONVENTIONS.md` — schema naming, column standards
- `.ai/architecture/system-design.md` — data model details per service
- `docs/DOMAIN_GLOSSARY.md` — full terminology definitions
