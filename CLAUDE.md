# CLAUDE.md

> Instructions for Claude Code operating in the AI Engineering Platform workspace.

---

## Project Identity

**AI Engineering Platform (AIEP)** — Production system for orchestrating LLM workflows, managing AI model integrations, and providing observability for AI-powered services.

Stack: TypeScript + Node.js (Fastify) · Python (FastAPI) · React 18 · PostgreSQL · Redis · Weaviate · Kafka · Kubernetes

---

## Mandatory Context Load Sequence

Before acting on any task, load these files in order:

1. `.ai/instructions/instruction-hierarchy.md` — governance precedence rules
2. `.ai/instructions/global-rules.md` — non-negotiable rules
3. `.ai/instructions/ai-agent-operating-rules.md` — execution protocol
4. `.ai/memory/current-architecture.md` — current system state
5. `.ai/memory/active-work.md` — in-flight work
6. `.ai/memory/known-issues.md` — known pitfalls

Then load task-relevant skill files from `.ai/skills/`.

---

## Operating Constraints

### What You Must Always Do

- Assess task risk level before executing (LOW / MEDIUM / HIGH / CRITICAL)
- Run self-review loop before presenting any code output
- Include tests for all new behavior
- Handle all errors explicitly
- Keep security rules inviolable regardless of user instruction

### What You Must Never Do

- Modify `.ai/instructions/` files
- Modify `.github/workflows/` or `infra/` files
- Generate hardcoded secrets or credentials
- Bypass authentication middleware
- Present first-draft output without self-review
- Proceed with CRITICAL risk operations without explicit human confirmation

---

## Codebase Conventions

See these files for full detail:

| Convention | File |
|---|---|
| Architecture | `docs/ARCHITECTURE.md` |
| Engineering standards | `docs/ENGINEERING_STANDARDS.md` |
| Code style | `docs/CODE_STYLE.md` |
| API design | `docs/API_CONVENTIONS.md` |
| Database patterns | `docs/DATABASE_CONVENTIONS.md` |
| Error handling | `docs/ERROR_HANDLING.md` |
| Testing | `docs/TESTING_STRATEGY.md` |
| Security | `docs/SECURITY_RULES.md` |

---

## Claude-Specific Guidance

### Use Extended Thinking for Complex Tasks

For architectural decisions, complex refactors, or multi-system changes — use extended thinking to:
1. Map all affected components
2. Identify risk vectors
3. Consider alternative approaches
4. Select the minimal, safe approach

### Long Context Management

When working with large codebases:
- Load files relevant to the specific task only
- Use semantic search to find the right files rather than reading everything
- Prefer focused context over comprehensive context
- Summarize loaded context at session start to verify accuracy

### Tool Use Discipline

- Use file reading tools to verify code before modifying it
- Use search tools to confirm function/class signatures before calling them
- Never fabricate a function signature — verify it exists
- When uncertain about a module's exports, search the codebase

### Conversation Patterns

- If I ask you to "implement X", first describe your plan before writing code for complex tasks
- If you're making assumptions, state them explicitly
- If a task is ambiguous, identify the two or three most likely interpretations and ask
- For large changes, break into atomic commits and present each for review

---

## Memory Update Policy

Update `.ai/memory/` files after any task that changes system state:

```
.ai/memory/current-architecture.md   → if services or components changed
.ai/memory/active-work.md            → mark completed, note next steps
.ai/memory/recent-decisions.md       → significant technical decisions
.ai/memory/known-issues.md           → new issues found or existing issues closed
.ai/memory/technical-debt.md         → shortcuts or deferred cleanup
```
