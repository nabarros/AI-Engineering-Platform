# Phase 0 Initial Evidence Set (G1-G3)

## Context

- Date: 2026-05-09
- Scope: Phase 0 focused completion deltas for O1, O2, O3, O4, and O5
- Validation command: npm test

Note: The roadmap wording references top 10 agents. Current active default capability set contains 7 agents, and evidence below covers all active default agents.

## G1 Contract Integrity Gate

### Evidence

- Orchestrator lifecycle and contract updates:
  - src/orchestration/orchestrator.js
  - src/orchestration/runtime-adapter.js
  - src/orchestration/index.js
- Capability metadata schema baseline (existing v1, validated via orchestrator flows):
  - src/orchestration/capability-registry.js
  - src/orchestration/default-capability-registry.js
- Tests:
  - tests/orchestration/orchestrator.test.js
  - tests/orchestration/router.test.js

### Outcome

- Contract behavior remains deterministic.
- New response fields are present for fallback selection and oriented context.

## G2 Relationship Safety Gate

### Evidence

- Deterministic fallback selection implementation:
  - src/orchestration/orchestrator.js
- Trace event for fallback selection:
  - relationship.fallback.selected in src/orchestration/orchestrator.js
- Tests:
  - tests/orchestration/orchestrator.test.js (verification failure includes fallbackSelection and recoveryPlan)

### Outcome

- Verification failure path now selects first fallback from fallbackChain deterministically.
- Fallback selection is explicit even when no fallback is available.

## G3 Skill Isolation Gate

### Evidence

- Minimum skill manifests and deny-by-default resolver:
  - src/orchestration/skill-manifests.js
- Runtime policy enforcement:
  - src/orchestration/orchestrator.js
- Tests:
  - tests/orchestration/skill-manifests.test.js
  - tests/orchestration/orchestrator.test.js (SKILL_POLICY_BLOCKED path)

### Outcome

- Skill subset policy is enforced post-route selection.
- Requests are blocked with SKILL_POLICY_BLOCKED when required skills exceed agent allowlist.

## Additional Phase 0 Evidence (O4/O5)

- Memory index baseline and oriented retrieval:
  - src/orchestration/memory-store.js
  - src/orchestration/retrieval-strategy.js
  - tests/orchestration/memory-store.test.js
- Model-tier routing policy with risk overrides:
  - src/orchestration/router.js
  - tests/orchestration/router.test.js

## Validation Summary

- Command: npm test
- Result: pass (30 tests passed)
