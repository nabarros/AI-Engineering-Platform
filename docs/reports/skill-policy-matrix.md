# Skill Policy Matrix (Priority 2)

## Purpose

This matrix compiles skill policy by role, domain, and risk so runtime skill resolution is deterministic and deny-by-default.

## Sources

- Runtime compiler: `src/orchestration/skill-policy-matrix.js`
- Machine-readable config: `data/skill-policy-matrix.json`
- Schema v2: `data/skill-manifest-schema.v2.json`

## Policy Rules

- Resolution key: `agentId + domain + risk`.
- Fallback order: exact match, general domain same risk, exact domain MEDIUM risk, general domain MEDIUM risk.
- Deny list is explicit and takes precedence over allow list.
- Exception grants require expiry and are bounded by max TTL.
- High and critical risk rows add `security` and `review` by default.

## Compatibility Notes

- Legacy broad allowlists are no longer used for runtime authorization decisions.
- `MINIMUM_SKILL_MANIFESTS` remains exported for compatibility/readability only.
- Runtime enforcement uses compiled subsets from `resolveCompiledSkillPolicy`.

## Governance Checklist

- [x] Role/domain/risk policy matrix compiled
- [x] Machine-readable config published
- [x] Deny and expiry fields included in schema v2
- [x] Deterministic resolution cache enabled
- [x] Pre-execution dry-run denial messages enabled
