---
description: "Use when working in AI-Engineering-Platform to align Copilot custom agents/skills/prompts with the .ai governance, memory, and domain skill system."
applyTo: "**"
---
# AIEP AI Bridge Instructions

## Purpose
Ensure workspace customizations in `.github/` always execute in alignment with governance and domain knowledge in `.ai/`.

## Source of Truth
- Governance and operating rules live in `.ai/instructions/`.
- Current state and known pitfalls live in `.ai/memory/`.
- Domain implementation patterns live in `.ai/skills/`.
- Workspace Copilot UX assets live in `.github/agents/`, `.github/skills/`, and `.github/prompts/`.

## Mandatory Context Sequence
For non-trivial tasks, load this order before implementation:
1. `.ai/instructions/instruction-hierarchy.md`
2. `.ai/instructions/global-rules.md`
3. `.ai/instructions/ai-agent-operating-rules.md`
4. `.ai/memory/current-architecture.md`
5. `.ai/memory/active-work.md`
6. `.ai/memory/known-issues.md`
7. Relevant files from `.ai/skills/` and `docs/`

## Relationship Mapping
- `.github/instructions/aiep-skill-orchestration.instructions.md` -> centralizes deterministic skill choreography across router, specialists, and prompts.
- `.github/skills/aiep-context-bootstrap/` -> enforces context sequencing from `.ai/instructions/` + `.ai/memory/`.
- `.github/skills/aiep-safe-implementation/` -> executes implementation protocol defined by `.ai` governance.
- `.github/skills/aiep-pr-readiness/` -> validates outcomes against `docs/` and `.ai` constraints.
- `.github/skills/aiep-memory-sync/` -> handles post-task synchronization with `.ai/memory/`.
- `.github/prompts/aiep-senior-staff-router.prompt.md` -> routes work to role-specific `.github/agents/`.
- `.github/agents/aiep-senior-staff-router.agent.md` -> deterministic single-specialist delegation.
- `.github/hooks/aiep-guardrails.json` -> deterministic runtime enforcement for restricted paths and memory-write confirmation.
- Role agents (frontend/backend/ui-ux/sre) -> apply task execution while respecting `.ai` instruction hierarchy.

## Memory Lifecycle Protocol
For tasks that change system state, always evaluate memory updates at completion:
- `current-architecture.md` when components/services/config baselines changed
- `active-work.md` when task status, branch status, or rollout status changed
- `recent-decisions.md` when a notable technical decision was made
- `known-issues.md` when issues were discovered, mitigated, or resolved
- `technical-debt.md` when shortcuts or deferred cleanup were introduced

Memory writes require explicit human confirmation before modifying `.ai/memory/**`.

## Domain Skill Selection
Select `.ai/skills/` by task domain:
- API -> `.ai/skills/api-design.md`
- Frontend/UI -> `.ai/skills/react-patterns.md`
- Database -> `.ai/skills/database-patterns.md`
- Auth -> `.ai/skills/auth-patterns.md`
- Refactor -> `.ai/skills/refactoring-rules.md`
- Testing -> `.ai/skills/testing-jest.md`
- Debugging -> `.ai/skills/debugging-node.md`
- Migration -> `.ai/skills/migration-strategy.md`
- Performance -> `.ai/skills/performance-optimization.md`

## Safety and Boundary Rules
- Never modify `.ai/instructions/**`, `.github/workflows/**`, or `infra/**`.
- Require explicit human confirmation for HIGH/CRITICAL risk operations.
- Include tests for all changed behavior and validate before completion.
