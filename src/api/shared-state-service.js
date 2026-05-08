import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { IndexedSharedStateStore } from "../orchestration/persistence/indexed-shared-state-store.js";

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function parseUrlPath(url) {
  return String(url || "/").split("?")[0];
}

function decodeNamespaceFromPath(pathname) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length !== 2 || parts[0] !== "namespace") {
    return null;
  }
  try {
    return decodeURIComponent(parts[1]);
  } catch {
    return null;
  }
}

function verifyStateApiKey(req, apiKey) {
  if (!apiKey) return true;
  return String(req.headers["x-state-api-key"] || "") === apiKey;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function createSharedStateService(options = {}) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const stateFilePath = options.stateFilePath || path.join(__dirname, "..", "..", "data", "shared-state.json");
  const store = options.store || new IndexedSharedStateStore(stateFilePath);
  const apiKey = options.apiKey || process.env.ORCHESTRATION_STATE_API_KEY || "";

  const server = http.createServer(async (req, res) => {
    const method = req.method || "GET";
    const pathname = parseUrlPath(req.url);

    if (!verifyStateApiKey(req, apiKey)) {
      return sendJson(res, 401, {
        error: "Unauthorized",
        code: "STATE_UNAUTHORIZED"
      });
    }

    if (method === "GET" && pathname === "/health") {
      return sendJson(res, 200, {
        ok: true,
        service: "shared-state-service"
      });
    }

    if (method === "GET" && pathname === "/namespaces") {
      const data = await Promise.resolve(store.listNamespaces());
      return sendJson(res, 200, { data });
    }

    if (method === "GET" && pathname === "/index") {
      const data = await Promise.resolve(store.getIndexSummary());
      return sendJson(res, 200, { data });
    }

    if (pathname.startsWith("/namespace/")) {
      const namespace = decodeNamespaceFromPath(pathname);
      if (!namespace) {
        return sendJson(res, 400, {
          error: "Invalid namespace path",
          code: "INVALID_NAMESPACE"
        });
      }

      if (method === "GET") {
        const data = await Promise.resolve(store.loadNamespace(namespace));
        return sendJson(res, 200, { data });
      }

      if (method === "PUT") {
        const body = await readBody(req);
        await Promise.resolve(store.saveNamespace(namespace, body.data || null));
        return sendJson(res, 200, { ok: true });
      }
    }

    return sendJson(res, 404, {
      error: "Not found",
      code: "STATE_NOT_FOUND"
    });
  });

  return {
    server,
    stateFilePath,
    close: () => new Promise((resolve, reject) => {
      server.close((err) => {
        if (err) return reject(err);
        resolve();
      });
    })
  };
}

export function startSharedStateService(options = {}) {
  const host = options.host || "127.0.0.1";
  const port = Number(options.port || process.env.ORCHESTRATION_STATE_PORT || 8790);
  const runtime = createSharedStateService(options);

  return new Promise((resolve, reject) => {
    runtime.server.listen(port, host, () => {
      resolve({
        host,
        port,
        stateFilePath: runtime.stateFilePath,
        server: runtime.server,
        close: runtime.close
      });
    });
    runtime.server.on("error", reject);
  });
}