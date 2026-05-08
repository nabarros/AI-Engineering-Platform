function encode(namespace) {
  return encodeURIComponent(namespace);
}

async function parseJson(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export class HttpSharedStateStore {
  constructor(options) {
    this.baseUrl = String(options.baseUrl || "").replace(/\/$/, "");
    this.apiKey = options.apiKey || "";
    this.timeoutMs = options.timeoutMs || 5_000;

    if (!this.baseUrl) {
      throw new Error("HttpSharedStateStore requires baseUrl.");
    }
  }

  buildHeaders() {
    const headers = { "content-type": "application/json" };
    if (this.apiKey) headers["x-state-api-key"] = this.apiKey;
    return headers;
  }

  async fetchJson(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers: {
          ...this.buildHeaders(),
          ...(options.headers || {})
        },
        signal: controller.signal
      });

      const payload = await parseJson(response);
      if (!response.ok) {
        throw new Error(payload?.error || `HTTP state store request failed: ${response.status}`);
      }

      return payload;
    } finally {
      clearTimeout(timeout);
    }
  }

  async loadNamespace(namespace) {
    const payload = await this.fetchJson(`/namespace/${encode(namespace)}`, {
      method: "GET"
    });
    return payload.data || null;
  }

  async saveNamespace(namespace, state) {
    await this.fetchJson(`/namespace/${encode(namespace)}`, {
      method: "PUT",
      body: JSON.stringify({ data: state })
    });
  }

  async listNamespaces() {
    const payload = await this.fetchJson("/namespaces", {
      method: "GET"
    });
    return Array.isArray(payload.data) ? payload.data : [];
  }

  async getIndexSummary() {
    const payload = await this.fetchJson("/index", {
      method: "GET"
    });
    return payload.data || { tenants: {}, updatedAt: Date.now() };
  }
}