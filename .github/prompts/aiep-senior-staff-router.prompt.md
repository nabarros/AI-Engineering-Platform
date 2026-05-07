---
name: "AIEP Senior Staff Router"
description: "Route a task to the correct senior-staff agent (frontend, backend, UI/UX, or SRE) and execute with that specialist workflow."
argument-hint: "Describe the task goal, impacted area, and expected outcome."
agent: "AIEP Senior Staff Router Agent"
---
Run this task with the deterministic router agent and enforce single-specialist delegation.

## Required Execution Controls
- Enforce `.github/instructions/aiep-skill-orchestration.instructions.md`.

## Required Result
- Selected specialist
- Routing rationale
- Work completed
- Validation performed
- Open risks or follow-ups
