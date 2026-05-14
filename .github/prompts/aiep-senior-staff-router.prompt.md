---
name: "AIEP Senior Staff Router"
description: "Intelligently route a task to the correct senior-staff specialist (frontend, backend, UI/UX, SRE, AI/LLM, architect, or DevOps) with compound task detection and deterministic scoring."
argument-hint: "Describe the task goal, impacted area, and expected outcome."
agent: "AIEP Senior Staff Router Agent"
---
Run this task with the deterministic router agent. The router will classify the task, detect compound multi-domain tasks, and route to the optimal specialist.

## Required Execution Controls
- Enforce `.github/instructions/aiep-skill-orchestration.instructions.md`.
- For compound tasks, apply `.github/skills/aiep-compound-task-decomposition/SKILL.md`.

## Required Result
- Task classification (single-domain or compound, detected domains, confidence)
- Selected specialist and routing confidence score
- Candidate score snapshot (domain, quality, learning, cost, latency components)
- Budget tier used (token + latency)
- Fallback chain
- Compound routing details (if applicable): sub-routes, unique agents needed, recommended strategy
- Routing rationale with confidence percentage
- Work completed
- Validation performed
- Verification gate result (blocking vs advisory findings)
- Traceability summary (classification, policy, planning, routing, verification checkpoints)
- Open risks or follow-ups
