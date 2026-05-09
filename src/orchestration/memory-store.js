import {
  createMemoryMetadata,
  normalizeProvenance,
  normalizeSourceMetadata,
  resolveMemoryLayer
} from "./memory-contract.js";
import {
  createRepositoryGraphRecord,
  summarizeRepositoryGraph
} from "./repository-graph.js";

const RECENCY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function scoreRepositoryGraphSignals(payload, intentTerm, tokens, baseScore) {
  if (!payload || typeof payload !== "object") {
    return 0;
  }

  const normalizedBlob = JSON.stringify(payload).toLowerCase();
  let graphScore = 0;

  const matchesIntent = intentTerm && normalizedBlob.includes(intentTerm);
  if (matchesIntent) {
    graphScore += 2;
  }

  for (const token of tokens) {
    if (normalizedBlob.includes(token)) {
      graphScore += 0.75;
    }
  }

  if (Array.isArray(payload.symbols) && payload.symbols.length > 0) {
    graphScore += 1.5;
  }
  if (Array.isArray(payload.dependencies) && payload.dependencies.length > 0) {
    graphScore += 1.25;
  }
  if (Array.isArray(payload.ownership) && payload.ownership.length > 0) {
    graphScore += 1;
  }
  if (Array.isArray(payload.relatedTo) && payload.relatedTo.length > 0) {
    graphScore += 1.25;
  }
  if (Array.isArray(payload.links) && payload.links.length > 0) {
    graphScore += 1.25;
  }
  if (typeof payload.ownerTeam === "string" && payload.ownerTeam.trim()) {
    graphScore += 0.75;
  }
  if (typeof payload.specialistId === "string" && payload.specialistId.trim()) {
    graphScore += 0.75;
  }

  if (baseScore > 0 && graphScore > 0) {
    graphScore += 0.5;
  }

  return Number(graphScore.toFixed(4));
}

function isExpired(entry, nowMs) {
  return typeof entry.expiresAt === "number" && entry.expiresAt <= nowMs;
}

