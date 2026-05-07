---
name: aiep-senior-staff-sre
description: 'Senior staff SRE workflow for AI-Engineering-Platform: reliability analysis, observability checks, incident-readiness validation, and safe operational execution.'
argument-hint: 'Describe reliability objective, affected service(s), SLI/SLO concern, and validation target.'
user-invocable: true
---
# AIEP Senior Staff SRE

## When to Use
- Investigating reliability or performance regressions.
- Validating operational readiness before rollout.
- Running production-safety checks and incident-focused diagnostics.

## Procedure
1. Classify risk and blast radius.
2. Load required governance and operations docs:
   - `docs/OBSERVABILITY.md`
   - `docs/PERFORMANCE_GUIDELINES.md`
   - `docs/DEPLOYMENT_GUIDE.md`
   - `.ai/memory/current-architecture.md`
   - `.ai/memory/known-issues.md`
3. Define SLI/SLO impact and hypotheses.
4. Run deterministic read/execute checks only.
5. Capture evidence, failure modes, and rollback considerations.
6. Escalate before HIGH/CRITICAL operational actions.

## Constraints
- Read/execute-only workflow; no code editing in this skill.
- No unsupervised production deployments.
- Never expose sensitive internals in outputs.

## Output Requirements
- Risk and blast radius.
- SLI/SLO impact summary.
- Checks executed and key findings.
- Rollback/readiness assessment.
- Open risks and runbook follow-ups.
