# Runtime Skill Resolver Compatibility Notes

## Change Summary

The runtime skill resolver now consumes compiled subsets only via:

- `src/orchestration/skill-policy-matrix.js`
- `resolveCompiledSkillPolicy(...)`
- `resolveSkillManifestV2(...)`

## Backward Compatibility

- `MINIMUM_SKILL_MANIFESTS` is still exported for external readers and tests.
- `resolveAllowedSkillsForAgent(agentId)` still works, and now accepts optional `{ domain, risk }`.
- Existing exception registry interfaces are unchanged.

## Removed Production Path

- Broad skill loading from static per-agent arrays is no longer authoritative for policy enforcement.
- Production flow now enforces domain+risk compiled rows with explicit deny precedence.

## Operational Impact

- Repeated task signatures use deterministic subset cache.
- Skill policy blocks now include actionable preflight denial messages.
