---
tags: [auth, jwt, rbac, authorization, security, typescript]
applies_to: [src/services/**]
priority: critical
token_budget: medium
owner: security-team
last_reviewed: 2026-05-07
---

# Skill: Auth Patterns

## Purpose

Patterns for authentication and authorization across AIEP services. Load when adding auth to endpoints, consuming the auth-service, or implementing RBAC.

## Applicability

Load when: adding auth middleware, verifying JWT tokens, implementing role-based checks, or integrating with the auth-service. See `docs/SECURITY_RULES.md` for non-negotiable security rules.

---

## 1. Core Rule

**The `auth-service` is the sole authority for authentication.** No service implements its own login, token signing, or user management. All services call the auth-service to verify tokens.

---

## 2. JWT Verification Pattern

```typescript
// src/services/llm-gateway/plugins/auth.plugin.ts
import fp from 'fastify-plugin';
import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthServiceClient } from '@aiep/auth-client';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (role: UserRole) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    user: AuthenticatedUser;
  }
}

export const authPlugin = fp(async (fastify) => {
  const authClient = fastify.diContainer.resolve(AuthServiceClient);

  fastify.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    }

    const token = authHeader.slice(7); // Remove 'Bearer '

    const result = await authClient.verifyToken(token);
    if (!result.ok) {
      // Log only the reason code — never log the token
      req.log.warn({ reason: result.error }, 'Token verification failed');
      return reply.status(401).send({ error: 'Invalid or expired token', code: 'AUTH_TOKEN_INVALID' });
    }

    req.user = result.value; // set for downstream use
  });

  fastify.decorate('requireRole', (role: UserRole) => {
    return async (req: FastifyRequest, reply: FastifyReply) => {
      if (!req.user) {
        // authenticate should always run first — this is a programming error
        req.log.error('requireRole called before authenticate');
        return reply.status(500).send({ error: 'Internal error', code: 'INTERNAL_ERROR' });
      }

      if (!req.user.roles.includes(role)) {
        req.log.warn({ userId: req.user.id, requiredRole: role, userRoles: req.user.roles }, 'Authorization denied');
        return reply.status(403).send({ error: 'Insufficient permissions', code: 'FORBIDDEN' });
      }
    };
  });
});
```

---

## 3. Auth Service Client

```typescript
// packages/auth-client/src/auth-service.client.ts
import type { Result } from '@aiep/core';

export type AuthenticatedUser = {
  id: string;
  email: string;
  roles: UserRole[];
  organizationId: string;
  sessionId: string;
};

export class AuthServiceClient {
  constructor(
    private readonly httpClient: HttpClient,
    private readonly config: { baseUrl: string; serviceToken: string },
  ) {}

  async verifyToken(token: string): Promise<Result<AuthenticatedUser, 'INVALID' | 'EXPIRED' | 'SERVICE_ERROR'>> {
    const result = await this.httpClient.post(`${this.config.baseUrl}/internal/verify`, {
      headers: {
        // Service-to-service auth — use service token, not the user token
        Authorization: `Bearer ${this.config.serviceToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
      timeout: 3000, // auth check must be fast
    });

    if (!result.ok) {
      if (result.status === 401) return { ok: false, error: 'INVALID' };
      if (result.status === 410) return { ok: false, error: 'EXPIRED' };
      return { ok: false, error: 'SERVICE_ERROR' };
    }

    return { ok: true, value: result.body as AuthenticatedUser };
  }
}
```

---

## 4. RBAC Role Hierarchy

```typescript
// packages/auth-client/src/roles.ts
export const USER_ROLES = ['viewer', 'editor', 'admin', 'system'] as const;
export type UserRole = typeof USER_ROLES[number];

// Role hierarchy — higher roles include lower role permissions
export const ROLE_HIERARCHY: Record<UserRole, UserRole[]> = {
  system: ['admin', 'editor', 'viewer', 'system'],
  admin:  ['admin', 'editor', 'viewer'],
  editor: ['editor', 'viewer'],
  viewer: ['viewer'],
};

// Check if a user has the required role (respecting hierarchy)
export function hasRole(userRoles: UserRole[], requiredRole: UserRole): boolean {
  return userRoles.some((userRole) =>
    ROLE_HIERARCHY[userRole]?.includes(requiredRole) ?? false,
  );
}
```

Apply in route definitions:

```typescript
// Viewer: any authenticated user can read
fastify.get('/v1/prompts', { preHandler: [fastify.authenticate] }, handler);

// Editor: requires explicit editor role
fastify.post('/v1/prompts', { preHandler: [fastify.authenticate, fastify.requireRole('editor')] }, handler);

// Admin: restricted to admins
fastify.delete('/v1/prompts/:id', { preHandler: [fastify.authenticate, fastify.requireRole('admin')] }, handler);
```

---

## 5. API Key Authentication

For machine-to-machine access (e.g., CI/CD pipelines, internal services):

```typescript
fastify.decorate('authenticateApiKey', async (req: FastifyRequest, reply: FastifyReply) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || typeof apiKey !== 'string') {
    return reply.status(401).send({ error: 'API key required', code: 'AUTH_REQUIRED' });
  }

  const result = await authClient.verifyApiKey(apiKey);
  if (!result.ok) {
    req.log.warn({ reason: result.error }, 'API key verification failed');
    return reply.status(401).send({ error: 'Invalid API key', code: 'AUTH_API_KEY_INVALID' });
  }

  req.user = result.value; // API keys also resolve to a user context
});
```

API keys are never logged, stored in plaintext, or returned to the client after creation. They are hashed with bcrypt in the database.

---

## 6. Service-to-Service Auth

Internal services use short-lived service tokens issued by auth-service:

```typescript
// src/services/prompt-service/plugins/service-auth.ts
// Service tokens are fetched at startup and refreshed before expiry
export class ServiceTokenProvider {
  private token: string | null = null;
  private expiresAt: Date | null = null;

  async getToken(): Promise<string> {
    if (this.token && this.expiresAt && this.expiresAt > new Date(Date.now() + 60_000)) {
      return this.token; // valid for at least 1 more minute
    }

    const result = await this.authClient.issueServiceToken({
      serviceId: this.config.serviceId,
      serviceSecret: this.config.serviceSecret,
    });

    if (!result.ok) throw new Error(`Failed to fetch service token: ${result.error}`);

    this.token = result.value.token;
    this.expiresAt = new Date(result.value.expiresAt);
    return this.token;
  }
}
```

---

## 7. Security Logging Rules

What to log:
- Auth failure reason code (e.g., `INVALID`, `EXPIRED`)
- User ID + resource accessed on authorization failures
- Service ID on service-to-service auth failures

What NEVER to log:
- JWT tokens (even truncated)
- API keys or secrets
- Passwords
- PII (email, name) in error logs — only `userId`

---

## Anti-Patterns

| Anti-Pattern | Correct Pattern |
|---|---|
| Verifying JWT locally with `jsonwebtoken` | Always call auth-service to verify |
| Trusting user-supplied `userId` from headers | Extract userId from verified token only |
| Checking roles after business logic | Auth/authz always in `preHandler` |
| Logging the JWT token on failure | Log reason code, never the token |
| Implementing password hashing in a service | Only auth-service handles credentials |
| Using `admin` role for machine accounts | Use API keys or service tokens |
| Hardcoding service secrets | Secrets always from environment config |

---

## Checklist

Before merging auth code:
- [ ] Auth extracted from `Authorization: Bearer` header only
- [ ] Auth-service client used for token verification (no local JWT verify)
- [ ] `preHandler: [authenticate, requireRole]` in correct order
- [ ] No tokens, secrets, or PII in log lines
- [ ] Service-to-service calls use service tokens (not user tokens)
- [ ] Integration test covers 401, 403, and success cases
- [ ] Role hierarchy validated in tests
