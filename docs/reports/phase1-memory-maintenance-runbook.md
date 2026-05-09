# Phase 1 Memory Maintenance Runbook

## Purpose

Keep indexed memory fresh by pruning expired indexed metadata and reindexing the remaining entries on a predictable cadence.

## Cadence

- Run daily for active repositories.
- Run again after any bulk metadata import or backfill.
- Use the same cadence for pre-release validation when search behavior changes.

## Command Usage

Run the maintenance job with the built-in sample state:

```bash
node scripts/run-memory-maintenance.js
```

Run against an explicit JSON payload from a file or inline JSON string:

```bash
node scripts/run-memory-maintenance.js ./path/to/memory-maintenance.json
node scripts/run-memory-maintenance.js '{"taskMetadata":[],"repositoryMetadata":[]}'
```

## Expected Output

The command prints summary JSON with:

- `inputSource`
- `pruned`
- `reindexed`
- `remaining`

## Operational Steps

1. Load the current indexed state.
2. Run `pruneExpiredIndexedMetadata()` to remove stale task and repository metadata.
3. Run `reindexMetadata()` to restore deterministic ordering.
4. Review the JSON summary for removed counts and remaining counts.

## Validation Criteria

- Expired entries are removed before reindexing.
- Remaining counts match the post-prune indexed state.
- Reindexing is deterministic for equal timestamps.

## Evidence

- Maintenance helper: [src/orchestration/memory-maintenance.js](../src/orchestration/memory-maintenance.js)
- Maintenance script: [scripts/run-memory-maintenance.js](../scripts/run-memory-maintenance.js)
- Regression tests: [tests/orchestration/maintenance-and-shadow.test.js](../tests/orchestration/maintenance-and-shadow.test.js)