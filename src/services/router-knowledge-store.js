/**
 * RouterKnowledgeStore
 *
 * Semantic knowledge store for the AIEP router agent.
 * Persists routing decisions in Weaviate and enables semantic lookup
 * before dispatching to external LLMs, saving tokens on similar tasks.
 *
 * Design principles:
 * - FAIL OPEN: if AIEP or Weaviate is unreachable, routing continues normally
 * - ASYNC WRITE: store() never blocks the caller
 * - CIRCUIT BREAKER: opens after 3 consecutive failures, resets after 30s
 * - SEMANTIC SEARCH: Weaviate nearText via text2vec-openai module
 */

import http from "node:http";
import https from "node:https";

const WEAVIATE_CLASS = "RouterKnowledge";
const SIMILARITY_THRESHOLD = 0.88;
const LOOKUP_TIMEOUT_MS = 500;
const STORE_TIMEOUT_MS = 1000;
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_RESET_MS = 30_000;

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

// ── Weaviate Schema Bootstrap ────────────────────────────────────────────────

async function ensureSchema(weaviateUrl) {
  // Check if class already exists
  const existing = await httpRequest(`${weaviateUrl}/v1/schema/${WEAVIATE_CLASS}`, {
    timeoutMs: 3000
  });

  if (existing.status === 200) return { ok: true, created: false };

  // Create the class with text2vec-openai auto-vectorizer on promptText
  const classSchema = {
    class: WEAVIATE_CLASS,
    description: "Routing decisions made by the AIEP router agent, indexed for semantic retrieval.",
    vectorizer: "text2vec-openai",
    moduleConfig: {
      "text2vec-openai": {
        model: "text-embedding-3-small",
        type: "text"
      }
    },
    properties: [
      {
        name: "promptText",
        dataType: ["text"],
        description: "The full user prompt / task description",
        moduleConfig: {
          "text2vec-openai": { skip: false }
        }
      },
      {
        name: "taskDomain",
        dataType: ["text"],
        description: "Classified primary domain (e.g. backend, frontend, review)",
        moduleConfig: { "text2vec-openai": { skip: true } }
      },
      {
        name: "taskRisk",
        dataType: ["text"],
        description: "Risk level: LOW | MEDIUM | HIGH | CRITICAL",
        moduleConfig: { "text2vec-openai": { skip: true } }
      },
      {
        name: "selectedAgent",
        dataType: ["text"],
        description: "Agent selected by the router",
        moduleConfig: { "text2vec-openai": { skip: true } }
      },
      {
        name: "routingConfidence",
        dataType: ["number"],
        description: "Router confidence score 0-1",
        moduleConfig: { "text2vec-openai": { skip: true } }
      },
      {
        name: "fallbackChain",
        dataType: ["text"],
        description: "JSON-serialised fallback agent list",
        moduleConfig: { "text2vec-openai": { skip: true } }
      },
      {
        name: "routingSummary",
        dataType: ["text"],
        description: "Human-readable routing rationale / work summary",
        moduleConfig: { "text2vec-openai": { skip: false } }
      },
      {
        name: "createdAt",
        dataType: ["text"],
        description: "ISO 8601 timestamp",
        moduleConfig: { "text2vec-openai": { skip: true } }
      }
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

  return { ok: false, error: `Schema creation returned HTTP ${created.status}`, body: created.body };
}

// ── RouterKnowledgeStore ─────────────────────────────────────────────────────

export class RouterKnowledgeStore {
  /**
   * @param {object} options
   * @param {string} [options.weaviateUrl]   Default: http://localhost:8080
   * @param {number} [options.similarityThreshold]  Default: 0.88
   * @param {boolean} [options.enabled]  Default: true — set false to disable entirely
   */
  constructor(options = {}) {
    this.weaviateUrl = (options.weaviateUrl || process.env.WEAVIATE_URL || "http://localhost:8080").replace(/\/$/, "");
    this.similarityThreshold = options.similarityThreshold ?? SIMILARITY_THRESHOLD;
    this.enabled = options.enabled !== false;
    this.circuitBreaker = new CircuitBreaker();
    this._schemaReady = false;
    this._schemaInitPromise = null;
  }

  // Lazy schema init — only runs once, on first real operation
  async _ensureSchema() {
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

  /**
   * Semantic lookup: find the closest routing decision for a given prompt.
   * Returns null on miss, timeout, or circuit-open — never throws.
   *
   * @param {string} promptText
   * @param {object} [filters]  optional { taskDomain, taskRisk }
   * @returns {Promise<object|null>} matched RouterKnowledge object or null
   */
  async lookup(promptText, filters = {}) {
    if (!this.enabled || this.circuitBreaker.isOpen) return null;
    if (!promptText || typeof promptText !== "string") return null;

    try {
      const schemaReady = await this._ensureSchema();
      if (!schemaReady) return null;

      const whereFilter = this._buildWhereFilter(filters);

      const graphqlQuery = {
        query: `{
          Get {
            ${WEAVIATE_CLASS}(
              nearText: {
                concepts: ${JSON.stringify([promptText])}
                certainty: ${this.similarityThreshold}
              }
              limit: 1
              ${whereFilter ? `where: ${whereFilter}` : ""}
            ) {
              promptText
              taskDomain
              taskRisk
              selectedAgent
              routingConfidence
              fallbackChain
              routingSummary
              createdAt
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

      if (response.status !== 200) {
        this.circuitBreaker.recordFailure();
        return null;
      }

      const results = response.body?.data?.Get?.[WEAVIATE_CLASS];
      if (!Array.isArray(results) || results.length === 0) {
        this.circuitBreaker.recordSuccess();
        return null;
      }

      const hit = results[0];
      const certainty = hit._additional?.certainty ?? 0;

      if (certainty < this.similarityThreshold) {
        this.circuitBreaker.recordSuccess();
        return null;
      }

      this.circuitBreaker.recordSuccess();
      return {
        promptText: hit.promptText,
        taskDomain: hit.taskDomain,
        taskRisk: hit.taskRisk,
        selectedAgent: hit.selectedAgent,
        routingConfidence: hit.routingConfidence,
        fallbackChain: hit.fallbackChain ? JSON.parse(hit.fallbackChain) : [],
        routingSummary: hit.routingSummary,
        createdAt: hit.createdAt,
        similarity: certainty,
        weaviateId: hit._additional?.id
      };
    } catch (err) {
      this.circuitBreaker.recordFailure();
      // Fail open — never propagate errors to caller
      return null;
    }
  }

  /**
   * Asynchronously store a routing decision. Fire-and-forget — never blocks caller.
   *
   * @param {object} entry
   * @param {string} entry.promptText
   * @param {string} entry.taskDomain
   * @param {string} entry.taskRisk
   * @param {string} entry.selectedAgent
   * @param {number} entry.routingConfidence
   * @param {string[]} entry.fallbackChain
   * @param {string} entry.routingSummary
   */
  store(entry) {
    if (!this.enabled || this.circuitBreaker.isOpen) return;
    if (!entry?.promptText || !entry?.selectedAgent) return;

    // Intentional fire-and-forget — setImmediate defers past current call stack
    setImmediate(() => {
      this._storeAsync(entry).catch((err) => {
        // Silently swallow — store failure must never surface to caller
        console.warn("[RouterKnowledgeStore] Async store failed:", err.message);
      });
    });
  }

  async _storeAsync(entry) {
    const schemaReady = await this._ensureSchema();
    if (!schemaReady) return;

    const object = {
      class: WEAVIATE_CLASS,
      properties: {
        promptText: String(entry.promptText),
        taskDomain: String(entry.taskDomain || "general"),
        taskRisk: String(entry.taskRisk || "MEDIUM"),
        selectedAgent: String(entry.selectedAgent),
        routingConfidence: Number(entry.routingConfidence) || 0,
        fallbackChain: JSON.stringify(Array.isArray(entry.fallbackChain) ? entry.fallbackChain : []),
        routingSummary: String(entry.routingSummary || ""),
        createdAt: new Date().toISOString()
      }
    };

    const response = await httpRequest(`${this.weaviateUrl}/v1/objects`, {
      method: "POST",
      body: object,
      timeoutMs: STORE_TIMEOUT_MS
    });

    if (response.status === 200 || response.status === 201) {
      this.circuitBreaker.recordSuccess();
    } else {
      this.circuitBreaker.recordFailure();
    }
  }

  /** Returns current circuit breaker status and schema state for health endpoint */
  healthStatus() {
    return {
      enabled: this.enabled,
      schemaReady: this._schemaReady,
      circuitBreaker: this.circuitBreaker.toJSON(),
      weaviateUrl: this.weaviateUrl,
      similarityThreshold: this.similarityThreshold
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

// Singleton factory — re-used across routes so circuit breaker state is shared
let _instance = null;
export function getRouterKnowledgeStore(options) {
  if (!_instance) {
    _instance = new RouterKnowledgeStore(options);
  }
  return _instance;
}
