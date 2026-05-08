function isExpired(entry, nowMs) {
  return typeof entry.expiresAt === "number" && entry.expiresAt <= nowMs;
}

function createEntry(value, ttlMs, createdAt) {
  return {
    value,
    createdAt,
    updatedAt: createdAt,
    expiresAt: typeof ttlMs === "number" ? createdAt + ttlMs : null
  };
}

export class OrchestrationMemory {
  constructor() {
    this.scopes = {
      session: new Map(),
      repository: new Map(),
      patterns: new Map()
    };
  }

  write(scope, key, value, options = {}) {
    const targetScope = this.scopes[scope];
    if (!targetScope) throw new Error(`Unknown memory scope: ${scope}`);

    const requiresApproval = scope === "repository";
    if (requiresApproval && options.approved !== true) {
      throw new Error("Repository memory write requires explicit approval.");
    }

    const nowMs = Date.now();
    const existing = targetScope.get(key);

    if (existing) {
      existing.value = value;
      existing.updatedAt = nowMs;
      existing.expiresAt = typeof options.ttlMs === "number" ? nowMs + options.ttlMs : existing.expiresAt;
      return existing;
    }

    const entry = createEntry(value, options.ttlMs, nowMs);
    targetScope.set(key, entry);
    return entry;
  }

  read(scope, key) {
    const targetScope = this.scopes[scope];
    if (!targetScope) throw new Error(`Unknown memory scope: ${scope}`);

    const entry = targetScope.get(key);
    if (!entry) return null;

    const nowMs = Date.now();
    if (isExpired(entry, nowMs)) {
      targetScope.delete(key);
      return null;
    }

    return entry.value;
  }

  searchPatterns(query) {
    const q = String(query || "").toLowerCase();
    const result = [];

    for (const [key, entry] of this.scopes.patterns.entries()) {
      if (isExpired(entry, Date.now())) continue;
      const serialized = JSON.stringify(entry.value).toLowerCase();
      if (key.toLowerCase().includes(q) || serialized.includes(q)) {
        result.push({ key, value: entry.value, updatedAt: entry.updatedAt });
      }
    }

    return result.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  freshnessReport() {
    const nowMs = Date.now();
    const report = {};

    for (const [scope, store] of Object.entries(this.scopes)) {
      let fresh = 0;
      let expired = 0;

      for (const entry of store.values()) {
        if (isExpired(entry, nowMs)) {
          expired += 1;
        } else {
          fresh += 1;
        }
      }

      report[scope] = { fresh, expired, total: store.size };
    }

    return report;
  }

  exportState() {
    const serializeScope = (scopeMap) => {
      const entries = [];
      for (const [key, entry] of scopeMap.entries()) {
        entries.push([key, entry]);
      }
      return entries;
    };

    return {
      session: serializeScope(this.scopes.session),
      repository: serializeScope(this.scopes.repository),
      patterns: serializeScope(this.scopes.patterns)
    };
  }

  importState(state = {}) {
    const restoreScope = (scopeName) => {
      const items = Array.isArray(state[scopeName]) ? state[scopeName] : [];
      const scope = this.scopes[scopeName];
      scope.clear();

      for (const item of items) {
        if (!Array.isArray(item) || item.length !== 2) continue;
        const [key, entry] = item;
        scope.set(key, entry);
      }
    };

    restoreScope("session");
    restoreScope("repository");
    restoreScope("patterns");
  }
}
