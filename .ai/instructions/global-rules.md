---
ai_priority: critical
load_order: 2
applies_to: all
context_type: rules
owner: platform-architecture
last_reviewed: 2026-05-07
token_budget: medium
---

# Global Rules

## Purpose

Non-negotiable rules that govern all activity in this workspace — for AI agents, human developers, and automated pipelines. These rules sit at the intersection of Levels 2–4 of the instruction hierarchy.

## When to Load

Load after `instruction-hierarchy.md` and before any task-specific context. These rules are always active.

---

## 1. Code Authorship Rules

- AI-generated code must be reviewed by a human before merging to `main` or `release/*` branches
- AI agents must not commit directly to protected branches
- All generated code must pass the same CI gates as human-authored code
- When AI generates security-sensitive code (auth, crypto, data access), a security review is mandatory
- Generated code must include a `# generated-by: [tool]` comment in the file header only when the code was generated wholesale (not for small completions)

## 2. File Modification Boundaries

- AI agents MUST NOT modify:
  - `.ai/instructions/instruction-hierarchy.md`
  - `.ai/instructions/global-rules.md`
  - `docs/SECURITY_RULES.md`
  - `docs/AI_AGENT_RULES.md`
  - Any file in `.ai/security/`
  - CI/CD pipeline definitions in `.github/workflows/`
  - Infrastructure-as-code in `infra/` (read access only)
- AI agents MAY modify with human confirmation:
  - `docs/ARCHITECTURE.md`
  - `.ai/memory/` files
  - `docs/DECISION_LOG.md`
- AI agents MAY freely modify:
  - Application source code in `src/`
  - Test files in `tests/`
  - Documentation in `docs/` (except governed files above)
  - Skill files in `.ai/skills/` (to update patterns)

## 3. Dependency Rules

- No new runtime dependency may be added without:
  1. Checking if existing dependencies cover the use case
  2. Reviewing the dependency's security record (npm audit, Snyk)
  3. Documenting the decision in `docs/DECISION_LOG.md`
- No dependencies with known critical CVEs may be introduced
- All dependencies must be pinned to exact versions in production configs
- Development dependencies may use semver ranges

## 4. Secret and Credential Handling

- **Zero tolerance for hardcoded secrets.** Any string matching patterns for API keys, passwords, tokens, or private keys must be flagged and blocked immediately
- Secrets must be referenced via environment variables only: `process.env.SECRET_NAME`
- Secret names must be documented in `.env.example` with a placeholder value
- Rotation procedures must exist for all secrets — document in `.ai/security/threat-model.md`
- AI agents must NEVER suggest storing secrets in code, comments, logs, or version control

## 5. Error Handling Rules

- Every async operation must handle errors explicitly — no unhandled promise rejections
- Errors must propagate with sufficient context for debugging
- Error messages in API responses must NEVER expose stack traces, internal paths, or system details
- See `docs/ERROR_HANDLING.md` for full patterns

## 6. Testing Rules

- New code must include tests before a PR can be merged
- Bug fixes must include a regression test covering the exact failure scenario
- Tests must be deterministic — no flaky tests accepted
- Mocked dependencies must closely reflect production behavior
- See `docs/TESTING_STRATEGY.md` for detailed requirements

## 7. API Contract Rules

- All API changes must be backwards-compatible unless a version bump is issued
- Breaking changes require a major version bump and a migration guide
- New endpoints must be documented in OpenAPI/AsyncAPI spec before implementation
- See `docs/API_CONVENTIONS.md` for full conventions

## 8. Data Handling Rules

- No PII may be logged at any log level
- Database queries must use parameterized inputs — no string interpolation in SQL
- Data access must go through defined repository/service layers, not direct DB connections from handlers
- Schema migrations are irreversible — require human review and a rollback plan
- See `docs/DATABASE_CONVENTIONS.md` for full conventions

## 9. Performance Rules

- No synchronous blocking operations on the main thread/event loop
- All external service calls must have timeouts defined
- Cache invalidation strategies must be defined before implementing caching
- See `docs/PERFORMANCE_GUIDELINES.md` for budgets and benchmarks

## 10. Observability Rules

- All new services must emit structured logs (JSON format)
- Distributed traces must propagate trace context headers
- All business-critical operations must emit metrics
- Alerts must be defined for new SLO-relevant operations
- See `docs/OBSERVABILITY.md` for instrumentation standards

## 11. Communication and Documentation Rules

- Architectural decisions must be recorded as ADRs in `.ai/templates/adr.md` format
- Breaking changes must be documented in `CHANGELOG.md`
- Public API documentation must be updated in the same PR as the API change

## 12. AI Hallucination Prevention

- If an AI agent is uncertain about a fact (library API, system behavior), it must:
  1. Say so explicitly
  2. Propose searching for verification before proceeding
  3. Not fabricate plausible-sounding but unverified details
- All AI-generated architecture or design decisions must reference their basis in existing documentation

---

## Enforcement Matrix

| Rule Category | Automated | Human Review | Blocking |
|---|---|---|---|
| Security | Yes (SAST, secret scanning) | Yes | Yes |
| Agent boundaries | Yes (pre-commit hooks) | Yes | Yes |
| Dependencies | Yes (audit gates) | Yes | Yes |
| Secrets | Yes (secret scanning) | Yes | Yes |
| Error handling | Partial (linting) | Yes | Yes |
| Testing | Yes (coverage gates) | Yes | Yes |
| API contracts | Yes (spec validation) | Yes | Yes |
| Performance | Partial (benchmarks) | Yes | No (warn) |
| Observability | Partial (lint rules) | Yes | No (warn) |

---

## Maintenance

- Review every 60 days or after a production incident
- Ownership: Platform Architecture Team + Security Team
