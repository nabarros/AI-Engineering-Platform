---
description: GitHub Copilot workspace instructions for the AI Engineering Platform.
---

# GitHub Copilot Instructions

## Project Context

This is the AI Engineering Platform (AIEP) — a TypeScript/Python/React system for orchestrating AI workflows, managing LLM integrations, and providing AI observability for engineering teams.

## Technology Stack

- **Backend:** TypeScript, Node.js 20, Fastify — services in `src/services/`
- **AI/ML:** Python 3.12, FastAPI — inference services in `src/ml/`
- **Frontend:** React 18, TypeScript, Vite — UI in `src/ui/`
- **Database:** PostgreSQL (primary), Redis (cache), Weaviate (vectors)
- **Testing:** Vitest (unit), Playwright (E2E), Pytest (Python)
- **Infra:** Kubernetes, Terraform, GitHub Actions

---

## Code Generation Rules

### TypeScript / Node.js

- Always use strict TypeScript — no `any` without explicit comment explaining why
- Use `Result<T, E>` pattern for operations that can fail in business logic; reserve `throw` for truly exceptional conditions
- Validate all external inputs with Zod at service boundaries
- Use named exports over default exports
- Prefer `const` over `let`; avoid `var`
- Async/await over promise chains
- No raw `process.env` access outside of configuration modules
- Use dependency injection — services receive dependencies via constructor, not via imports

```typescript
// GOOD
const userService = new UserService({ repo: userRepo, cache, logger });

// BAD
import { db } from '../db'; // hidden global dependency
```

### Python

- Type hints on all public functions — no bare `def foo(x):`
- Pydantic v2 for all data models
- Use `async def` for I/O-bound functions
- `ruff` format compliance required
- No bare `except:` — always catch specific exception types
- Use `pathlib.Path` over `os.path`

### React / Frontend

- Functional components only — no class components
- `useState` and `useReducer` for local state; Zustand for global state
- Custom hooks for reusable stateful logic — prefix with `use`
- No inline styles — use CSS modules or Tailwind classes
- All user-facing strings through i18n keys (even if single-language for now)
- Error boundaries on all route-level components
- Loading and error states always handled explicitly

---

## Architecture Constraints

- Services do NOT directly access another service's database
- All inter-service communication goes through the message bus (Kafka) or typed REST clients
- Authentication is handled exclusively by the `auth-service` — never re-implement auth logic
- Secrets come from environment variables only — never hardcode
- All new API endpoints must follow conventions in `docs/API_CONVENTIONS.md`

---

## Testing Requirements

- New code requires tests — do not generate code without accompanying tests
- Test file co-location: `src/services/user.service.ts` → `src/services/user.service.test.ts`
- Unit tests mock all I/O
- Integration tests use test containers (no production DB)
- Test names follow: `should [verb] [outcome] when [condition]`

```typescript
// GOOD test name
it('should return 401 when token is expired', ...);

// BAD test name
it('auth test', ...);
```

---

## Security Rules (Non-Negotiable)

- No hardcoded secrets, API keys, passwords, or tokens — ever
- All SQL uses parameterized queries — never string interpolation
- User-supplied data is never passed to `eval()`, `exec()`, `Function()`, shell commands
- Authentication middleware must be applied before any route handler that accesses user data
- Error responses never include stack traces or internal paths
- Rate limiting is required on all public endpoints

---

## What Copilot Should NOT Generate

- Code that bypasses authentication or authorization
- `console.log` with sensitive data (emails, tokens, passwords)
- Hardcoded environment-specific values (URLs, ports, credentials)
- SQL with string interpolation or concatenation
- `@ts-ignore` without an accompanying comment explaining the reason
- Empty catch blocks
- `TODO` comments without a linked issue number

---

## Preferred Patterns

### Error Handling

```typescript
// GOOD — explicit, structured error handling
const result = await userRepo.findById(id);
if (!result.ok) {
  logger.error({ userId: id, error: result.error }, 'User lookup failed');
  return reply.status(404).send({ error: 'User not found' });
}

// BAD — swallowed error, generic message
try {
  const user = await userRepo.findById(id);
  return user;
} catch (e) {
  return null;
}
```

### API Response Shape

```typescript
// GOOD — consistent envelope
{ data: T, meta?: PaginationMeta }          // success
{ error: string, code: string }            // failure

// BAD — ad-hoc shapes per endpoint
{ user: T }
{ result: T, status: 'ok' }
```

### Environment Configuration

```typescript
// GOOD — centralized, validated config module
import { config } from '@/config';
const apiUrl = config.externalApi.url;

// BAD — scattered env access
const apiUrl = process.env.EXTERNAL_API_URL;
```

---

## Additional Context

- Full instruction hierarchy: `.ai/instructions/instruction-hierarchy.md`
- Detailed agent operating rules: `.ai/instructions/ai-agent-operating-rules.md`
- Architecture: `docs/ARCHITECTURE.md`
- Engineering standards: `docs/ENGINEERING_STANDARDS.md`
- Security rules: `docs/SECURITY_RULES.md`
