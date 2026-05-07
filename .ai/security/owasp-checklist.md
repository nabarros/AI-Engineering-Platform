---
ai_priority: tier-2
context_type: security-checklist
load_when: security-review, new-endpoint, auth-implementation
token_budget: medium
owner: security-team
last_reviewed: 2026-05-07
---

# OWASP Top 10 Checklist

AIEP-specific guidance for each OWASP Top 10 category.

---

## A01 — Broken Access Control

**Risk in AIEP:** Users accessing prompts or workflows from another organization.

Checklist:
- [ ] All repository queries scope by `org_id` (never fetch without org scope)
- [ ] Ownership verified before update/delete: `findById` returns `NOT_FOUND` if wrong org
- [ ] Admin-only operations check `roles.includes('admin')` via `requireRole` middleware
- [ ] Internal service endpoints (`/internal/*`) not reachable from outside cluster

```typescript
// REQUIRED — always scope by org
const prompt = await promptRepo.findById(id, user.orgId); // orgId is mandatory
if (!prompt) return reply.status(404).send(...);           // returns 404, not 403
```

---

## A02 — Cryptographic Failures

**Risk in AIEP:** JWT secret exposure, API key storage, LLM provider key management.

Checklist:
- [ ] JWT secrets stored in AWS Secrets Manager, not environment variables
- [ ] API keys stored hashed (SHA-256) in database; plaintext returned only at creation time
- [ ] HTTPS enforced on all external-facing endpoints (terminated at ALB)
- [ ] TLS 1.2+ enforced on all internal service communication
- [ ] No secrets in logs, responses, or error messages

---

## A03 — Injection

**Risk in AIEP:** SQL injection via query params, prompt injection via user content, command injection.

Checklist:
- [ ] All SQL uses Kysely parameterized queries (TypeScript) or psycopg2 `%s` params (Python)
- [ ] No `db.query()` with template literals or string concatenation
- [ ] User-provided text in LLM prompts is treated as data, not instructions
- [ ] No shell command execution with user-provided input

**Prompt injection mitigation:**
```typescript
// GOOD — user content isolated in a "user" role message
const messages = [
  { role: 'system', content: systemPromptTemplate },    // controlled
  { role: 'user', content: sanitize(userInput) },       // isolated
];

// BAD — user content merged into system prompt
const systemPrompt = `${systemTemplate}\nUser context: ${userInput}`;
```

---

## A04 — Insecure Design

**Risk in AIEP:** Overly permissive agent tool access, insufficient workflow sandboxing.

Checklist:
- [ ] Agent workflow tools explicitly declared in `WorkflowDefinition.allowed_tools[]`
- [ ] No tool executes with more privileges than the initiating user
- [ ] Workflow execution context does not include secrets or other users' data
- [ ] New features reviewed by security team before production deploy

---

## A05 — Security Misconfiguration

**Risk in AIEP:** Default credentials, debug endpoints exposed in production, CORS misconfiguration.

Checklist:
- [ ] CORS origin list is explicit (no `*` in production)
- [ ] Debug/introspection endpoints disabled in production build
- [ ] Default passwords changed on all infrastructure components
- [ ] Unused ports not exposed in Kubernetes service manifests
- [ ] `NODE_ENV=production` set in all production deployments

---

## A06 — Vulnerable and Outdated Components

**Risk in AIEP:** npm/pip dependencies with known CVEs.

Checklist:
- [ ] `pnpm audit` run in CI; critical and high CVEs block merge
- [ ] `pip-audit` run in CI for Python services
- [ ] Dependabot enabled on repository
- [ ] Base Docker images pinned to specific digest (not `latest`)

---

## A07 — Identification and Authentication Failures

**Risk in AIEP:** Token replay attacks, insufficient session invalidation.

Checklist:
- [ ] All JWT verification delegated to auth-service (`POST /v1/auth/verify`)
- [ ] Token expiry enforced: access tokens 15 minutes, refresh tokens 7 days
- [ ] Refresh token rotation implemented (each use issues new token, revokes old)
- [ ] Rate limiting on auth endpoints: 10 requests/minute per IP
- [ ] Failed auth attempts logged with IP (not credentials)

---

## A08 — Software and Data Integrity Failures

**Risk in AIEP:** Prompt content tampering, model registry injection.

Checklist:
- [ ] PromptVersion content is immutable once created (hash stored for integrity)
- [ ] Model registry entries verified via `content_hash` before deployment
- [ ] Kafka messages validated against schema registry before processing
- [ ] ArgoCD deployment manifests come from trusted Git branches only

---

## A09 — Security Logging and Monitoring Failures

**Risk in AIEP:** Missed breach detection, insufficient audit trail.

Checklist:
- [ ] All auth events logged: login, logout, token verification failure, permission denied
- [ ] All LLM requests logged to audit-service (input hash, not plaintext; org, user, model)
- [ ] Failed access attempts generate alerts in Datadog (>10 failures/min triggers alarm)
- [ ] Audit logs are immutable — no delete API, retained for 90 days minimum
- [ ] Security events tagged with `severity: security` in structured logs

---

## A10 — Server-Side Request Forgery (SSRF)

**Risk in AIEP:** Vector store document ingestion from URLs, webhook callbacks.

Checklist:
- [ ] URL validation enforced before fetching documents: reject `localhost`, `169.254.*`, RFC-1918 ranges
- [ ] Outbound HTTP requests made via dedicated egress proxy (no direct container-to-internet)
- [ ] Webhook URL validation: only HTTPS, allowlist of domains in configuration
- [ ] `fetch()` / `axios` timeout enforced (≤10s) to prevent hung connections

```typescript
// REQUIRED — validate URL before fetching
const SSRF_BLOCKLIST = /^(localhost|127\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|169\.254\.)/;

function validateWebhookUrl(url: string): boolean {
  const parsed = new URL(url);
  return parsed.protocol === 'https:' && !SSRF_BLOCKLIST.test(parsed.hostname);
}
```

---

## Related Files

- `.ai/security/security-rules.md` — hard security rules
- `.ai/security/threat-model.md` — AIEP threat model
- `docs/SECURITY_RULES.md` — full security policy
