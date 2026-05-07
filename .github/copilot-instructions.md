---
description: GitHub Copilot workspace instructions for AI Engineering Platform. Applied globally across the repository.
applyTo: "**"
---

# AI Engineering Platform — Copilot Workspace Instructions

## Project Context

AI Engineering Platform (AIEP): TypeScript/Python/React system for orchestrating LLM workflows, managing AI model integrations, and providing AI observability.

**Stack:** Node.js 20 (Fastify) · Python 3.12 (FastAPI) · React 18 · PostgreSQL · Redis · Weaviate · Kafka · Kubernetes

## Copilot Integration Model

- `.ai/` is the source of truth for governance, memory, and domain implementation patterns.
- `.github/` provides Copilot runtime assets (agents, skills, prompts, file instructions).
- Always apply `.github/instructions/aiep-ai-bridge.instructions.md` as the bridge between these systems.

For non-trivial tasks, use this mandatory load order:
1. `.ai/instructions/instruction-hierarchy.md`
2. `.ai/instructions/global-rules.md`
3. `.ai/instructions/ai-agent-operating-rules.md`
4. `.ai/memory/current-architecture.md`
5. `.ai/memory/active-work.md`
6. `.ai/memory/known-issues.md`
7. Task-relevant `.ai/skills/*` and `docs/*`

---

## TypeScript Standards

- Strict mode always on — no `any` without explicit comment
- `Result<T, E>` pattern for fallible business logic
- Zod for all runtime validation at system boundaries
- Named exports preferred over default exports
- Dependency injection via constructors — no hidden global imports
- No raw `process.env` outside configuration modules
- Async/await over promise chains

**Naming conventions:**
- Types and classes: `PascalCase`
- Functions and variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Files: `kebab-case`

---

## Python Standards

- Type hints required on all public functions
- Pydantic v2 for all data models
- `ruff` for linting, `black` for formatting
- `async def` for all I/O-bound functions
- No bare `except:` — catch specific exceptions
- `pathlib.Path` over `os.path`

---

## React / Frontend Standards

- Functional components only — no class components
- Zustand for global state, `useState`/`useReducer` for local state
- Custom hooks for reusable logic — prefix with `use`
- CSS modules or Tailwind — no inline styles
- Error boundaries on all route-level components
- All async state: loading + error states always handled

---

## Architecture Constraints

- Services must NOT directly access another service's database
- Auth handled exclusively by `auth-service` — never re-implement
- Secrets from environment variables only
- Inter-service calls via message bus (Kafka) or typed REST clients
- New endpoints follow `docs/API_CONVENTIONS.md` — spec-first design

---

## Testing Requirements

- All new code requires tests before completion
- Co-locate test files: `user.service.ts` → `user.service.test.ts`
- Unit tests mock all I/O dependencies
- Integration tests use test containers
- Test names: `should [verb] [outcome] when [condition]`

---

## Security Requirements

- **No hardcoded secrets, API keys, tokens, or passwords — ever**
- All SQL must use parameterized queries — never string interpolation
- User input never passed to `eval()`, `exec()`, shell commands
- Auth middleware applied before any route handler accessing user data
- Error responses never expose stack traces, file paths, or internal details
- Rate limiting required on all public-facing endpoints

---

## Error Handling

```typescript
// GOOD
const result = await service.findUser(id);
if (!result.ok) {
  logger.error({ userId: id, error: result.error }, 'User lookup failed');
  return reply.status(404).send({ error: 'User not found', code: 'USER_NOT_FOUND' });
}

// BAD
try {
  return await service.findUser(id);
} catch (e) {
  return null; // swallowed error
}
```

---

## API Response Shape

```typescript
// Success
{ data: T, meta?: { page: number, total: number } }

// Error
{ error: string, code: string, details?: Record<string, string> }
```

---

## Do NOT Generate

- Hardcoded secrets, credentials, or API keys
- SQL with string interpolation or concatenation
- `@ts-ignore` without explanatory comment
- Empty catch blocks
- Auth bypass patterns
- `console.log` with emails, tokens, or passwords
- Hardcoded environment-specific values (URLs, ports, credentials)

---

## Context Files for Complex Tasks

Load these when relevant:
- `.ai/skills/api-design.md` — API work
- `.ai/skills/react-patterns.md` — frontend work
- `.ai/skills/database-patterns.md` — database work
- `.ai/skills/auth-patterns.md` — authentication work
- `.ai/skills/refactoring-rules.md` — refactoring work
- `docs/ARCHITECTURE.md` — architectural questions
- `docs/SECURITY_RULES.md` — security questions

## Workspace Copilot Assets

- Agents: `.github/agents/`
- Skills: `.github/skills/`
- Prompts: `.github/prompts/`
- File instructions: `.github/instructions/`
- Runtime guardrails (hooks): `.github/hooks/`
