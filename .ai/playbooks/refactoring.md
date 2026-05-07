---
ai_priority: tier-3
context_type: refactoring-workflow
load_when: refactoring, code-quality, improving-existing-code
token_budget: medium
owner: platform-team
last_reviewed: 2026-05-07
---

# Playbook: Refactoring

Decision tree and execution protocol for safe refactoring.

---

## Should You Refactor?

```
Does the code have tests? ──NO──► Write tests first, then refactor
         │ YES
         ▼
Is the code broken or wrong? ──YES──► Fix the bug first (separate PR), then refactor
         │ NO
         ▼
Does the code violate engineering standards?
  (> 300 lines, cyclomatic > 10, > 4 nesting levels)
         │ YES
         ▼
Is anyone actively working in this file? ──YES──► Coordinate or wait
         │ NO
         ▼
Proceed with refactoring
```

**Refactoring is always a separate PR from feature work.** Never mix refactoring with behavior changes.

---

## Refactoring Types

### 1. Extract Function

Trigger: Function > 50 lines, or a block that has a clear separate name.

```
Steps:
1. Identify the block to extract (mark entry/exit points)
2. Determine inputs (parameters) and outputs (return value)
3. Verify no shared mutable state with surrounding code
4. Create the new function
5. Replace original block with function call
6. Run tests — must all pass
7. Run the linter
```

See `.ai/skills/refactoring-rules.md` Section 2 for code examples.

---

### 2. Split File

Trigger: File > 300 lines, or contains two distinct responsibilities.

```
Steps:
1. Run tests before touching anything
2. Identify the responsibility boundary
3. Create new file with extracted content
4. Add re-export in original file (backward compat for one commit)
5. Run tests — must all pass
6. Update all import sites to use new file
7. Remove re-export from original file
8. Run tests — must all pass
9. Commit with message: "refactor: split <OldFile> into <A> and <B>"
```

---

### 3. Rename Symbol

Trigger: Symbol name no longer reflects its purpose.

```
Steps:
1. Use VS Code Rename (F2) or language server — not find/replace
2. Review diff: confirm all references updated, including tests, docs, JSDoc
3. If symbol is exported from a shared package:
   a. Add deprecated alias pointing to new name
   b. Deploy alias
   c. Update all consumers
   d. Remove alias in follow-up PR
4. Run tests and build — must both pass
5. Commit: "refactor: rename <OldName> to <NewName>"
```

---

### 4. Reduce Nesting

Trigger: Nesting > 4 levels, or guard clauses inverted.

```typescript
// BEFORE — 5 levels of nesting
function processRequest(request) {
  if (request.auth) {
    if (request.body) {
      if (request.body.items.length > 0) {
        for (const item of request.body.items) {
          if (item.valid) {
            // actual logic here
          }
        }
      }
    }
  }
}

// AFTER — early returns reduce nesting
function processRequest(request) {
  if (!request.auth) return;
  if (!request.body) return;
  if (request.body.items.length === 0) return;

  const validItems = request.body.items.filter(item => item.valid);
  for (const item of validItems) {
    // actual logic — only 2 levels deep
  }
}
```

---

### 5. Extract Class / Module

Trigger: Multiple related functions share state or always appear together.

```
Steps:
1. Group the related functions and their shared state
2. Create a class or module
3. Move each function one at a time, running tests after each move
4. Update callers one at a time
5. Delete old functions once all callers migrated
```

---

## Refactoring PR Requirements

```
□ PR title: "refactor: <what changed>"
□ No behavior changes in the PR — pure structural change
□ All tests pass before and after
□ Build passes (no new TypeScript errors)
□ If file was renamed: update all import paths (use "Rename File" in VS Code)
□ PR description explains: why this refactor, what changed structurally
□ PR size target: < 300 lines changed
   If larger: split into multiple sequential PRs
```

---

## What Not to Refactor

| Situation | Why |
|---|---|
| Code actively being worked on by another team | Merge conflicts; coordination cost |
| Code with < 80% test coverage | Can't verify behavior preserved |
| 3rd-party code in `vendor/` or `node_modules/` | Never modify; upgrade or fork |
| Migration files | Migrations are immutable |
| Generated code (OpenAPI types, Protobuf stubs) | Will be overwritten on regeneration |

---

## Related Files

- `.ai/skills/refactoring-rules.md` — detailed code patterns with examples
- `docs/ENGINEERING_STANDARDS.md` — quality limits that trigger refactoring
- `.ai/playbooks/pr-review.md` — how to review a refactoring PR
