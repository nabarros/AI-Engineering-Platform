# Phase 2 Skill Determinism Runbook

## Purpose

Operational runbook for skill-subset determinism controls in staging and production, including policy-violation alert handling and expiry enforcement for elevated grants.

## Alert Rules

- Source of truth: `data/subset-policy-alert-rules.json`
- Alert name: `subset-policy-violation`
- Trigger: any `SKILL_POLICY_BLOCKED` orchestration result with denied skills or blocked reason codes
- Environments: staging and production only

| Environment | Severity | Page | Route |
|---|---|---|---|
| staging | high | yes | agent-governance-oncall |
| production | critical | yes | agent-governance-oncall |

## On-Call Response Section

### Triage (first 5 minutes)

1. Confirm alert payload includes `requestId`, `selectedAgent`, and `blockedReasonCodes`.
2. Confirm environment is staging or production.
3. Check whether the denial was expected for policy hardening or indicates allowlist drift.

### Containment

1. If this is production and volume spikes, temporarily route affected task class to deterministic fallback specialist while policy is reviewed.
2. Do not disable deny-by-default globally.
3. Capture denied skills and agent identity in incident notes.

### Remediation

1. If deny is valid, update caller task planning to request an allowlisted specialist.
2. If deny is invalid, submit policy update in compiled matrix with tests.
3. If temporary elevation is required, create a time-bound exception grant with approver and reason.

### Verification and Closure

1. Re-run targeted workflow in staging and verify no unexpected subset violation alerts.
2. Confirm closure log updates for any expired temporary grants.
3. Document root cause and follow-up actions in the gate evidence package.

## Expiry Enforcement Job

Run the standard expiry enforcement job:

```bash
npm run job:enforce-skill-exception-expiry
```

Custom input and output paths:

```bash
node scripts/run-skill-exception-expiry-enforcement.js ./path/to/expiry-input.json ./path/to/closure-log.json
```

Expected closure log artifact:

- `data/skill-exception-closure-log.json`

## Prompt Audit and Token Impact Artifacts

Generate the required P2 artifacts:

```bash
npm run audit:top-prompts
npm run report:subset-token-impact
```

Expected outputs:

- `data/prompt-skill-audit-top25.json`
- `docs/prompt-skill-audit-top25.md`
- `data/subset-token-impact-report.json`
