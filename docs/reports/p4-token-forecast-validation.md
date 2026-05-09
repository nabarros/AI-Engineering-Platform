# P4 Token Forecast Validation Report

- generatedAt: 2026-05-09T00:00:00.000Z
- status: pass
- sampleCount: 6
- meanAbsolutePercentageError: 0.019
- coverageWithinErrorBound: 1

## Thresholds

- maxMeanAbsolutePercentageError: 0.2
- minCoverageWithinErrorBound: 0.85

## Validation Samples

| Step Type | Risk | Tier | Actual | Predicted | Error Bound | Within Bound |
|---|---|---|---:|---:|---:|---|
| routing | LOW | LOW | 550 | 540 | 60 | yes |
| routing | MEDIUM | MEDIUM | 840 | 850 | 60 | yes |
| execution | MEDIUM | MEDIUM | 2050 | 2025 | 75 | yes |
| execution | LOW | LOW | 1210 | 1180 | 60 | yes |
| verification | LOW | LOW | 710 | 700 | 60 | yes |
| verification | MEDIUM | MEDIUM | 910 | 880 | 60 | yes |
