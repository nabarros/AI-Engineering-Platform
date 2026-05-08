import fs from "node:fs";
import path from "node:path";

function ensureDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function defaultState() {
  return {
    namespaces: {},
    index: {
      tenants: {},
      updatedAt: Date.now()
    }
  };
}

function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return defaultState();
  }
}

export class IndexedSharedStateStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.lockPath = `${filePath}.lock`;
  }

  withLock(callback) {
    const started = Date.now();
    while (fs.existsSync(this.lockPath)) {
      if (Date.now() - started > 2500) {
        throw new Error("State store lock timeout");
      }
    }

    fs.writeFileSync(this.lockPath, String(process.pid), "utf8");
    try {
      return callback();
    } finally {
      if (fs.existsSync(this.lockPath)) {
        fs.unlinkSync(this.lockPath);
      }
    }
  }

  readRoot() {
    if (!fs.existsSync(this.filePath)) {
      return defaultState();
    }
    const raw = fs.readFileSync(this.filePath, "utf8");
    return safeParse(raw);
  }

  writeRoot(rootState) {
    ensureDirectory(this.filePath);
    fs.writeFileSync(this.filePath, JSON.stringify(rootState, null, 2), "utf8");
  }

  loadNamespace(namespace) {
    return this.withLock(() => {
      const root = this.readRoot();
      return root.namespaces[namespace] || null;
    });
  }

  saveNamespace(namespace, state) {
    return this.withLock(() => {
      const root = this.readRoot();
      root.namespaces[namespace] = state;
      root.index.tenants[namespace] = {
        updatedAt: Date.now(),
        memoryEntries: state?.memory ? Object.values(state.memory).reduce((sum, bucket) => sum + (Array.isArray(bucket) ? bucket.length : 0), 0) : 0,
        learningEntries: Array.isArray(state?.learning) ? state.learning.length : 0
      };
      root.index.updatedAt = Date.now();
      this.writeRoot(root);
    });
  }

  listNamespaces() {
    const root = this.readRoot();
    return Object.keys(root.namespaces);
  }

  getIndexSummary() {
    const root = this.readRoot();
    return root.index;
  }
}

export class TenantStateStore {
  constructor(sharedStore, tenantId) {
    this.sharedStore = sharedStore;
    this.tenantId = tenantId;
  }

  load() {
    return this.sharedStore.loadNamespace(this.tenantId);
  }

  save(state) {
    this.sharedStore.saveNamespace(this.tenantId, state);
  }
}
