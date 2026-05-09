# P4 Model Tiering Policy

- policyVersion: p4-tiering-policy-v1
- generatedAt: 2026-05-09T15:57:17.436Z
- rows: 72

## Decision Matrix (Sample)

| Step Type | Risk | Confidence Band | Tier |
|---|---|---|---|
| routing | LOW | LOW | HIGH |
| routing | LOW | MEDIUM | LOW |
| routing | LOW | HIGH | LOW |
| routing | MEDIUM | LOW | HIGH |
| routing | MEDIUM | MEDIUM | LOW |
| routing | MEDIUM | HIGH | LOW |
| routing | HIGH | LOW | HIGH |
| routing | HIGH | MEDIUM | HIGH |
| routing | HIGH | HIGH | HIGH |
| routing | CRITICAL | LOW | HIGH |
| routing | CRITICAL | MEDIUM | HIGH |
| routing | CRITICAL | HIGH | HIGH |
| planning | LOW | LOW | HIGH |
| planning | LOW | MEDIUM | MEDIUM |
| planning | LOW | HIGH | LOW |
| planning | MEDIUM | LOW | HIGH |
| planning | MEDIUM | MEDIUM | MEDIUM |
| planning | MEDIUM | HIGH | MEDIUM |
| planning | HIGH | LOW | HIGH |
| planning | HIGH | MEDIUM | HIGH |
| planning | HIGH | HIGH | HIGH |
| planning | CRITICAL | LOW | HIGH |
| planning | CRITICAL | MEDIUM | HIGH |
| planning | CRITICAL | HIGH | HIGH |
| execution | LOW | LOW | HIGH |
| execution | LOW | MEDIUM | MEDIUM |
| execution | LOW | HIGH | LOW |
| execution | MEDIUM | LOW | HIGH |
| execution | MEDIUM | MEDIUM | MEDIUM |
| execution | MEDIUM | HIGH | MEDIUM |

## Notes

- High and critical risk always escalate to HIGH tier.
- Low confidence always escalates to HIGH tier.
- Low-risk and high-confidence paths can use LOW tier.
