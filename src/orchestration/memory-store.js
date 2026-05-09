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

function clampProvenanceScore(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 1;
  }
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function createIndexedRecord(keyField, key, payload, nowMs, options = {}) {
  const ttlMs = options.ttlMs;
  return {
    [keyField]: key,
    payload,
    updatedAt: nowMs,
    provenanceScore: clampProvenanceScore(options.provenanceScore),
    expiresAt: typeof ttlMs === "number" ? nowMs + ttlMs : null
  };
}

function normalizeSearchText(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeSearchText(item)).join(" ");
  }

  if (value && typeof value === "object") {
    return Object.values(value).map((item) => normalizeSearchText(item)).join(" ");
  }

  return String(value || "").toLowerCase();
}

function scoreRepositoryGraphSignals(payload, intentTerm, tokens, baseScore) {
  if (!payload || typeof payload !== "object") {
    return 0;
  }

  let graphScore = 0;
  let matchedGraphSignal = false;

  for (const fieldName of ["relatedTo", "links", "ownerTeam", "specialistId"]) {
    if (!Object.prototype.hasOwnProperty.call(payload, fieldName)) {
      continue;
    }

    const fieldValue = payload[fieldName];
    const normalizedValue = normalizeSearchText(fieldValue);
    if (!normalizedValue) {
      continue;
    }

    const fieldWeight = fieldName === "relatedTo" || fieldName === "links" ? 1.25 : 0.75;
    const matchesIntent = intentTerm && normalizedValue.includes(intentTerm);
    const tokenMatches = tokens.filter((token) => normalizedValue.includes(token)).length;

    if (matchesIntent) {
      graphScore += fieldWeight * 3;
      matchedGraphSignal = true;
    }

    if (tokenMatches > 0) {
      graphScore += fieldWeight * tokenMatches;
      matchedGraphSignal = true;
    }

    if (baseScore > 0) {
      graphScore += fieldWeight;
    }
  }

  if (!matchedGraphSignal && baseScore <= 0) {
    return 0;
  }

  return Number(graphScore.toFixed(4));
}

export class OrchestrationMemory {
  constructor() {
    this.scopes = {
      session: new Map(),
      repository: new Map(),
      patterns: new Map()
    };
    this.indexes = {
      taskMetadata: new Map(),
      repositoryMetadata: new Map()
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

  indexTaskMetadata(requestId, payload, options = {}) {
    const key = String(requestId || "").trim();
    if (!key) {
      throw new Error("Task metadata requires a non-empty requestId.");
    }

    const nowMs = Date.now();
    const record = createIndexedRecord("requestId", key, payload, nowMs, options);
    this.indexes.taskMetadata.set(key, record);
    return record;
  }

  indexRepositoryMetadata(key, payload, options = {}) {
    const normalizedKey = String(key || "").trim();
    if (!normalizedKey) {
      throw new Error("Repository metadata requires a non-empty key.");
    }

    const nowMs = Date.now();
    const record = createIndexedRecord("key", normalizedKey, payload, nowMs, options);
    this.indexes.repositoryMetadata.set(normalizedKey, record);
    return record;
  }

  queryIndexedMetadata({ intent, query, limit = 5 } = {}) {
    const safeLimit = Math.max(1, Number(limit) || 5);
    const intentTerm = String(intent || "general").toLowerCase();
    const queryText = String(query || "").toLowerCase();
    const tokens = queryText.split(/\s+/).filter(Boolean);
    const results = [];

    const nowMs = Date.now();

    const rankRecord = (source, key, payload, updatedAt, provenanceScore, expiresAt) => {
      if (typeof expiresAt === "number" && expiresAt <= nowMs) {
        return;
      }

      const blob = JSON.stringify(payload || {}).toLowerCase();
      let score = 0;

      if (intentTerm && blob.includes(intentTerm)) {
        score += 10;
      }
      for (const token of tokens) {
        if (blob.includes(token)) {
          score += 2;
        }
      }

      const graphScore = source === "repository" ? scoreRepositoryGraphSignals(payload, intentTerm, tokens, score) : 0;
      const combinedScore = score + graphScore;

      if (combinedScore > 0) {
        const weightedScore = combinedScore * (0.5 + 0.5 * clampProvenanceScore(provenanceScore));
        results.push({
          source,
          key,
          payload,
          score: Number(weightedScore.toFixed(4)),
          graphScore: Number(graphScore.toFixed(4)),
          provenanceScore: clampProvenanceScore(provenanceScore),
          updatedAt
        });
      }
    };

    for (const [key, entry] of this.indexes.taskMetadata.entries()) {
      rankRecord("task", key, entry.payload, entry.updatedAt, entry.provenanceScore, entry.expiresAt);
    }

    for (const [key, entry] of this.indexes.repositoryMetadata.entries()) {
      rankRecord("repository", key, entry.payload, entry.updatedAt, entry.provenanceScore, entry.expiresAt);
    }

    return results
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        return right.updatedAt - left.updatedAt;
      })
      .slice(0, safeLimit);
  }

  pruneExpiredIndexedMetadata(nowMs = Date.now()) {
    let removedTaskMetadata = 0;
    let removedRepositoryMetadata = 0;

    for (const [key, record] of this.indexes.taskMetadata.entries()) {
      if (typeof record.expiresAt === "number" && record.expiresAt <= nowMs) {
        this.indexes.taskMetadata.delete(key);
        removedTaskMetadata += 1;
      }
    }

    for (const [key, record] of this.indexes.repositoryMetadata.entries()) {
      if (typeof record.expiresAt === "number" && record.expiresAt <= nowMs) {
        this.indexes.repositoryMetadata.delete(key);
        removedRepositoryMetadata += 1;
      }
    }

    return {
      taskMetadata: removedTaskMetadata,
      repositoryMetadata: removedRepositoryMetadata,
      total: removedTaskMetadata + removedRepositoryMetadata
    };
  }

  reindexMetadata() {
    const sortEntries = (left, right) => {
      if (right[1].updatedAt !== left[1].updatedAt) {
        return right[1].updatedAt - left[1].updatedAt;
      }
      return String(left[0]).localeCompare(String(right[0]));
    };

    const taskEntries = [...this.indexes.taskMetadata.entries()].sort(sortEntries);
    const repositoryEntries = [...this.indexes.repositoryMetadata.entries()].sort(sortEntries);

    this.indexes.taskMetadata = new Map(taskEntries);
    this.indexes.repositoryMetadata = new Map(repositoryEntries);

    return {
      taskMetadata: taskEntries.length,
      repositoryMetadata: repositoryEntries.length,
      total: taskEntries.length + repositoryEntries.length
    };
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
      patterns: serializeScope(this.scopes.patterns),
      taskMetadata: serializeScope(this.indexes.taskMetadata),
      repositoryMetadata: serializeScope(this.indexes.repositoryMetadata)
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
    const restoreIndex = (indexName) => {
      const items = Array.isArray(state[indexName]) ? state[indexName] : [];
      const index = this.indexes[indexName];
      index.clear();

      for (const item of items) {
        if (!Array.isArray(item) || item.length !== 2) continue;
        const [key, entry] = item;
        index.set(key, entry);
      }
    };

    restoreIndex("taskMetadata");
    restoreIndex("repositoryMetadata");
  }
}
