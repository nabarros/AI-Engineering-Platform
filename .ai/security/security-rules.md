---
ai_priority: tier-1
context_type: security-rules
load_when: always, security-review, code-generation
token_budget: low
owner: security-team
last_reviewed: 2026-05-07
---

# Security Rules (AI-Optimized)

Non-negotiable security rules. Violations block PR merge. Full reference: `docs/SECURITY_RULES.md`.

---

## Hard Rules — Never Violate

| Rule | Enforcement |
|---|---|
| No hardcoded secrets, API keys, tokens, passwords | Pre-commit hook + CI scan |
| All SQL uses parameterized queries — no string interpolation | Code review required |
| User input never passed to `eval()`, `exec()`, or shell commands | Code review required |
| Auth middleware applied before any protected route handler | Route test required |
| Error responses never expose stack traces, file paths, or internal details | Integration test required |
| Rate limiting on all public-facing endpoints | Architecture review |
| All external inputs validated with Zod (TypeScript) or Pydantic (Python) | Compile-time check |

---

## Secure Patterns

### SQL — Parameterized Queries

```typescript
// GOOD — parameterized query via Kysely
const prompt = await db
  .selectFrom('prompts')
  .where('id', '=', promptId)          // parameterized
  .where('org_id', '=', user.orgId)    // parameterized
  .selectAll()
  .executeTakeFirst();

// BAD — string interpolation = SQL injection
const result = await db.query(`SELECT * FROM prompts WHERE id = '${promptId}'`);
```

### Auth — Always Verify Token First

```typescript
// GOOD — auth middleware runs before handler
fastify.get('/v1/prompts/:id', {
  preHandler: [verifyToken, requireRole('viewer')], // auth first
}, async (request, reply) => {
  const prompt = await promptService.findById(request.params.id, request.user.orgId);
  // ...
});

// BAD — auth in handler body (can be bypassed)
fastify.get('/v1/prompts/:id', async (request, reply) => {
  if (!request.headers.authorization) { return reply.status(401).send(...); } // too late
});
```

### Error Responses — Never Expose Internals

```typescript
// GOOD
return reply.status(500).send({ error: 'Internal server error', code: 'INTERNAL_ERROR' });

// BAD — leaks file paths and stack traces
return reply.status(500).send({ error: err.message, stack: err.stack });
```

### Secrets — Environment Variables Only

```typescript
// GOOD
const apiKey = config.get('OPENAI_API_KEY'); // from config module

// BAD
const apiKey = 'sk-real-openai-key-here'; // hardcoded
```

---

## Anti-Patterns Table

| Anti-Pattern | Risk | Correct Pattern |
|---|---|---|
| `db.query(\`WHERE id = ${id}\`)` | SQL injection | Kysely parameterized queries |
| `eval(userInput)` | RCE | Parse/validate with Zod |
| `exec(\`grep ${filename}\`)` | Command injection | Use fs module directly |
| Returning `err.stack` in API response | Info disclosure | Generic error message + log internally |
| Checking auth in handler body | Auth bypass | `preHandler` middleware array |
| `process.env.SECRET` in service code | Scattered secrets | Config module only |
| Re-implementing JWT verification | Crypto mistakes | Call auth-service `/v1/auth/verify` |
| Storing PII in LLM prompts | Data leakage | Strip PII before prompt construction |

---

## LLM-Specific Security

- **Prompt injection** — Never concatenate user-provided text into system prompts without escaping
- **PII in prompts** — Strip all user-identifying data before sending to external LLM providers
- **Excessive agency** — Agent workflow steps must have explicit allow-list of tool calls
- **Insecure output handling** — Never execute LLM output as code or SQL

---

## Related Files

- `docs/SECURITY_RULES.md` — full security policy
- `.ai/security/owasp-checklist.md` — OWASP Top 10 checklist
- `.ai/security/threat-model.md` — AIEP threat model
- `.ai/skills/auth-patterns.md` — authentication implementation patterns
