---
description: "Shared skill orchestration for AIEP agents and prompts to enforce deterministic use of context bootstrap, role skills, implementation safety, PR readiness, and memory sync."
applyTo: ".github/agents/**,.github/prompts/**"
---

# AIEP Skill Orchestration

## Purpose
Provide one canonical skill choreography for all AIEP custom agents and prompts, avoiding duplicated guidance drift.

## Mandatory Skill Sequence
1. For non-trivial tasks, run context bootstrap using `.github/skills/aiep-context-bootstrap/SKILL.md`.
2. Apply role skill when a senior-staff specialist is selected:
   - Frontend -> `.github/skills/aiep-senior-staff-frontend/SKILL.md`
   - Backend -> `.github/skills/aiep-senior-staff-backend/SKILL.md`
   - UI/UX -> `.github/skills/aiep-senior-staff-ui-ux/SKILL.md`
   - SRE -> `.github/skills/aiep-senior-staff-sre/SKILL.md`
3. For implementation or refactor work, apply `.github/skills/aiep-safe-implementation/SKILL.md`.
4. For review-first and pre-PR validation, apply `.github/skills/aiep-pr-readiness/SKILL.md`.
5. For state-changing outcomes, evaluate memory impact via `.github/skills/aiep-memory-sync/SKILL.md`.

## Memory Write Guardrail
- Never write `.ai/memory/**` without explicit human confirmation.

## Scope Rule
- Keep only a short reference to this file in agents/prompts.
- Do not duplicate full orchestration logic across multiple agent files.