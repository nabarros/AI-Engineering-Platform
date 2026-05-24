import { validateConnectorDefinition } from "./connector-contract.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export class ConnectorRegistry {
  constructor({ cacheTtlMs = 5000, nowFn = () => Date.now() } = {}) {
    this.cacheTtlMs = cacheTtlMs;
    this.nowFn = nowFn;
    this.registry = new Map();
    this.discoveryProviders = [];
    this.dynamicRefreshState = {
      refreshedAt: 0,
      refreshCount: 0,
      lastError: null
    };
  }

  register(definition) {
    const validation = validateConnectorDefinition(definition);
    if (!validation.valid) {
      throw new Error(`Cannot register connector: ${validation.errors.join(" ")}`);
    }

    this.registry.set(definition.id, clone(definition));
    return this.lookup(definition.id);
  }

  registerMany(definitions = []) {
    return definitions.map((definition) => this.register(definition));
  }

  addDiscoveryProvider(providerFn) {
    if (typeof providerFn !== "function") {
      throw new Error("Discovery provider must be a function.");
    }

    this.discoveryProviders.push(providerFn);
  }

  async refreshDynamicConnectors(force = false) {
    const now = this.nowFn();
    const isCacheFresh = now - this.dynamicRefreshState.refreshedAt < this.cacheTtlMs;
    if (!force && isCacheFresh) {
      return { refreshed: false, fromCache: true, connectorCount: this.registry.size };
    }

    try {
      for (const provider of this.discoveryProviders) {
        const discovered = await provider();
        if (!Array.isArray(discovered)) {
          continue;
        }

        for (const connector of discovered) {
          this.register(connector);
        }
      }

      this.dynamicRefreshState.refreshedAt = now;
      this.dynamicRefreshState.refreshCount += 1;
      this.dynamicRefreshState.lastError = null;

      return { refreshed: true, fromCache: false, connectorCount: this.registry.size };
    } catch (error) {
      this.dynamicRefreshState.lastError = String(error?.message || error);
      throw error;
    }
  }

  lookup(connectorId) {
    if (!this.registry.has(connectorId)) {
      return null;
    }

    return clone(this.registry.get(connectorId));
  }

  list() {
    return [...this.registry.values()]
      .map((item) => clone(item))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  health() {
    const now = this.nowFn();
    const staleByMs = Math.max(0, now - this.dynamicRefreshState.refreshedAt - this.cacheTtlMs);

    return {
      healthy: this.dynamicRefreshState.lastError === null,
      connectorCount: this.registry.size,
      discoveryProviderCount: this.discoveryProviders.length,
      refreshedAt: this.dynamicRefreshState.refreshedAt,
      refreshCount: this.dynamicRefreshState.refreshCount,
      cacheTtlMs: this.cacheTtlMs,
      staleByMs,
      lastError: this.dynamicRefreshState.lastError
    };
  }
}
