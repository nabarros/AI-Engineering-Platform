/**
 * Router Knowledge MCP Server
 *
 * Exposes the RouterKnowledgeStore as a Model Context Protocol (MCP) server
 * so VS Code Copilot and the AIEP router agent can call local knowledge tools.
 *
 * Transport: HTTP + JSON-RPC 2.0 (Streamable HTTP — MCP spec §3.3)
 * Port: 8791
 *
 * Tools exposed:
 *   aiep_knowledge_lookup  — semantic search for matching routing decisions
 *   aiep_knowledge_store   — persist a new routing decision (async)
 *   aiep_knowledge_health  — circuit breaker + schema status
 */

import http from "node:http";
import { getRouterKnowledgeStore } from "../services/router-knowledge-store.js";

const MCP_PORT = Number(process.env.MCP_KNOWLEDGE_PORT || 8791);

// ── JSON-RPC helpers ─────────────────────────────────────────────────────────

function jsonRpcSuccess(id, result) {
  return { jsonrpc: "2.0", id, result };
}

function jsonRpcError(id, code, message, data) {
  return {
    jsonrpc: "2.0",
    id,
    error: { code, message, ...(data !== undefined ? { data } : {}) }
  };
}

// ── Tool definitions (MCP tools/list) ────────────────────────────────────────

const TOOLS = [
  {
    name: "aiep_knowledge_lookup",
    description: "Semantic search in the local AIEP router knowledge base. Returns the best matching routing decision for a given prompt, or null on miss. Use before routing to save tokens.",
    inputSchema: {
      type: "object",
      properties: {
        promptText: {
          type: "string",
          description: "The user prompt or task description to look up"
        },
        taskDomain: {
          type: "string",
          description: "Optional domain filter (e.g. 'backend', 'frontend', 'review')"
        },
        taskRisk: {
          type: "string",
          description: "Optional risk filter: LOW | MEDIUM | HIGH | CRITICAL"
        }
      },
      required: ["promptText"]
    }
  },
  {
    name: "aiep_knowledge_store",
    description: "Persist a routing decision in the local AIEP knowledge base for future reuse. Fire-and-forget — returns immediately without waiting for storage.",
    inputSchema: {
      type: "object",
      properties: {
        promptText: { type: "string", description: "The original user prompt" },
        taskDomain: { type: "string", description: "Classified domain" },
        taskRisk: { type: "string", description: "Risk level" },
        selectedAgent: { type: "string", description: "Agent that was selected" },
        routingConfidence: { type: "number", description: "Confidence score 0-1" },
        fallbackChain: {
          type: "array",
          items: { type: "string" },
          description: "Ordered fallback agent IDs"
        },
        routingSummary: {
          type: "string",
          description: "Brief summary of routing rationale and work completed"
        }
      },
      required: ["promptText", "selectedAgent"]
    }
  },
  {
    name: "aiep_knowledge_health",
    description: "Returns the health status of the local AIEP knowledge store including circuit breaker state and Weaviate schema readiness.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  }
];

// ── Request handler ──────────────────────────────────────────────────────────

async function handleMcpRequest(body, store) {
  const { jsonrpc, id, method, params } = body || {};

  if (jsonrpc !== "2.0") {
    return jsonRpcError(id ?? null, -32600, "Invalid Request: jsonrpc must be '2.0'");
  }

  // ── initialize ──────────────────────────────────────────────────────────
  if (method === "initialize") {
    return jsonRpcSuccess(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "aiep-router-knowledge", version: "1.0.0" }
    });
  }

  // ── tools/list ──────────────────────────────────────────────────────────
  if (method === "tools/list") {
    return jsonRpcSuccess(id, { tools: TOOLS });
  }

  // ── tools/call ──────────────────────────────────────────────────────────
  if (method === "tools/call") {
    const toolName = params?.name;
    const args = params?.arguments || {};

    if (toolName === "aiep_knowledge_lookup") {
      if (!args.promptText) {
        return jsonRpcError(id, -32602, "Invalid params: promptText is required");
      }

      const hit = await store.lookup(args.promptText, {
        taskDomain: args.taskDomain,
        taskRisk: args.taskRisk
      });

      return jsonRpcSuccess(id, {
        content: [
          {
            type: "text",
            text: hit
              ? JSON.stringify(hit, null, 2)
              : "null"
          }
        ],
        isError: false
      });
    }

    if (toolName === "aiep_knowledge_store") {
      if (!args.promptText || !args.selectedAgent) {
        return jsonRpcError(id, -32602, "Invalid params: promptText and selectedAgent are required");
      }

      store.store({
        promptText: args.promptText,
        taskDomain: args.taskDomain,
        taskRisk: args.taskRisk,
        selectedAgent: args.selectedAgent,
        routingConfidence: args.routingConfidence,
        fallbackChain: args.fallbackChain,
        routingSummary: args.routingSummary
      });

      return jsonRpcSuccess(id, {
        content: [{ type: "text", text: "Routing decision queued for storage." }],
        isError: false
      });
    }

    if (toolName === "aiep_knowledge_health") {
      return jsonRpcSuccess(id, {
        content: [
          {
            type: "text",
            text: JSON.stringify(store.healthStatus(), null, 2)
          }
        ],
        isError: false
      });
    }

    return jsonRpcError(id, -32601, `Method not found: unknown tool '${toolName}'`);
  }

  // ── notifications/initialized (no response required) ─────────────────
  if (method === "notifications/initialized") {
    return null;
  }

  return jsonRpcError(id ?? null, -32601, `Method not found: ${method}`);
}

// ── HTTP server ──────────────────────────────────────────────────────────────

export function createMcpServer(options = {}) {
  const port = options.port || MCP_PORT;
  const store = getRouterKnowledgeStore({
    weaviateUrl: options.weaviateUrl || process.env.WEAVIATE_URL || "http://localhost:8080"
  });

  const server = http.createServer(async (req, res) => {
    // CORS headers so VS Code extension can call local server
    res.setHeader("access-control-allow-origin", "vscode-webview://");
    res.setHeader("access-control-allow-methods", "POST, GET, OPTIONS");
    res.setHeader("access-control-allow-headers", "content-type, mcp-session-id");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, service: "aiep-router-knowledge-mcp", port }));
      return;
    }

    if (req.method !== "POST") {
      res.writeHead(405, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Method not allowed" }));
      return;
    }

    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString("utf8");

    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify(jsonRpcError(null, -32700, "Parse error")));
      return;
    }

    try {
      const response = await handleMcpRequest(body, store);

      if (response === null) {
        // Notification — no response
        res.writeHead(202);
        res.end();
        return;
      }

      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(response));
    } catch (err) {
      console.error("[MCP] Handler error:", err.message);
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify(jsonRpcError(body?.id ?? null, -32603, "Internal error")));
    }
  });

  return {
    server,
    start() {
      return new Promise((resolve) => {
        server.listen(port, "0.0.0.0", () => {
          console.log(`[MCP] AIEP Router Knowledge server listening on port ${port}`);
          resolve(port);
        });
      });
    },
    stop() {
      return new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  };
}

// ── Standalone entry-point ───────────────────────────────────────────────────

if (process.argv[1] && process.argv[1].endsWith("router-knowledge-mcp-server.js")) {
  const mcp = createMcpServer();
  mcp.start().catch((err) => {
    console.error("[MCP] Failed to start:", err.message);
    process.exit(1);
  });
}
