# Phase 1 Relationship Shadow Report

This report summarizes the current 14-day shadow tracker output model for automatic relationship inference.

## Summary

- Window: 14 days.
- Sample count: 8.
- False-link count: 2.
- False-link rate: 0.25.

## Top Active Agents Covered

The highest-coverage specialist agents in the current shadow sample are:

1. AIEP Senior Staff Backend Engineer
2. AIEP Senior Staff Frontend Engineer
3. AIEP Code Reviewer

## Mismatch Breakdown

- specialist_mismatch: 2
- selection_missing: 0
- inference_missing: 0

## Evidence

- Shadow report generator: [scripts/generate-relationship-shadow-report.js](../scripts/generate-relationship-shadow-report.js)
- Shadow report helper: [src/orchestration/relationship-inference.js](../src/orchestration/relationship-inference.js)
- Shadow summary tests: [tests/orchestration/maintenance-and-shadow.test.js](../tests/orchestration/maintenance-and-shadow.test.js)

## Notes

The shadow tracker remains in measurement mode. The measured false-link rate is acceptable for continued shadow rollout, and the report format is stable enough to generate from tracker samples without manual normalization.