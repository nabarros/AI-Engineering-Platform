---
name: aiep-context-bootstrap
description: 'Bootstraps AI-Engineering-Platform task context using mandatory load order and targeted skill/doc selection. Use at the start of any non-trivial task to reduce hallucinations and enforce governance.'
argument-hint: 'Task goal and likely affected area (api, frontend, database, testing, security, refactor, migration, performance, ai-llm, architecture, devops, sre/reliability).'
user-invocable: true
---
# AIEP Context Bootstrap

## When to Use
- Starting any non-trivial coding task in this repository.
- Unsure which context files to load.
- Need strict, repeatable context loading before implementation.

## Procedure
1. Load mandatory files in this order:
   - `.ai/instructions/instruction-hierarchy.md`
   - `.ai/instructions/global-rules.md`
   - `.ai/instructions/ai-agent-operating-rules.md`
   - `.ai/memory/current-architecture.md`
   - `.ai/memory/active-work.md`
   - `.ai/memory/known-issues.md`
2. Classify task domain and add only relevant skill files:
   - API: `.ai/skills/api-design.md`
   - Frontend: `.ai/skills/react-patterns.md`
   - Database: `.ai/skills/database-patterns.md`
   - AI/LLM: `.ai/skills/llm-engineering.md`
   - Architecture: `.ai/architecture/system-design.md`
   - DevOps: `docs/DEPLOYMENT_GUIDE.md`
   - SRE/Reliability: `docs/OBSERVABILITY.md`, `docs/PERFORMANCE_GUIDELINES.md`
   - Testing: `.ai/skills/testing-jest.md`
   - Debugging: `.ai/skills/debugging-node.md`
   - Auth: `.ai/skills/auth-patterns.md`
   - Refactoring: `.ai/skills/refactoring-rules.md`
   - Migration: `.ai/skills/migration-strategy.md`
   - Performance: `.ai/skills/performance-optimization.md`
3. Add domain docs only when needed:
   - `docs/API_CONVENTIONS.md`
   - `docs/ARCHITECTURE.md`
   - `docs/AGENT_ORCHESTRATION.md`
   - `docs/RETRIEVAL_STRATEGY.md`
   - `docs/PROMPT_ENGINEERING_GUIDE.md`
   - `docs/DEPLOYMENT_GUIDE.md`
   - `docs/OBSERVABILITY.md`
   - `docs/SECURITY_RULES.md`
   - `docs/TESTING_STRATEGY.md`
4. Produce a compact execution checklist with risk level and validation gates.

## Output Requirements
- Ordered context list used.
- Risk classification (LOW, MEDIUM, HIGH, CRITICAL).
- Atomic execution plan.
- Required human confirmations.
