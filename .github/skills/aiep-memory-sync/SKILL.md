---
name: aiep-memory-sync
description: 'Synchronizes .ai/memory after task completion in AI-Engineering-Platform. Use when changes affect architecture, active work, known issues, decisions, or technical debt.'
argument-hint: 'Describe what changed and whether memory updates were approved.'
user-invocable: true
---
# AIEP Memory Sync

## When to Use
- After completing work that changes system state, risks, or project decisions.
- Before finalizing a substantial implementation or refactor.
- When documenting new known issues, mitigations, or technical debt.

## Approval Requirement
- Updating `.ai/memory/**` requires explicit human confirmation per workspace governance.
- If confirmation is missing, produce a proposed memory diff/checklist without writing files.

## Update Mapping
- Architecture changed -> `.ai/memory/current-architecture.md`
- Work status changed -> `.ai/memory/active-work.md`
- Significant decision made -> `.ai/memory/recent-decisions.md`
- Issue found/resolved -> `.ai/memory/known-issues.md`
- Shortcut/deferment taken -> `.ai/memory/technical-debt.md`

## Procedure
1. Summarize task outcomes and classify whether memory-impacting changes occurred.
2. Determine which memory files are affected using the mapping above.
3. Ask for explicit confirmation if file writes are needed.
4. Apply concise updates using existing file style and structure.
5. Report exactly what changed and why.

## Output Requirements
- Memory impact assessment.
- Files to update (or no-update decision).
- Confirmation status.
- Applied updates or proposed patch summary.
