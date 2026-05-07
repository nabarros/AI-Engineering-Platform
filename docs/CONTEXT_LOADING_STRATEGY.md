---
ai_priority: high
context_type: ai-engineering
load_when: starting any AI agent session, optimizing context usage, debugging agent quality
token_budget: low
---

# Context Loading Strategy

## AI Agent Load Guidance

This document *is* the context loading strategy. Read it once; then apply it every session.

---

## Core Principle

**Load the minimum context required to complete the task correctly.**

Loading too much context causes:
- Attention dilution (model focuses on irrelevant information)
- Token waste (increases cost and latency)
- Context window exhaustion in long sessions
- Reduced response accuracy due to noise

Loading too little causes:
- Missing constraints (security rules, patterns)
- Inconsistent code output
- Architecture violations
- Hallucinated APIs and patterns

---

## Context Loading Tiers

### Tier 1 — Always Loaded (Every Session)

These files are mandatory regardless of the task:

```
.ai/instructions/instruction-hierarchy.md     ~300 tokens
.ai/instructions/global-rules.md             ~600 tokens
.ai/instructions/ai-agent-operating-rules.md ~800 tokens
.ai/memory/current-architecture.md           ~400 tokens
.ai/memory/active-work.md                    ~200 tokens
.ai/memory/known-issues.md                   ~300 tokens
                                      Total: ~2,600 tokens
```

### Tier 2 — Task-Domain Context (Load on Task Start)

Load the skill file(s) matching the task domain:

| Task | Load |
|------|------|
| Frontend / React | `.ai/skills/react-patterns.md` |
| API design / REST | `.ai/skills/api-design.md` + `docs/API_CONVENTIONS.md` |
| Database work | `.ai/skills/database-patterns.md` + `docs/DATABASE_CONVENTIONS.md` |
| Writing tests | `.ai/skills/testing-jest.md` + `docs/TESTING_STRATEGY.md` |
| Debugging | `.ai/skills/debugging-node.md` |
| Auth / security | `.ai/skills/auth-patterns.md` + `docs/SECURITY_RULES.md` |
| Refactoring | `.ai/skills/refactoring-rules.md` |
| Database migration | `.ai/skills/migration-strategy.md` |
| Performance | `.ai/skills/performance-optimization.md` + `docs/PERFORMANCE_GUIDELINES.md` |

### Tier 3 — Architecture Context (Load on Demand)

Load only when the task involves cross-service concerns or design decisions:

```
docs/ARCHITECTURE.md                          → service boundary decisions
.ai/architecture/component-map.md             → service inventory
.ai/architecture/data-flow.md                 → communication patterns
docs/SYSTEM_OVERVIEW.md                       → end-to-end mental model
```

### Tier 4 — Supplemental Memory (Load on Demand)

```
.ai/memory/technical-debt.md                  → areas requiring care
.ai/memory/recent-decisions.md                → recent architectural choices
.ai/memory/implementation-status.md           → feature completion state
```

---

## Decision Tree: What to Load

```
Task received
│
├─ Is it a security-sensitive task?
│  └─ Yes → Load: docs/SECURITY_RULES.md, .ai/skills/auth-patterns.md
│
├─ What layer is the task in?
│  ├─ Frontend/UI → .ai/skills/react-patterns.md
│  ├─ API/Backend → .ai/skills/api-design.md, docs/API_CONVENTIONS.md
│  ├─ Database → .ai/skills/database-patterns.md, docs/DATABASE_CONVENTIONS.md
│  └─ Infrastructure → docs/DEPLOYMENT_GUIDE.md (read-only)
│
├─ Does the task involve cross-service interaction?
│  └─ Yes → docs/ARCHITECTURE.md, .ai/architecture/component-map.md
│
├─ Does the task involve existing code?
│  └─ Yes → Read the specific files being modified before modifying them
│
└─ Does the task change system state?
   └─ Yes → Load: .ai/memory/current-architecture.md (already in Tier 1)
              Plan to update: .ai/memory/active-work.md after completion
```

---

## Context Freshness

Memory files must reflect current state. Before relying on memory:

| File | Check Freshness |
|------|----------------|
| `.ai/memory/current-architecture.md` | Verify against actual codebase if task is architecture-sensitive |
| `.ai/memory/known-issues.md` | Issues may have been resolved — check git history if relevant |
| `.ai/memory/active-work.md` | Confirm status is accurate before starting work on the same area |
| `.ai/memory/recent-decisions.md` | May have been superseded by newer ADRs |

If memory files appear stale (dates > 30 days for active work, > 90 days for architecture), note the discrepancy and load from source-of-truth files.

---

## Context for Specific Tool Integrations

### GitHub Copilot (VS Code)

Copilot uses `.github/copilot-instructions.md` and files open in the editor as context. It does not automatically load `.ai/` files. When using Copilot Chat:

- Reference specific `.ai/skills/` files with `#file:` references
- Open relevant architecture files in a second editor tab
- Use `@workspace` for codebase-wide search

### Claude Code

Claude loads `CLAUDE.md` at session start. The `CLAUDE.md` file points to the full `.ai/` context loading sequence. In long sessions, re-anchor with explicit file references.

### Cursor

Cursor uses `.cursorrules` for always-on context. For deep context, use `@Docs` or `@Files` to reference specific `.ai/` files. Add frequently-used architecture files to Cursor's project index.

### Autonomous Agents (API-based)

For programmatic agent loops:
1. Always include Tier 1 files in the system message or first user message
2. Load Tier 2 files as a document block at task start
3. Load Tier 3+ files only if the agent's task routing classifies them as needed
4. Context budget: reserve 20% of the model's context window for output

---

## Anti-Patterns

| Anti-Pattern | Problem |
|---|---|
| Loading entire `docs/` folder | Dilutes attention, wastes tokens |
| Skipping Tier 1 to save tokens | Removes governance rules — creates risk |
| Loading the same file multiple times in one session | Wasteful, no benefit |
| Not updating memory after task completion | Memory drift — future sessions lose context |
| Using the README as the only context | README is human-oriented; too high-level for precise code generation |
