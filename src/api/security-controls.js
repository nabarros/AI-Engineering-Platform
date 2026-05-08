function normalizeHeader(value) {
  return String(value || "").trim();
}

export function parseApiCredentials(req) {
  const authHeader = normalizeHeader(req.headers.authorization);
  const apiKeyHeader = normalizeHeader(req.headers["x-api-key"]);

  if (apiKeyHeader) return apiKeyHeader;
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }
  return "";
}

export function createAuthGuard(options = {}) {
  const apiKeys = new Map(Object.entries(options.apiKeys || {}));
  const requireAuth = options.requireAuth ?? apiKeys.size > 0;

  return {
    requireAuth,
    verify(req, tenantId) {
      if (!requireAuth) {
        return { allowed: true, principal: "anonymous" };
      }

      const token = parseApiCredentials(req);
      if (!token) {
        return { allowed: false, statusCode: 401, code: "UNAUTHORIZED", message: "Missing API credentials." };
      }

      const entry = apiKeys.get(token);
      if (!entry) {
        return { allowed: false, statusCode: 403, code: "FORBIDDEN", message: "Invalid API credentials." };
      }

      const allowedTenants = Array.isArray(entry.tenants) ? entry.tenants : [];
      if (allowedTenants.length > 0 && !allowedTenants.includes(tenantId)) {
        return { allowed: false, statusCode: 403, code: "TENANT_FORBIDDEN", message: "Credential does not allow this tenant." };
      }

      return {
        allowed: true,
        principal: entry.principal || "service",
        scopes: entry.scopes || []
      };
    }
  };
}

export class SlidingWindowRateLimiter {
  constructor(options = {}) {
    this.limit = options.limit || 60;
    this.windowMs = options.windowMs || 60_000;
    this.requests = new Map();
  }

  check(key) {
    const now = Date.now();
    const timestamps = this.requests.get(key) || [];
    const fresh = timestamps.filter((ts) => now - ts <= this.windowMs);

    if (fresh.length >= this.limit) {
      this.requests.set(key, fresh);
      const retryAfterMs = this.windowMs - (now - fresh[0]);
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil(retryAfterMs / 1000)
      };
    }

    fresh.push(now);
    this.requests.set(key, fresh);
    return { allowed: true, remaining: this.limit - fresh.length };
  }
}

export class IdempotencyCache {
  constructor(options = {}) {
    this.ttlMs = options.ttlMs || 5 * 60 * 1000;
    this.storage = new Map();
  }

  get(cacheKey) {
    const entry = this.storage.get(cacheKey);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.storage.delete(cacheKey);
      return null;
    }

    return entry.value;
  }

  set(cacheKey, value) {
    this.storage.set(cacheKey, {
      value,
      expiresAt: Date.now() + this.ttlMs
    });
  }
}
