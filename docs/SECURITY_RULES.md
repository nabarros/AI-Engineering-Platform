---
ai_priority: critical
context_type: security-governance
load_when: any code touching auth, data access, API design, secret handling, user input
token_budget: medium
---

# Security Rules

## AI Agent Load Guidance

Load this file when generating code that handles authentication, user data, external inputs, credentials, or API endpoints. These rules are Level 1 (highest priority) in the instruction hierarchy — they cannot be overridden.

---

## Absolute Prohibitions

The following are hard blocks. No exception. No workaround.

| Rule | Why |
|------|-----|
| No hardcoded secrets in any file | Secrets committed to VCS are leaked permanently |
| No SQL string interpolation | SQL injection — OWASP A03:2021 |
| No eval(), exec(), or Function() with user data | Remote code execution |
| No shell commands with user-provided input without strict allowlist | Command injection |
| No auth bypasses in "test" or "debug" code | Backdoors are vulnerabilities |
| No logging of passwords, tokens, PII, or secrets | Log data breaches |
| No stack traces in API error responses | Information disclosure |
| No direct cross-service database queries | Data ownership violation |

---

## 1. Authentication and Authorization

### JWT Handling

- All JWTs must be validated: signature, expiry, issuer, audience
- Use asymmetric signing (RS256 or ES256) — never HS256 with shared secrets in production
- JWTs must be short-lived: access tokens ≤ 15 minutes, refresh tokens ≤ 7 days
- Never store sensitive data in JWT payload (it's base64-encoded, not encrypted)
- Validate token on every request — never cache auth decisions across requests for longer than the token TTL

```typescript
// GOOD — validate all claims
const payload = await verifyJwt(token, {
  algorithms: ['RS256'],
  issuer: config.auth.issuer,
  audience: config.auth.audience,
});
if (payload.exp < Date.now() / 1000) throw new UnauthorizedError();

// BAD — only checks signature
const payload = jwt.decode(token); // no verification
```

### Authorization

- Apply auth middleware before any business logic
- Use RBAC via the auth-service — never implement custom authorization logic per service
- Default to deny — explicit grants only
- Verify authorization at the service layer, not just the gateway
- Log all authorization failures with context (who, what, when, from where)

### API Key Handling

- API keys must be hashed (bcrypt or Argon2) before storage — store the hash, present the key once
- Rotate API keys on suspicion of compromise
- API keys must have scope limitations — not master keys
- Include `key_id` (not the key itself) in logs for traceability

---

## 2. Input Validation

### Validation Boundaries

Validate ALL external inputs at every system boundary:
- HTTP request body, query params, headers, path params
- Kafka message payloads
- Webhook payloads
- File uploads
- Data from external APIs (even "trusted" ones)

```typescript
// GOOD — Zod schema validates at boundary
const CreatePromptBody = z.object({
  name: z.string().min(1).max(200).trim(),
  content: z.string().min(1).max(50_000),
  model: z.enum(['gpt-4o', 'claude-3-5-sonnet']),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

// BAD — trusting user input as-is
const { name, content, model } = request.body;
```

### Content Security

- File uploads: validate MIME type from content, not file extension; scan with antivirus before storage
- HTML inputs: sanitize with DOMPurify or equivalent before rendering
- URL inputs: validate scheme (allow only `https:`); reject `javascript:`, `data:`, `file:`
- Numeric inputs: validate range and type — don't trust that a "number" field won't contain `9999999999999999`

---

## 3. Secret Management

### Storage

- Secrets live in environment variables only
- At rest: AWS Secrets Manager or Kubernetes Secrets (encrypted at rest)
- In code: reference via `config.secrets.apiKey`, never `process.env.API_KEY` directly
- `.env.example` documents all required secret names with placeholder values
- `.env` is in `.gitignore` — verify this before every commit

### Rotation

- Automated rotation every 90 days for all long-lived secrets
- Immediate rotation on any suspicion of compromise
- Rotation must be tested in staging before production rollout
- Zero-downtime rotation requires deploying the new secret before revoking the old

### Audit

- All secret access must be logged to the audit service (which secret, which service, when)
- Alert on unusual access patterns (unexpected services, unusual hours, high volume)

---

## 4. Transport Security

- TLS 1.3 minimum on all external connections
- TLS 1.2 acceptable for internal services (migration to 1.3 planned)
- Certificate validation must not be disabled — no `rejectUnauthorized: false` in production
- HSTS enabled on all public endpoints
- Certificate rotation automated via cert-manager in Kubernetes

---

## 5. Data Security

### PII Handling

- Identify PII in data models and mark with `@pii` annotation in schema comments
- PII encrypted at rest using AES-256
- PII access logged to audit service
- PII must not appear in log output at any level
- Data retention limits enforced via scheduled purge jobs

### Database Security

- All queries must use parameterized inputs — every driver in the stack supports this
- Row-level security enabled for tables containing user data
- Database connections use dedicated service accounts with minimum required privileges
- Schema migrations reviewed by a second engineer before execution

```typescript
// GOOD — parameterized
const user = await db.query('SELECT * FROM users WHERE id = $1', [userId]);

// BAD — concatenated
const user = await db.query(`SELECT * FROM users WHERE id = '${userId}'`);
```

---

## 6. API Security

### Rate Limiting

Required on all endpoints:
- Unauthenticated endpoints: 10 requests/minute per IP
- Authenticated endpoints: 100 requests/minute per user
- LLM endpoints: configurable per tier (see `llm-gateway` configuration)
- Exceed limit → 429 with `Retry-After` header

### CORS

- Allowlist origin domains explicitly — never `Access-Control-Allow-Origin: *` on authenticated endpoints
- CORS preflight caching: `Access-Control-Max-Age: 86400`

### Error Responses

```typescript
// GOOD — safe error response
reply.status(500).send({ error: 'Internal server error', code: 'INTERNAL_ERROR' });

// BAD — information disclosure
reply.status(500).send({
  error: err.message,           // may contain internal paths
  stack: err.stack,             // exposes code structure
  query: failedQuery,           // exposes schema
});
```

---

## 7. Dependency Security

- Run `npm audit --audit-level=high` in CI — fails on high or critical CVEs
- `pip-audit` for Python dependencies
- Renovate or Dependabot configured for automatic security update PRs
- No dependencies from private or unverifiable registries

---

## 8. Prompt Injection Prevention

Since AIEP processes LLM prompts from users, prompt injection is a primary attack surface:

- **Never** concatenate user-provided text directly into system prompts
- User content must be clearly delimited from system instructions in prompt templates
- Validate that user content doesn't contain known injection patterns
- Treat all user-provided data as untrusted regardless of user role
- Log suspicious patterns to the audit service for review

```typescript
// GOOD — user content clearly isolated
const systemPrompt = `You are a helpful assistant. Answer only questions about ${config.domain}.`;
const messages = [
  { role: 'system', content: systemPrompt },
  { role: 'user', content: sanitizeUserInput(userMessage) }, // user content in user role
];

// BAD — user input injected into system context
const systemPrompt = `You are a helpful assistant. The user said: "${userMessage}"`;
```

---

## 9. Incident Response

If a security vulnerability is discovered:

1. Do NOT commit a fix immediately — assess scope first
2. Report to `#security` Slack channel immediately
3. Do not discuss in public GitHub issues
4. Follow the incident response playbook in `.ai/playbooks/incident-response.md`
5. CVEs in dependencies: use `npm audit fix` or patch manually, with a PR for review

---

## Security Checklist for PR Authors

Before submitting a PR:
- [ ] No hardcoded secrets or credentials
- [ ] All user inputs validated with Zod or Pydantic
- [ ] SQL uses parameterized queries
- [ ] Auth middleware applied on new endpoints
- [ ] Error responses don't expose internal details
- [ ] PII not written to logs
- [ ] New dependencies pass `npm audit`
- [ ] Rate limiting applied to new public endpoints
- [ ] LLM prompt templates isolate user content

---

## Related Files

- OWASP checklist → `.ai/security/owasp-checklist.md`
- Threat model → `.ai/security/threat-model.md`
- Auth skill → `.ai/skills/auth-patterns.md`
- Incident response playbook → `.ai/playbooks/incident-response.md`