function createEntry(value, ttlMs, createdAt, metadata = null) {
  const entryMetadata = metadata || createMemoryMetadata({
    layer: "working",
    scope: "working",
    nowMs: createdAt
  });

  return {
    value,
    createdAt,
    updatedAt: createdAt,
    expiresAt: typeof ttlMs === "number" ? createdAt + ttlMs : null,
    metadata: {
      ...entryMetadata,
      writtenAt: typeof entryMetadata.writtenAt === "number" ? entryMetadata.writtenAt : createdAt,
      updatedAt: createdAt
    }
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
  const sourceMetadata = normalizeSourceMetadata(options.source);
  const provenance = normalizeProvenance({
    score: options.provenanceScore,
    confidence: options.provenanceScore,
    writer: options.provenanceWriter,
    strategy: options.provenanceStrategy
  });

  return {
    [keyField]: key,
    payload,
    updatedAt: nowMs,
    provenanceScore: provenance.score,
    sourceMetadata,
    metadata: {
      provenance,
      source: sourceMetadata,
      writtenAt: nowMs,
      updatedAt: nowMs
    },
    expiresAt: typeof ttlMs === "number" ? nowMs + ttlMs : null
  };
}

export class OrchestrationMemory {
  constructor() {
    this.layers = {
      working: new Map(),
      episodic: new Map(),
      semantic: new Map(),
      procedural: new Map()
    };

    this.scopes = {
      session: this.layers.working,
      repository: this.layers.semantic,
      patterns: this.layers.procedural,
      working: this.layers.working,
      episodic: this.layers.episodic,
      semantic: this.layers.semantic,
      procedural: this.layers.procedural
    };
    this.indexes = {
      taskMetadata: new Map(),
      repositoryMetadata: new Map(),
      repositoryGraph: new Map()
    };
    this.archives = {
      memoryEntries: [],
      indexedMetadata: []
    };
  }

  write(scope, key, value, options = {}) {
    const normalizedScope = String(scope || "").trim().toLowerCase();
    const layer = resolveMemoryLayer(normalizedScope);
    const targetScope = this.scopes[normalizedScope] || this.scopes[layer];

    if (!targetScope) throw new Error(`Unknown memory scope: ${scope}`);

    const requiresApproval = layer === "semantic";
    if (requiresApproval && options.approved !== true) {
      throw new Error("Repository memory write requires explicit approval.");
    }

    const nowMs = Date.now();
    const existing = targetScope.get(key);
    const metadata = createMemoryMetadata({
      scope: normalizedScope || layer,
      layer,
      nowMs,
      provenance: {
        score: options.provenanceScore,
        confidence: options.provenanceScore,
        writer: options.provenanceWriter,
        strategy: options.provenanceStrategy
      },
      source: options.source
    });

    if (existing) {
      existing.value = value;
      existing.updatedAt = nowMs;
      existing.expiresAt = typeof options.ttlMs === "number" ? nowMs + options.ttlMs : existing.expiresAt;
      existing.metadata = {
        ...(existing.metadata || metadata),
        layer,
        scope: metadata.scope,
        updatedAt: nowMs,
        provenance: normalizeProvenance({
          ...(existing.metadata?.provenance || {}),
          score: options.provenanceScore ?? existing.metadata?.provenance?.score,
          confidence: options.provenanceScore ?? existing.metadata?.provenance?.confidence,
          writer: options.provenanceWriter ?? existing.metadata?.provenance?.writer,
          strategy: options.provenanceStrategy ?? existing.metadata?.provenance?.strategy
        }),
        source: normalizeSourceMetadata(options.source || existing.metadata?.source)
      };
      return existing;
    }

    const entry = createEntry(value, options.ttlMs, nowMs, metadata);
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

    for (const [scope, store] of Object.entries({
      session: this.scopes.session,
      repository: this.scopes.repository,
      patterns: this.scopes.patterns
    })) {
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

  indexRepositoryGraph(key, payload, options = {}) {
    const record = createRepositoryGraphRecord(key, payload, options, Date.now());
    this.indexes.repositoryGraph.set(record.key, record);
    return record;
  }

  indexRepositoryGraphBatch(entries = [], options = {}) {
    let indexed = 0;
    for (const item of entries) {
      if (!item || typeof item !== "object") {
        continue;
      }

      const key = item.key || item.id || item.path;
      if (!key) {
        continue;
      }

      this.indexRepositoryGraph(key, item.payload || item, options);
      indexed += 1;
    }

    return {
      indexed,
      total: entries.length
    };
  }

  getRepositoryGraphHealthReport(options = {}) {
    const report = summarizeRepositoryGraph([...this.indexes.repositoryGraph.values()], options);
    return {
      ...report,
      indexName: "repositoryGraph"
    };
  }

  createMemoryContractSummary() {
    return {
      layerCounts: {
        working: this.layers.working.size,
        episodic: this.layers.episodic.size,
        semantic: this.layers.semantic.size,
        procedural: this.layers.procedural.size
      },
      legacyAliasCounts: {
        session: this.scopes.session.size,
        repository: this.scopes.repository.size,
        patterns: this.scopes.patterns.size
      }
    };
  }

  queryIndexedMetadata({ intent, query, limit = 5 } = {}) {
    const safeLimit = Math.max(1, Number(limit) || 5);
    const intentTerm = String(intent || "general").toLowerCase();
    const queryText = String(query || "").toLowerCase();
    const tokens = queryText.split(/\s+/).filter(Boolean);
    const results = [];

    const nowMs = Date.now();

    const rankRecord = ({ source, key, payload, updatedAt, provenanceScore, expiresAt, sourceMetadata = null, graphPayload = null }) => {
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

      const graphScore = source === "repository"
        ? scoreRepositoryGraphSignals(graphPayload || payload, intentTerm, tokens, score)
        : 0;

      const ageMs = typeof updatedAt === "number" ? Math.max(0, nowMs - updatedAt) : RECENCY_WINDOW_MS * 2;
      const recencyWeight = Math.max(0, 1 - ageMs / RECENCY_WINDOW_MS);
      const recencyScore = Number((recencyWeight * 4).toFixed(4));

      const sourceBlob = JSON.stringify(sourceMetadata || {}).toLowerCase();
      const sourceSignal = sourceBlob.includes("telemetry") || sourceBlob.includes("verified") ? 1 : 0;

      const combinedScore = score + graphScore + recencyScore + sourceSignal;

      if (combinedScore > 0) {
        const weightedScore = combinedScore * (0.5 + 0.5 * clampProvenanceScore(provenanceScore));
        results.push({
          source,
          key,
          payload,
          score: Number(weightedScore.toFixed(4)),
          graphScore: Number(graphScore.toFixed(4)),
          recencyScore,
          sourceSignal,
          provenanceScore: clampProvenanceScore(provenanceScore),
          sourceMetadata,
          updatedAt
        });
      }
    };

    for (const [key, entry] of this.indexes.taskMetadata.entries()) {
      rankRecord({
        source: "task",
        key,
        payload: entry.payload,
        updatedAt: entry.updatedAt,
        provenanceScore: entry.provenanceScore,
        expiresAt: entry.expiresAt,
        sourceMetadata: entry.sourceMetadata
      });
    }

    for (const [key, entry] of this.indexes.repositoryMetadata.entries()) {
      const graphRecord = this.indexes.repositoryGraph.get(key);
      rankRecord({
        source: "repository",
        key,
        payload: entry.payload,
        updatedAt: entry.updatedAt,
        provenanceScore: entry.provenanceScore,
        expiresAt: entry.expiresAt,
        sourceMetadata: entry.sourceMetadata,
        graphPayload: graphRecord?.payload || null
      });
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
    let removedRepositoryGraph = 0;

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

    for (const [key, record] of this.indexes.repositoryGraph.entries()) {
      if (typeof record.expiresAt === "number" && record.expiresAt <= nowMs) {
        this.indexes.repositoryGraph.delete(key);
        removedRepositoryGraph += 1;
      }
    }

    return {
      taskMetadata: removedTaskMetadata,
      repositoryMetadata: removedRepositoryMetadata,
      repositoryGraph: removedRepositoryGraph,
      total: removedTaskMetadata + removedRepositoryMetadata + removedRepositoryGraph
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
    const repositoryGraphEntries = [...this.indexes.repositoryGraph.entries()].sort(sortEntries);

    this.indexes.taskMetadata = new Map(taskEntries);
    this.indexes.repositoryMetadata = new Map(repositoryEntries);
    this.indexes.repositoryGraph = new Map(repositoryGraphEntries);

    return {
      taskMetadata: taskEntries.length,
      repositoryMetadata: repositoryEntries.length,
      repositoryGraph: repositoryGraphEntries.length,
      total: taskEntries.length + repositoryEntries.length + repositoryGraphEntries.length
    };
  }

  compactAndArchive(options = {}) {
    const nowMs = typeof options.nowMs === "number" ? options.nowMs : Date.now();
    const maxAgeMs = typeof options.maxAgeMs === "number" ? options.maxAgeMs : 30 * 24 * 60 * 60 * 1000;
    const minProvenanceScore = typeof options.minProvenanceScore === "number" ? options.minProvenanceScore : 0.35;
    const archiveLimit = typeof options.archiveLimit === "number" ? options.archiveLimit : 200;

    let compactedMemoryEntries = 0;
    let compactedIndexedEntries = 0;
    const archivedMemoryEntries = [];
    const archivedIndexedEntries = [];

    const evaluateMemoryEntry = (layerName, key, entry) => {
      const ageMs = typeof entry.updatedAt === "number" ? nowMs - entry.updatedAt : maxAgeMs + 1;
      const provenanceScore = clampProvenanceScore(entry?.metadata?.provenance?.score);
      const expired = isExpired(entry, nowMs);
      const staleLowValue = ageMs > maxAgeMs && provenanceScore < minProvenanceScore;
      return {
        shouldArchive: expired || staleLowValue,
        reason: expired ? "expired" : staleLowValue ? "stale_low_value" : "retain",
        archiveRecord: {
          key,
          layer: layerName,
          reason: expired ? "expired" : "stale_low_value",
          archivedAt: nowMs,
          entry
        }
      };
    };

    for (const [layerName, layer] of Object.entries(this.layers)) {
      for (const [key, entry] of layer.entries()) {
        const evaluation = evaluateMemoryEntry(layerName, key, entry);
        if (!evaluation.shouldArchive) {
          continue;
        }

        layer.delete(key);
        compactedMemoryEntries += 1;
        archivedMemoryEntries.push(evaluation.archiveRecord);
      }
    }

    const compactIndex = (indexName, index) => {
      for (const [key, entry] of index.entries()) {
        const provenanceScore = clampProvenanceScore(entry?.metadata?.provenance?.score ?? entry?.provenanceScore);
        const ageMs = typeof entry.updatedAt === "number" ? nowMs - entry.updatedAt : maxAgeMs + 1;
        const expired = typeof entry.expiresAt === "number" && entry.expiresAt <= nowMs;
        const staleLowValue = ageMs > maxAgeMs && provenanceScore < minProvenanceScore;

        if (!expired && !staleLowValue) {
          continue;
        }

        index.delete(key);
        compactedIndexedEntries += 1;
        archivedIndexedEntries.push({
          key,
          indexName,
          reason: expired ? "expired" : "stale_low_value",
          archivedAt: nowMs,
          entry
        });
      }
    };

    compactIndex("taskMetadata", this.indexes.taskMetadata);
    compactIndex("repositoryMetadata", this.indexes.repositoryMetadata);
    compactIndex("repositoryGraph", this.indexes.repositoryGraph);

    archivedMemoryEntries.sort((left, right) => String(left.key).localeCompare(String(right.key)));
    archivedIndexedEntries.sort((left, right) => String(left.key).localeCompare(String(right.key)));

    this.archives.memoryEntries = [
      ...this.archives.memoryEntries,
      ...archivedMemoryEntries
    ].slice(-archiveLimit);
    this.archives.indexedMetadata = [
      ...this.archives.indexedMetadata,
      ...archivedIndexedEntries
    ].slice(-archiveLimit);

    return {
      generatedAt: nowMs,
      compactedMemoryEntries,
      compactedIndexedEntries,
      archivedMemoryEntries: archivedMemoryEntries.length,
      archivedIndexedEntries: archivedIndexedEntries.length,
      archiveTotals: {
        memoryEntries: this.archives.memoryEntries.length,
        indexedMetadata: this.archives.indexedMetadata.length
      }
    };
  }

  getArchiveSnapshot(limit = 20) {
    const safeLimit = Math.max(1, Number(limit) || 20);
    return {
      memoryEntries: this.archives.memoryEntries.slice(-safeLimit),
      indexedMetadata: this.archives.indexedMetadata.slice(-safeLimit)
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
      working: serializeScope(this.layers.working),
      episodic: serializeScope(this.layers.episodic),
      semantic: serializeScope(this.layers.semantic),
      procedural: serializeScope(this.layers.procedural),
      taskMetadata: serializeScope(this.indexes.taskMetadata),
      repositoryMetadata: serializeScope(this.indexes.repositoryMetadata),
      repositoryGraph: serializeScope(this.indexes.repositoryGraph),
      archives: {
        memoryEntries: [...this.archives.memoryEntries],
        indexedMetadata: [...this.archives.indexedMetadata]
      }
    };
  }

  importState(state = {}) {
    const restoreLayer = (layerName, primaryStateKey, fallbackStateKey = null) => {
      const layer = this.layers[layerName];
      layer.clear();

      const primaryItems = Array.isArray(state[primaryStateKey]) ? state[primaryStateKey] : [];
      const fallbackItems = fallbackStateKey && Array.isArray(state[fallbackStateKey])
        ? state[fallbackStateKey]
        : [];
      const items = primaryItems.length > 0 ? primaryItems : fallbackItems;

      for (const item of items) {
        if (!Array.isArray(item) || item.length !== 2) continue;
        const [key, entry] = item;
        layer.set(key, entry);
      }
    };

    restoreLayer("working", "working", "session");
    restoreLayer("semantic", "semantic", "repository");
    restoreLayer("procedural", "procedural", "patterns");
    restoreLayer("episodic", "episodic");

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
    restoreIndex("repositoryGraph");

    this.archives = {
      memoryEntries: Array.isArray(state?.archives?.memoryEntries) ? state.archives.memoryEntries : [],
      indexedMetadata: Array.isArray(state?.archives?.indexedMetadata) ? state.archives.indexedMetadata : []
    };
  }
}
