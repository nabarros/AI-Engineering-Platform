# Skill Manifest Schema v2 Migration Checklist

## Target

Move all active runtime manifest resolution paths to schema v2 with explicit deny and exception expiry fields.

## Checklist

- [x] Publish schema file at `data/skill-manifest-schema.v2.json`
- [x] Add runtime validator `validateSkillManifestV2`
- [x] Ensure `deny` field is required and checked before allowlist
- [x] Ensure `exception.expiresAtRequired` is required
- [x] Ensure `exception.maxTtlMs` is required and positive
- [x] Validate compiled policy rows in CI tests (`lintCompiledSkillPolicies`)
- [x] Keep legacy export compatibility while removing broad runtime loading

## Notes

- Runtime resolver now uses compiled rows only.
- Existing exception registry remains compatible because grant paths already enforce future `expiresAt`.
