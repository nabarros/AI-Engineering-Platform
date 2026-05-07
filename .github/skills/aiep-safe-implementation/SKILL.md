---
name: aiep-safe-implementation
description: 'Implements features and fixes in AI-Engineering-Platform with explicit risk checks, architecture constraints, and mandatory tests. Use for coding tasks after context bootstrap.'
argument-hint: 'Describe desired behavior, affected modules, and expected tests.'
user-invocable: true
---
# AIEP Safe Implementation

## When to Use
- Implementing a feature, bug fix, or refactor.
- Need consistent execution protocol aligned with repository governance.

## Procedure
1. State task type and risk level.
2. Decompose work into atomic, reversible steps.
3. For each step:
   - Verify file boundary and architecture constraints.
   - Implement minimal code changes.
   - Add or update tests for new behavior.
   - Run targeted validation commands.
4. Perform self-review loop:
   - Security compliance
   - Architecture compliance
   - Error handling and logging quality
   - Test adequacy and determinism
5. Evaluate `.ai/memory/` impact and apply `aiep-memory-sync` workflow when needed.
6. Summarize outcomes and residual risks.

## Do Not
- Modify `.ai/instructions/**`, `.github/workflows/**`, or `infra/**`.
- Add secrets, credentials, or unsafe SQL patterns.
- Skip tests for changed behavior.

## Output Requirements
- Risk level and assumptions.
- Files changed and why.
- Test/validation commands executed and results.
- Memory sync status (updated, proposed, or not required).
- Residual risks and next steps.
