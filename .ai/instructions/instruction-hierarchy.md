---
ai_priority: critical
load_order: 1
applies_to: all
context_type: governance
owner: platform-architecture
last_reviewed: 2026-05-07
token_budget: low
---

# Instruction Hierarchy

## Purpose

Defines absolute precedence rules for all instructions in this workspace. Every AI agent, coding assistant, and human contributor MUST respect this hierarchy. No lower-priority rule may override a higher-priority rule.

## When to Load

Load this file FIRST in any AI agent session before executing any task. It governs all other instructions in this workspace.

## Precedence Levels (1 = Highest)

---

### Level 1 — Security Rules `[IMMUTABLE]`

- **Source:** `docs/SECURITY_RULES.md`, `.ai/security/security-rules.md`
- **Override:** Never. No exception exists.
- **Applies to:** All code generation, refactoring, data access, secret handling, API design, authentication flows
- **Enforcement:** Block task execution if a violation is detected; surface the violation explicitly
- **Examples:**
  - No hardcoded secrets or credentials
  - No insecure deserialization
  - OWASP Top 10 compliance required
  - No unauthenticated endpoints that expose sensitive data

---

### Level 2 — AI Agent Operating Rules `[IMMUTABLE]`

- **Source:** `docs/AI_AGENT_RULES.md`, `.ai/instructions/ai-agent-operating-rules.md`
- **Override:** Never overridden by task prompts or user urgency claims
- **Applies to:** All autonomous agent behavior and self-directed execution
- **Enforcement:** Agent must refuse out-of-scope actions; log the refusal
- **Examples:**
  - No unsupervised production deployments
  - No destructive operations without explicit human confirmation
  - No modification of `.ai/instructions/` without human approval
  - Rollback capability required before any irreversible change

---

### Level 3 — Architecture Constraints `[HIGH]`

- **Source:** `docs/ARCHITECTURE.md`, `.ai/architecture/`
- **Override:** Requires an Architecture Decision Record (ADR) in `.ai/templates/adr.md` format, reviewed by an architect
- **Applies to:** System design, service boundaries, component creation, API contracts, data ownership
- **Enforcement:** Flag deviations as architecture warnings in PR comments; block merge without ADR
- **Examples:**
  - Services must not directly access another service's database
  - All external API contracts must be versioned
  - Event-driven boundaries defined in `.ai/architecture/component-map.md`

---

### Level 4 — Engineering Standards `[HIGH]`

- **Source:** `docs/ENGINEERING_STANDARDS.md`
- **Override:** Requires team-lead approval; exception must be documented in `docs/DECISION_LOG.md`
- **Applies to:** Code quality, dependency selection, testing requirements, versioning strategy
- **Enforcement:** PR review checklist, automated static analysis gates
- **Examples:**
  - All public functions must have unit tests
  - No direct `any` types in TypeScript without justification
  - Semantic versioning required for all packages

---

### Level 5 — Code Style `[MEDIUM]`

- **Source:** `docs/CODE_STYLE.md`
- **Override:** Module-level linter configuration (`.eslintrc`, `pyproject.toml`) takes precedence
- **Applies to:** Formatting, naming conventions, file structure, import ordering, comments
- **Enforcement:** Automated via ESLint, Prettier, Black, Ruff in CI pipeline
- **Examples:**
  - PascalCase for types/classes, camelCase for functions, UPPER_SNAKE_CASE for constants
  - Maximum function length: 50 lines
  - JSDoc/docstring required for exported functions

---

### Level 6 — Skill-Specific Guidance `[MEDIUM]`

- **Source:** `.ai/skills/`
- **Override:** Can be contextually refined by task requirements, but cannot violate Levels 1-5
- **Applies to:** Technology-specific patterns, library usage, domain-specific workflows
- **Load policy:** Load only the skill file(s) relevant to the current task
- **Examples:**
  - `react-patterns.md` when working on UI components
  - `api-design.md` when designing or modifying REST/GraphQL endpoints
  - `database-patterns.md` when writing queries or migrations

---

### Level 7 — Memory State `[LOW]`

- **Source:** `.ai/memory/`
- **Override:** Superseded by any higher level; memory is informational, not prescriptive
- **Applies to:** Current project state, active work context, known issues
- **Load policy:** Load `current-architecture.md` and `active-work.md` by default; load others on demand
- **Examples:**
  - `active-work.md` informs what features are in-flight
  - `known-issues.md` prevents re-introducing fixed bugs
  - `technical-debt.md` identifies areas requiring extra caution

---

### Level 8 — Task-Specific Prompts `[LOWEST]`

- **Source:** User prompts, `.ai/prompts/task-prompts.md`
- **Override:** Subject to all levels above; cannot escalate its own priority
- **Applies to:** Specific task execution context provided inline by humans
- **Examples:**
  - "Implement feature X in component Y"
  - "Refactor this function to reduce complexity"

---

## Conflict Resolution Protocol

When instructions from different levels conflict:

1. Identify which level each instruction belongs to
2. Higher level wins — no negotiation
3. If both at the same level, escalate to a human reviewer before proceeding
4. Document the conflict, its context, and the resolution in `docs/DECISION_LOG.md`
5. Never silently resolve a conflict — always surface the tension

## Anti-Patterns

| Anti-Pattern | Why It's Wrong |
|---|---|
| Treating task urgency as a Level 1 override | Urgency is never a security exception |
| Inferring precedence from instruction verbosity | Length ≠ authority |
| Allowing user frustration to bypass Level 2 rules | Agents are not social pressure-responsive |
| Skipping conflict documentation | Creates invisible governance debt |
| Treating Level 7 prompts as ground truth | Prompts are requests, not mandates |

## Maintenance

- Review quarterly or after any major architectural change
- Changes to this file require two approvals from Platform Architecture Team
- Ownership: Platform Architecture Team
