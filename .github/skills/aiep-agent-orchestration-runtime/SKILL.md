---
name: aiep-agent-orchestration-runtime
description: 'Deterministic orchestration runtime contract for routing, fallback, memory, verification, policy gates, and token-aware execution in AIEP.'
argument-hint: 'Provide task domain, risk, budget tiers, and required quality outcome.'
user-invocable: true
---
# AIEP Agent Orchestration Runtime

## Purpose
Operationalize deterministic orchestration so requests are routed accurately with verifiable quality and efficient token usage.

## Runtime Modules
- Capability registry: `src/orchestration/default-capability-registry.js`
- Router/scoring/fallback: `src/orchestration/router.js`
- Policy/risk gating: `src/orchestration/policy-engine.js`
- Task decomposition: `src/orchestration/planner.js`
- Memory layers: `src/orchestration/memory-store.js`
- Verification gate: `src/orchestration/verifier.js`
- Tracing: `src/orchestration/tracer.js`
- Learning feedback loop: `src/orchestration/learning-loop.js`
- Quality dashboard: `src/orchestration/metrics.js`

## Deterministic Flow
1. Classify risk and enforce policy guard.
2. Build atomic plan.
3. Route via deterministic scoring.
4. Persist session/pattern memory.
5. Execute specialist workflow.
6. Run verification gate.
7. Record outcome in learning loop.
8. Emit trace summary and quality metrics.

## Required Inputs
- `domain`
- `risk`
- `tokenBudgetTier` (`LOW|MEDIUM|HIGH`)
- `latencyBudgetTier` (`LOW|MEDIUM|HIGH`)
- verification evidence (`testsPassed`, `securityChecksPassed`, `contractChecksPassed`, `errorHandlingValidated`, `qualityScore`)

## Required Outputs
- Selected specialist and fallback chain
- Score components by candidate
- Verification gate result
- Trace summary (policy, planning, routing, verification checkpoints)
- Learning snapshot for future routing

## Guardrails
- High/critical risk requires explicit confirmation.
- Repository memory writes require explicit approval.
- Never bypass governed path restrictions.
