# Phase 1 G4 and G5 Readiness Review

## Status

- G4: GO
- G5: GO

These gates are ready to approve once the evidence package is accepted.

## G4 Memory Precision Gate

### Entry Criteria

- Retrieval pipelines are enabled for the target task classes.
- Memory maintenance and shadow reporting helpers are available for validation.

### Exit Criteria

- Precision and latency targets are met for oriented task search.
- Stale indexed metadata is pruned before ranking.
- Repository graph-aware ranking improves ordering for rich records.

### Evidence

- Memory maintenance helper: [src/orchestration/memory-maintenance.js](../src/orchestration/memory-maintenance.js)
- Graph-aware ranking: [src/orchestration/memory-store.js](../src/orchestration/memory-store.js)
- Maintenance and ranking tests: [tests/orchestration/maintenance-and-shadow.test.js](../tests/orchestration/maintenance-and-shadow.test.js)
- Baseline memory tests: [tests/orchestration/memory-store.test.js](../tests/orchestration/memory-store.test.js)

## G5 Cost-Quality Balance Gate

### Entry Criteria

- Token policy and model routing are active.
- Verification paths can measure fallback and quality retention.

### Exit Criteria

- Target token savings are achieved without degrading verification pass rates.
- Weekly scorecard reporting remains deterministic and reproducible.
- Shadow and maintenance reporting stay scriptable for evidence packaging.

### Evidence

- Shadow report helper: [src/orchestration/relationship-inference.js](../src/orchestration/relationship-inference.js)
- Shadow report script: [scripts/generate-relationship-shadow-report.js](../scripts/generate-relationship-shadow-report.js)
- Maintenance script: [scripts/run-memory-maintenance.js](../scripts/run-memory-maintenance.js)
- Regression tests: [tests/orchestration/maintenance-and-shadow.test.js](../tests/orchestration/maintenance-and-shadow.test.js)

## Decision

Both gates are in a ready-to-approve state pending evidence package acceptance and reviewer sign-off.