---
description: "Shared skill orchestration for AIEP agents and prompts to enforce deterministic use of context bootstrap, role skills, implementation safety, PR readiness, memory sync, compound task decomposition, and token budget management."
applyTo: ".github/agents/**,.github/prompts/**"
---

# AIEP Skill Orchestration

## Purpose
Provide one canonical skill choreography for all AIEP custom agents and prompts, avoiding duplicated guidance drift.

## Mandatory Skill Sequence
1. For non-trivial tasks, run context bootstrap using `.github/skills/aiep-context-bootstrap/SKILL.md`.
2. For router-led execution, apply runtime contract skill `.github/skills/aiep-agent-orchestration-runtime/SKILL.md` before specialist selection.
3. Apply role skill when a senior-staff specialist is selected:
   - Frontend -> `.github/skills/aiep-senior-staff-frontend/SKILL.md`
   - Backend -> `.github/skills/aiep-senior-staff-backend/SKILL.md`
   - UI/UX -> `.github/skills/aiep-senior-staff-ui-ux/SKILL.md`
   - SRE -> `.github/skills/aiep-senior-staff-sre/SKILL.md`
   - AI/LLM -> `.github/skills/aiep-senior-staff-ai-llm/SKILL.md`
   - Architect -> `.github/skills/aiep-senior-staff-architect/SKILL.md`
   - DevOps -> `.github/skills/aiep-senior-staff-devops/SKILL.md`
4. For compound tasks spanning 2+ domains, apply `.github/skills/aiep-compound-task-decomposition/SKILL.md` before specialist dispatch.
5. For implementation or refactor work, apply `.github/skills/aiep-safe-implementation/SKILL.md`.
6. For review-first and pre-PR validation, apply `.github/skills/aiep-pr-readiness/SKILL.md`.
7. For state-changing outcomes, evaluate memory impact via `.github/skills/aiep-memory-sync/SKILL.md`.

## Compound Task Protocol

When a task description spans multiple specialist domains:

1. **Detection**: Identify compound tasks by the presence of two or more distinct domain concerns (e.g., "add an API endpoint and update the frontend to call it" spans Backend + Frontend).
2. **Decomposition**: Apply `.github/skills/aiep-compound-task-decomposition/SKILL.md` to produce a dependency-ordered sub-task list with domain assignments.
3. **Delegation**: Route each sub-task to the appropriate specialist skill. Sub-tasks with no cross-dependency may execute in parallel.
4. **Integration**: After all sub-tasks complete, perform a cross-domain integration check:
   - API contract consistency between producer and consumer.
   - Shared type/schema alignment.
   - End-to-end test coverage across the boundary.
5. **Single Consolidation**: Merge all specialist outputs into one unified result with a combined risk assessment.

## Token Budget Awareness

Before executing any skill, estimate context cost and select the appropriate depth:

| Budget Tier | Max Context Files | Skill Depth | Use When |
|---|---|---|---|
| LOW (~4K tokens) | 3 mandatory governance files only | Procedure summary only | Trivial tasks, single-file edits |
| MEDIUM (~12K tokens) | Governance + 2 domain skills + 1 memory file | Full procedure | Standard features, bug fixes |
| HIGH (~24K tokens) | Full governance + all relevant skills + docs | Full procedure + examples | Cross-cutting changes, migrations, architecture decisions |

Estimation procedure:
1. Classify task complexity: trivial (1 file, <20 lines), standard (2-5 files), complex (6+ files or cross-domain).
2. Map complexity to budget tier.
3. Load only the context files permitted by that tier.
4. If a sub-task requires deeper context than the parent budget allows, escalate the tier for that sub-task only and document the reason.

## Conflict Detection

Before modifying any file that may be under concurrent work:

1. Read `.ai/memory/active-work.md` and extract the list of files and branches currently in progress.
2. If the target file appears in an active work entry owned by a different task or branch:
   - Flag the conflict to the human operator before proceeding.
   - Do not modify the file until the conflict is resolved or the human confirms.
3. If no conflict is found, proceed and register the current task's target files in the output for downstream memory sync.

## Memory Write Guardrail
- Never write `.ai/memory/**` without explicit human confirmation.

## Scope Rule
- Keep only a short reference to this file in agents/prompts.
- Do not duplicate full orchestration logic across multiple agent files.
