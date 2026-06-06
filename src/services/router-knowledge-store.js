/**
 * RouterKnowledgeStore
 *
 * Local-first router knowledge storage:
 * - Always persists records to local disk (no API key required)
 * - Optionally computes embeddings (local first, OpenAI fallback)
 * - Optionally indexes in Weaviate using explicit vectors (vectorizer: none)
 * - Falls back to lexical lookup when vector lookup is unavailable
 */

import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import https from "node:https";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const WEAVIATE_CLASS = "RouterKnowledgeV2";
const SIMILARITY_THRESHOLD = 0.88;
const LOOKUP_TIMEOUT_MS = 700;
const STORE_TIMEOUT_MS = 1200;
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_RESET_MS = 30_000;
const LEXICAL_THRESHOLD = 0.18;

function asBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") return defaultValue;
  const normal = String(value).trim().toLowerCase();
  return normal === "1" || normal === "true" || normal === "yes" || normal === "on";
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value) {
  const parts = normalizeText(value).split(" ");
  return parts.filter((token) => token.length >= 3);
}

function jaccardScore(aTokens, bTokens) {
  if (aTokens.length === 0 || bTokens.length === 0) return 0;
  const aSet = new Set(aTokens);
  const bSet = new Set(bTokens);
  let intersection = 0;
  for (const token of aSet) {
    if (bSet.has(token)) intersection += 1;
  }
  const union = new Set([...aSet, ...bSet]).size;
  return union === 0 ? 0 : intersection / union;
}

function resolveDefaultStoragePath() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.join(__dirname, "..", "..", "data", "router-knowledge-store.json");
}

function ensureDirectory(filePath) {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true });
}

// ── Minimal HTTP helper ──────────────────────────────────────────────────────

