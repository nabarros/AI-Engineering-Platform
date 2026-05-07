---
ai_priority: tier-2
context_type: context-map
load_when: starting-work, context-loading, agent-onboarding
token_budget: low
owner: platform-team
last_reviewed: 2026-05-07
---

# Context Map

Visual map of all context files, their load conditions, and estimated token cost.

---

## Loading Decision Flow

```
Every AI session starts here:
         │
         ▼
Tier 1 (Always load — ~2,600 tokens)
  ├── .ai/instructions/instruction-hierarchy.md   (~200 tokens)
  ├── .ai/instructions/global-rules.md            (~400 tokens)
  ├── .ai/instructions/ai-agent-operating-rules.md (~600 tokens)
  └── AGENT_GUIDE.md                              (~1,400 tokens)
         │
         ▼
What is the task domain?
         │
  ┌──────┴───────────────────────────────────────┐
  │              │              │                 │
  ▼              ▼              ▼                 ▼
API/Backend   Frontend      Database         Security
  │              │              │                 │
 Tier 2A      Tier 2B        Tier 2C           Tier 2D
(see below)   (see below)   (see below)       (see below)
         │
         ▼
Additional context if needed (Tier 3+):
  • Deployment: .ai/playbooks/deployment.md
  • Debugging: .ai/playbooks/debugging.md
  • Architecture deep-dive: .ai/architecture/system-design.md
```

---

## Tier 1 — Always Load (~2,600 tokens)

| File | Purpose | Tokens |
|---|---|---|
| `.ai/instructions/instruction-hierarchy.md` | Precedence rules | ~200 |
| `.ai/instructions/global-rules.md` | Non-negotiable rules | ~400 |
| `.ai/instructions/ai-agent-operating-rules.md` | Agent governance | ~600 |
| `AGENT_GUIDE.md` | Task execution protocol | ~1,400 |

---

## Tier 2 — Load by Task Domain

### 2A — API / Backend Work
| File | Tokens |
|---|---|
| `docs/API_CONVENTIONS.md` | ~700 |
| `.ai/skills/api-design.md` | ~800 |
| `.ai/skills/auth-patterns.md` | ~700 |
| `docs/ERROR_HANDLING.md` | ~500 |

### 2B — Frontend / React Work
| File | Tokens |
|---|---|
| `.ai/skills/react-patterns.md` | ~700 |
| `docs/CODE_STYLE.md` (React section) | ~400 |

### 2C — Database / Migration Work
| File | Tokens |
|---|---|
| `docs/DATABASE_CONVENTIONS.md` | ~800 |
| `.ai/skills/database-patterns.md` | ~800 |
| `.ai/skills/migration-strategy.md` | ~700 |

### 2D — Security Work
| File | Tokens |
|---|---|
| `docs/SECURITY_RULES.md` | ~700 |
| `.ai/security/security-rules.md` | ~500 |
| `.ai/security/owasp-checklist.md` | ~600 |

### 2E — Testing Work
| File | Tokens |
|---|---|
| `docs/TESTING_STRATEGY.md` | ~700 |
| `.ai/skills/testing-jest.md` | ~800 |

### 2F — Performance Work
| File | Tokens |
|---|---|
| `docs/PERFORMANCE_GUIDELINES.md` | ~700 |
| `.ai/skills/performance-optimization.md` | ~700 |

### 2G — Deployment / Operations
| File | Tokens |
|---|---|
| `docs/DEPLOYMENT_GUIDE.md` | ~600 |
| `.ai/playbooks/deployment.md` | ~600 |

---

## Tier 3 — Architecture / Deep Context (Load on Demand)

| File | Load When | Tokens |
|---|---|---|
| `docs/ARCHITECTURE.md` | Architectural questions | ~800 |
| `.ai/architecture/system-design.md` | Service design details | ~900 |
| `.ai/architecture/component-map.md` | Service discovery, ports | ~500 |
| `.ai/architecture/data-flow.md` | Request flow diagrams | ~700 |
| `docs/SYSTEM_OVERVIEW.md` | Platform orientation | ~500 |

---

## Tier 4 — Memory State (Load When Relevant)

| File | Load When | Tokens |
|---|---|---|
| `.ai/memory/current-architecture.md` | Version/config questions | ~300 |
| `.ai/memory/active-work.md` | Starting work, checking scope | ~300 |
| `.ai/memory/known-issues.md` | Debugging, investigating issues | ~400 |
| `.ai/memory/technical-debt.md` | Refactoring, planning work | ~400 |
| `.ai/memory/current-priorities.md` | Sprint/task prioritization | ~200 |

---

## Context Freshness

| File | Update Frequency | How to Verify |
|---|---|---|
| `.ai/memory/*.md` | Every sprint | Check `last_reviewed` frontmatter |
| `.ai/architecture/*.md` | On architectural changes | Check git log |
| `docs/*.md` | On standards changes | Check `last_reviewed` |
| `.ai/instructions/*.md` | Rarely (immutable rules) | Not usually needed |

---

## Related Files

- `docs/CONTEXT_LOADING_STRATEGY.md` — full strategy with tool-specific guidance
- `AGENT_GUIDE.md` — context loading protocol for agents