function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const transport = parsed.protocol === "https:" ? https : http;
    const timeoutMs = options.timeoutMs || 5000;

    const reqOptions = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: options.method || "GET",
      headers: {
        "content-type": "application/json",
        "accept": "application/json",
        ...(options.headers || {})
      }
    };

    const req = transport.request(reqOptions, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        try {
          resolve({ status: res.statusCode, body: raw ? JSON.parse(raw) : null });
        } catch {
          resolve({ status: res.statusCode, body: raw });
        }
      });
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`HTTP request timed out after ${timeoutMs}ms`));
    });

    req.on("error", reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

// ── Circuit Breaker ──────────────────────────────────────────────────────────

class CircuitBreaker {
  constructor({ threshold = CIRCUIT_BREAKER_THRESHOLD, resetMs = CIRCUIT_BREAKER_RESET_MS } = {}) {
    this.threshold = threshold;
    this.resetMs = resetMs;
    this.failures = 0;
    this.openedAt = null;
    this.state = "closed"; // closed | open | half-open
  }

  get isOpen() {
    if (this.state !== "open") return false;
    if (Date.now() - this.openedAt >= this.resetMs) {
      this.state = "half-open";
      return false;
    }
    return true;
  }

  recordSuccess() {
    this.failures = 0;
    this.state = "closed";
    this.openedAt = null;
  }

  recordFailure() {
    this.failures += 1;
    if (this.failures >= this.threshold) {
      this.state = "open";
      this.openedAt = Date.now();
    }
  }

  toJSON() {
    return { state: this.state, failures: this.failures, openedAt: this.openedAt };
  }
}

// ── Weaviate schema for explicit vectors ─────────────────────────────────────

async function ensureSchema(weaviateUrl) {
  const existing = await httpRequest(`${weaviateUrl}/v1/schema/${WEAVIATE_CLASS}`, {
    timeoutMs: 3000
  });

  if (existing.status === 200) return { ok: true, created: false };

  const classSchema = {
    class: WEAVIATE_CLASS,
    description: "Router decisions indexed with app-provided vectors.",
    vectorizer: "none",
    properties: [
      { name: "recordId", dataType: ["text"], description: "Local record id" },
      { name: "promptText", dataType: ["text"], description: "Original prompt text" },
      { name: "taskDomain", dataType: ["text"], description: "Classified task domain" },
      { name: "taskRisk", dataType: ["text"], description: "Task risk level" },
      { name: "selectedAgent", dataType: ["text"], description: "Selected specialist" },
      { name: "routingConfidence", dataType: ["number"], description: "Routing confidence" },
      { name: "fallbackChain", dataType: ["text"], description: "JSON fallback list" },
      { name: "routingSummary", dataType: ["text"], description: "Routing summary" },
      { name: "createdAt", dataType: ["text"], description: "ISO timestamp" },
      { name: "embeddingProvider", dataType: ["text"], description: "local|openai|none" }
    ]
  };

  const created = await httpRequest(`${weaviateUrl}/v1/schema`, {
    method: "POST",
    body: classSchema,
    timeoutMs: 5000
  });

  if (created.status === 200 || created.status === 201) {
    return { ok: true, created: true };
  }

  return {
    ok: false,
    error: `Schema creation returned HTTP ${created.status}`,
    body: created.body
  };
}

// ── RouterKnowledgeStore ─────────────────────────────────────────────────────

export class RouterKnowledgeStore {
  constructor(options = {}) {
    this.weaviateUrl = (options.weaviateUrl || process.env.WEAVIATE_URL || "http://localhost:8080").replace(/\/$/, "");
    this.similarityThreshold = options.similarityThreshold ?? SIMILARITY_THRESHOLD;
    this.enabled = options.enabled !== false;

    this.localStorePath = options.localStorePath || process.env.ROUTER_KNOWLEDGE_LOCAL_STORE_PATH || resolveDefaultStoragePath();
    this.weaviateIndexEnabled = options.weaviateIndexEnabled ?? asBoolean(process.env.ROUTER_KNOWLEDGE_WEAVIATE_INDEX_ENABLED, true);

    this.localEmbeddingUrl = options.localEmbeddingUrl || process.env.ROUTER_KNOWLEDGE_LOCAL_EMBEDDING_URL || "http://host.docker.internal:11434/api/embeddings";
    this.localEmbeddingModel = options.localEmbeddingModel || process.env.ROUTER_KNOWLEDGE_LOCAL_EMBEDDING_MODEL || "nomic-embed-text";
    this.openAiEmbeddingModel = options.openAiEmbeddingModel || process.env.ROUTER_KNOWLEDGE_OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";

    const embeddingOrderRaw =
      options.embeddingProviderOrder ??
      process.env.ROUTER_KNOWLEDGE_EMBEDDING_ORDER ??
      "local,openai";
    const embeddingOrderList = Array.isArray(embeddingOrderRaw)
      ? embeddingOrderRaw
      : String(embeddingOrderRaw).split(",");
    this.embeddingProviderOrder = embeddingOrderList
      .map((item) => String(item).trim().toLowerCase())
      .filter(Boolean);

    this.anthropicScoringEnabled = options.anthropicScoringEnabled ?? asBoolean(process.env.ROUTER_KNOWLEDGE_ANTHROPIC_SCORING_ENABLED, false);

    this.circuitBreaker = new CircuitBreaker();
    this._schemaReady = false;
    this._schemaInitPromise = null;
    this._memoryCache = null;
    this._pendingWrites = [];

    ensureDirectory(this.localStorePath);
    this._ensureLocalStoreFile();
  }

  _ensureLocalStoreFile() {
    if (fs.existsSync(this.localStorePath)) return;
    this._writeLocalStore({ version: 1, records: [] });
  }

  _readLocalStore() {
    if (this._memoryCache) {
      return this._memoryCache;
    }
    try {
      const raw = fs.readFileSync(this.localStorePath, "utf8");
      const parsed = JSON.parse(raw || "{}");
      if (!Array.isArray(parsed.records)) {
        this._memoryCache = { version: 1, records: [] };
      } else {
        this._memoryCache = parsed;
      }
      return this._memoryCache;
    } catch {
      this._memoryCache = { version: 1, records: [] };
      return this._memoryCache;
    }
  }

  _writeLocalStore(state) {
    this._memoryCache = state;
    const tempPath = `${this.localStorePath}.${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`;
    const promise = fs.promises.writeFile(tempPath, JSON.stringify(state, null, 2), "utf8")
      .then(() => fs.promises.rename(tempPath, this.localStorePath))
      .catch((err) => {
        console.error("[RouterKnowledgeStore] Async disk write failed:", err.message);
      })
      .finally(() => {
        const idx = this._pendingWrites.indexOf(promise);
        if (idx > -1) {
          this._pendingWrites.splice(idx, 1);
        }
      });
    this._pendingWrites.push(promise);
  }

  async flushPendingWrites() {
    await Promise.all(this._pendingWrites);
  }

  _appendLocalRecord(record) {
    const state = this._readLocalStore();
    state.records.push(record);
    this._writeLocalStore(state);
  }

  _patchLocalRecord(recordId, patch) {
    const state = this._readLocalStore();
    const index = state.records.findIndex((record) => record.id === recordId);
    if (index < 0) return;
    state.records[index] = { ...state.records[index], ...patch, updatedAt: new Date().toISOString() };
    this._writeLocalStore(state);
  }

  _loadFilteredRecords(filters = {}) {
    const state = this._readLocalStore();
    return state.records.filter((record) => {
      if (filters.taskDomain && String(record.taskDomain) !== String(filters.taskDomain)) return false;
      if (filters.taskRisk && String(record.taskRisk) !== String(filters.taskRisk)) return false;
      return true;
    });
  }

  // Lazy schema init — only runs once, on first vector operation
  async _ensureSchema() {
    if (!this.weaviateIndexEnabled) return false;
    if (this._schemaReady) return true;
    if (this._schemaInitPromise) return this._schemaInitPromise;

    this._schemaInitPromise = ensureSchema(this.weaviateUrl)
      .then((result) => {
        if (result.ok) {
          this._schemaReady = true;
          return true;
        }
        console.warn("[RouterKnowledgeStore] Schema init failed:", result.error);
        return false;
      })
      .catch((err) => {
        console.warn("[RouterKnowledgeStore] Schema init error:", err.message);
        return false;
      })
      .finally(() => {
        this._schemaInitPromise = null;
      });

    return this._schemaInitPromise;
  }

  async lookup(promptText, filters = {}) {
    if (!this.enabled || this.circuitBreaker.isOpen) return null;
    if (!promptText || typeof promptText !== "string") return null;

    try {
      const vectorHit = await this._lookupByVector(promptText, filters);
      if (vectorHit) {
        this.circuitBreaker.recordSuccess();
        return { ...vectorHit, source: "vector" };
      }

      const lexicalHit = await this._lookupLexical(promptText, filters);
      this.circuitBreaker.recordSuccess();
      return lexicalHit ? { ...lexicalHit, source: "lexical" } : null;
    } catch {
      this.circuitBreaker.recordFailure();
      return this._lookupLexical(promptText, filters);
    }
  }

  store(entry) {
    if (!this.enabled || this.circuitBreaker.isOpen) return;
    if (!entry?.promptText || !entry?.selectedAgent) return;

    const record = {
      id: randomUUID(),
      promptText: String(entry.promptText),
      taskDomain: String(entry.taskDomain || "general"),
      taskRisk: String(entry.taskRisk || "MEDIUM"),
      selectedAgent: String(entry.selectedAgent),
      routingConfidence: Number(entry.routingConfidence) || 0,
      fallbackChain: Array.isArray(entry.fallbackChain) ? entry.fallbackChain : [],
      routingSummary: String(entry.routingSummary || ""),
      createdAt: new Date().toISOString(),
      updatedAt: null,
      embeddingStatus: "pending",
      embeddingProvider: "none",
      embedding: null,
      weaviateIndexed: false,
      lastError: null
    };

    // Local-first durability: this write succeeds even when all providers are unavailable.
    this._appendLocalRecord(record);

    setImmediate(() => {
      this._storeAsync(record).catch((err) => {
        this._patchLocalRecord(record.id, {
          embeddingStatus: "failed",
          lastError: String(err?.message || err)
        });
      });
    });
  }

  async _storeAsync(record) {
    const embeddingResult = await this._embedText(record.promptText);

    if (!embeddingResult.embedding || embeddingResult.embedding.length === 0) {
      this._patchLocalRecord(record.id, {
        embeddingStatus: "skipped",
        embeddingProvider: embeddingResult.provider,
        lastError: embeddingResult.error || "No embedding provider available"
      });
      return;
    }

    this._patchLocalRecord(record.id, {
      embeddingStatus: "ready",
      embeddingProvider: embeddingResult.provider,
      embedding: embeddingResult.embedding,
      lastError: null
    });

    if (!this.weaviateIndexEnabled) return;

    const schemaReady = await this._ensureSchema();
    if (!schemaReady) {
      this._patchLocalRecord(record.id, {
        weaviateIndexed: false,
        lastError: "Weaviate schema unavailable"
      });
      return;
    }

    const object = {
      class: WEAVIATE_CLASS,
      id: record.id,
      vector: embeddingResult.embedding,
      properties: {
        recordId: record.id,
        promptText: record.promptText,
        taskDomain: record.taskDomain,
        taskRisk: record.taskRisk,
        selectedAgent: record.selectedAgent,
        routingConfidence: record.routingConfidence,
        fallbackChain: JSON.stringify(record.fallbackChain),
        routingSummary: record.routingSummary,
        createdAt: record.createdAt,
        embeddingProvider: embeddingResult.provider
      }
    };

    const response = await httpRequest(`${this.weaviateUrl}/v1/objects`, {
      method: "POST",
      body: object,
      timeoutMs: STORE_TIMEOUT_MS
    });

    if (response.status === 200 || response.status === 201) {
      this._patchLocalRecord(record.id, { weaviateIndexed: true, lastError: null });
      this.circuitBreaker.recordSuccess();
      return;
    }

    this._patchLocalRecord(record.id, {
      weaviateIndexed: false,
      lastError: `Weaviate index failed with HTTP ${response.status}`
    });
    this.circuitBreaker.recordFailure();
  }

  async _lookupByVector(promptText, filters) {
    if (!this.weaviateIndexEnabled) return null;

    const queryEmbedding = await this._embedText(promptText);
    if (!queryEmbedding.embedding || queryEmbedding.embedding.length === 0) return null;

    const schemaReady = await this._ensureSchema();
    if (!schemaReady) return null;

    const whereFilter = this._buildWhereFilter(filters);
    const graphqlQuery = {
      query: `{
        Get {
          ${WEAVIATE_CLASS}(
            nearVector: {
              vector: ${JSON.stringify(queryEmbedding.embedding)}
              certainty: ${this.similarityThreshold}
            }
            limit: 1
            ${whereFilter ? `where: ${whereFilter}` : ""}
          ) {
            recordId
            promptText
            taskDomain
            taskRisk
            selectedAgent
            routingConfidence
            fallbackChain
            routingSummary
            createdAt
            embeddingProvider
            _additional { certainty id }
          }
        }
      }`
    };

    const response = await httpRequest(`${this.weaviateUrl}/v1/graphql`, {
      method: "POST",
      body: graphqlQuery,
      timeoutMs: LOOKUP_TIMEOUT_MS
    });

    if (response.status !== 200) return null;

    const results = response.body?.data?.Get?.[WEAVIATE_CLASS];
    if (!Array.isArray(results) || results.length === 0) return null;

    const hit = results[0];
    const certainty = Number(hit?._additional?.certainty || 0);
    if (certainty < this.similarityThreshold) return null;

    return {
      recordId: hit.recordId || hit._additional?.id || null,
      promptText: hit.promptText,
      taskDomain: hit.taskDomain,
      taskRisk: hit.taskRisk,
      selectedAgent: hit.selectedAgent,
      routingConfidence: hit.routingConfidence,
      fallbackChain: hit.fallbackChain ? JSON.parse(hit.fallbackChain) : [],
      routingSummary: hit.routingSummary,
      createdAt: hit.createdAt,
      similarity: certainty,
      embeddingProvider: hit.embeddingProvider || queryEmbedding.provider,
      weaviateId: hit._additional?.id
    };
  }

  async _lookupLexical(promptText, filters) {
    const query = String(promptText);
    const queryTokens = tokenize(query);
    const normalizedQuery = normalizeText(query);

    const records = this._loadFilteredRecords(filters).slice(-2000);
    if (records.length === 0) return null;

    const scored = records
      .map((record) => {
        const text = `${record.promptText} ${record.routingSummary || ""}`;
        const normalizedText = normalizeText(text);
        const tokenScore = jaccardScore(queryTokens, tokenize(text));

        let containsBonus = 0;
        if (normalizedText.includes(normalizedQuery) || normalizedQuery.includes(normalizedText)) {
          containsBonus = 0.2;
        }

        const domainBonus = filters.taskDomain && record.taskDomain === filters.taskDomain ? 0.05 : 0;
        const riskBonus = filters.taskRisk && record.taskRisk === filters.taskRisk ? 0.05 : 0;

        const score = Math.min(1, tokenScore + containsBonus + domainBonus + riskBonus);

        return { record, score };
      })
      .sort((a, b) => b.score - a.score);

    const shortlist = scored.slice(0, 5);
    const anthropicBest = await this._anthropicRescoreIfEnabled(query, shortlist);
    const best = anthropicBest || shortlist[0];

    if (!best || best.score < LEXICAL_THRESHOLD) return null;

    return {
      recordId: best.record.id,
      promptText: best.record.promptText,
      taskDomain: best.record.taskDomain,
      taskRisk: best.record.taskRisk,
      selectedAgent: best.record.selectedAgent,
      routingConfidence: best.record.routingConfidence,
      fallbackChain: best.record.fallbackChain || [],
      routingSummary: best.record.routingSummary,
      createdAt: best.record.createdAt,
      similarity: best.score,
      embeddingProvider: best.record.embeddingProvider || "none"
    };
  }

  async _anthropicRescoreIfEnabled(query, shortlist) {
    if (!this.anthropicScoringEnabled || shortlist.length === 0) return null;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;

    const model = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022";

    try {
      const candidatesPrompt = shortlist.map((candidate, idx) => {
        return `Index ${idx}: Prompt: "${candidate.record.promptText}" | Summary: "${candidate.record.routingSummary || ""}"`;
      }).join("\n");

      const promptText = 
        "Return a JSON array containing similarity scores between 0 and 1 for each of the following candidate entries relative to the query.\n" +
        "You must return ONLY the JSON array of numbers, matching the candidate indices (e.g. [0.85, 0.42, 0.1]). Do not include any explanations, markdown syntax, or other characters.\n\n" +
        `Query: "${query}"\n\n` +
        "Candidates:\n" +
        candidatesPrompt;

      const response = await httpRequest("https://api.anthropic.com/v1/messages", {
        method: "POST",
        timeoutMs: 2000,
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: {
          model,
          max_tokens: 150,
          temperature: 0,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: promptText
                }
              ]
            }
          ]
        }
      });

      if (response.status !== 200) return null;
      const text = String(response.body?.content?.[0]?.text || "").trim();
      const jsonStart = text.indexOf("[");
      const jsonEnd = text.lastIndexOf("]");
      if (jsonStart < 0 || jsonEnd < 0 || jsonEnd <= jsonStart) return null;
      const scores = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
      if (!Array.isArray(scores)) return null;

      let best = null;
      shortlist.forEach((candidate, idx) => {
        const scoreVal = Number(scores[idx]);
        if (Number.isFinite(scoreVal)) {
          const mergedScore = Math.max(candidate.score, Math.min(scoreVal, 1));
          if (!best || mergedScore > best.score) {
            best = { record: candidate.record, score: mergedScore };
          }
        }
      });

      return best;
    } catch {
      return null;
    }
  }

  async _embedText(text) {
    const normalized = String(text || "").trim();
    if (!normalized) {
      return { provider: "none", embedding: null, error: "Empty text" };
    }

    const providerErrors = [];

    for (const provider of this.embeddingProviderOrder) {
      if (provider === "local") {
        const local = await this._embedWithLocalProvider(normalized);
        if (local.embedding) return local;
        providerErrors.push(local.error || "local embedding unavailable");
      }

      if (provider === "openai") {
        const openAi = await this._embedWithOpenAi(normalized);
        if (openAi.embedding) return openAi;
        providerErrors.push(openAi.error || "openai embedding unavailable");
      }
    }

    return {
      provider: "none",
      embedding: null,
      error: providerErrors.join("; ") || "No configured embedding provider"
    };
  }

  async _embedWithLocalProvider(text) {
    try {
      const response = await httpRequest(this.localEmbeddingUrl, {
        method: "POST",
        timeoutMs: 1200,
        body: {
          model: this.localEmbeddingModel,
          prompt: text
        }
      });

      if (response.status !== 200) {
        return { provider: "local", embedding: null, error: `Local embedding HTTP ${response.status}` };
      }

      const vector = response.body?.embedding;
      if (!Array.isArray(vector) || vector.length === 0) {
        return { provider: "local", embedding: null, error: "Local embedding response missing vector" };
      }

      return { provider: "local", embedding: vector, error: null };
    } catch (err) {
      return { provider: "local", embedding: null, error: err.message };
    }
  }

  async _embedWithOpenAi(text) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { provider: "openai", embedding: null, error: "OPENAI_API_KEY not set" };
    }

    try {
      const response = await httpRequest("https://api.openai.com/v1/embeddings", {
        method: "POST",
        timeoutMs: 2000,
        headers: {
          authorization: `Bearer ${apiKey}`
        },
        body: {
          model: this.openAiEmbeddingModel,
          input: text
        }
      });

      if (response.status !== 200) {
        return { provider: "openai", embedding: null, error: `OpenAI embedding HTTP ${response.status}` };
      }

      const vector = response.body?.data?.[0]?.embedding;
      if (!Array.isArray(vector) || vector.length === 0) {
        return { provider: "openai", embedding: null, error: "OpenAI response missing embedding vector" };
      }

      return { provider: "openai", embedding: vector, error: null };
    } catch (err) {
      return { provider: "openai", embedding: null, error: err.message };
    }
  }

  healthStatus() {
    const state = this._readLocalStore();
    const records = state.records || [];
    const pending = records.filter((item) => item.embeddingStatus === "pending").length;
    const ready = records.filter((item) => item.embeddingStatus === "ready").length;
    const failed = records.filter((item) => item.embeddingStatus === "failed").length;
    const skipped = records.filter((item) => item.embeddingStatus === "skipped").length;

    return {
      enabled: this.enabled,
      schemaReady: this._schemaReady,
      circuitBreaker: this.circuitBreaker.toJSON(),
      weaviateUrl: this.weaviateUrl,
      similarityThreshold: this.similarityThreshold,
      localStore: {
        path: this.localStorePath,
        records: records.length,
        pending,
        ready,
        failed,
        skipped
      },
      providers: {
        embeddingOrder: this.embeddingProviderOrder,
        localEmbeddingUrl: this.localEmbeddingUrl,
        localEmbeddingModel: this.localEmbeddingModel,
        openAiEmbeddingModel: this.openAiEmbeddingModel,
        anthropicScoringEnabled: this.anthropicScoringEnabled
      }
    };
  }

  _buildWhereFilter(filters) {
    const clauses = [];

    if (filters.taskDomain) {
      clauses.push(`{
        path: ["taskDomain"]
        operator: Equal
        valueText: "${String(filters.taskDomain).replace(/"/g, "")}" 
      }`);
    }

    if (filters.taskRisk) {
      clauses.push(`{
        path: ["taskRisk"]
        operator: Equal
        valueText: "${String(filters.taskRisk).replace(/"/g, "")}" 
      }`);
    }

    if (clauses.length === 0) return null;
    if (clauses.length === 1) return clauses[0];

    return `{ operator: And operands: [${clauses.join(", ")}] }`;
  }
}

let _instance = null;
export function getRouterKnowledgeStore(options) {
  if (!_instance) {
    _instance = new RouterKnowledgeStore(options);
  }
  return _instance;
}
