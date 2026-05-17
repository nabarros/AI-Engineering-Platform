import http from "node:http";
import net from "node:net";

export class LocalDeploymentContext {
  constructor() {
    this.isAvailable = false;
    this.detectedAt = 0;
    this.ttl = 30_000;
    this.services = {
      orchestration: { healthy: false, latencyMs: 0, error: null },
      sharedState: { healthy: false, latencyMs: 0, error: null },
      weaviate: { healthy: false, latencyMs: 0, error: null },
      postgres: { healthy: false, latencyMs: 0, error: null },
      redis: { healthy: false, latencyMs: 0, error: null }
    };
    this.enrichmentData = null;
    this.enrichmentError = null;
  }

  get isHealthy() {
    const healthy = Object.values(this.services).filter(s => s.healthy).length;
    return healthy >= 3;
  }

  get isCacheValid() {
    return Date.now() - this.detectedAt < this.ttl;
  }
}

export class LocalDeploymentDetector {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.healthCheckTimeout = options.healthCheckTimeout || 200;
    this.enrichmentTimeout = options.enrichmentTimeout || 500;
    this.cacheTtl = options.cacheTtl || 30_000;
    this.enrichmentCacheTtl = options.enrichmentCacheTtl || 60_000;

    this.endpoints = {
      orchestration: {
        host: options.orchestrationHost || 'localhost',
        port: options.orchestrationPort || 8787,
        path: '/health'
      },
      sharedState: {
        host: options.sharedStateHost || 'localhost',
        port: options.sharedStatePort || 8790,
        path: '/health'
      },
      weaviate: {
        host: options.weaviateHost || 'localhost',
        port: options.weaviatePort || 8080,
        path: '/v1/.well-known/ready'
      },
      postgres: {
        host: options.postgresHost || 'localhost',
        port: options.postgresPort || 5432,
        path: null
      },
      redis: {
        host: options.redisHost || 'localhost',
        port: options.redisPort || 6379,
        path: null
      }
    };

    this.lastContext = null;
    this.enrichmentCache = new Map();
    this.detectionPromise = null;
  }

  async detect() {
    if (!this.enabled) {
      return new LocalDeploymentContext();
    }

    // Handle concurrent requests: if detection is already in progress, await it
    if (this.detectionPromise) {
      return this.detectionPromise;
    }

    if (this.lastContext && this.lastContext.isCacheValid) {
      return this.lastContext;
    }

    const context = new LocalDeploymentContext();

    this.detectionPromise = (async () => {
      try {
        await Promise.all([
          this._checkOrchestration(context),
          this._checkSharedState(context),
          this._checkWeaviate(context),
          this._checkPostgres(context),
          this._checkRedis(context)
        ]);

        if (context.isHealthy) {
          await this._fetchEnrichmentData(context);
        }

        context.isAvailable = context.isHealthy;
        context.detectedAt = Date.now();
        context.ttl = this.cacheTtl;
        this.lastContext = context;

      } catch (error) {
        console.error('[LocalDeploymentDetector] Detection failed:', error.message);
        context.detectedAt = Date.now();
        context.ttl = this.cacheTtl;
        this.lastContext = context;
      }

      return context;
    })();

    try {
      return await this.detectionPromise;
    } finally {
      this.detectionPromise = null;
    }
  }

  invalidateCache() {
    this.lastContext = null;
    this.enrichmentCache.clear();
    this.detectionPromise = null;
  }

  async _checkOrchestration(context) {
    try {
      const start = Date.now();
      const result = await this._httpHealthCheck(
        this.endpoints.orchestration.host,
        this.endpoints.orchestration.port,
        this.endpoints.orchestration.path
      );
      context.services.orchestration.healthy = result.healthy;
      context.services.orchestration.latencyMs = Date.now() - start;
    } catch (error) {
      context.services.orchestration.healthy = false;
      context.services.orchestration.error = error.message;
    }
  }

  async _checkSharedState(context) {
    try {
      const start = Date.now();
      const result = await this._httpHealthCheck(
        this.endpoints.sharedState.host,
        this.endpoints.sharedState.port,
        this.endpoints.sharedState.path
      );
      context.services.sharedState.healthy = result.healthy;
      context.services.sharedState.latencyMs = Date.now() - start;
    } catch (error) {
      context.services.sharedState.healthy = false;
      context.services.sharedState.error = error.message;
    }
  }

  async _checkWeaviate(context) {
    try {
      const start = Date.now();
      const result = await this._httpHealthCheck(
        this.endpoints.weaviate.host,
        this.endpoints.weaviate.port,
        this.endpoints.weaviate.path
      );
      context.services.weaviate.healthy = result.healthy;
      context.services.weaviate.latencyMs = Date.now() - start;
    } catch (error) {
      context.services.weaviate.healthy = false;
      context.services.weaviate.error = error.message;
    }
  }

  async _checkPostgres(context) {
    try {
      const start = Date.now();
      await this._tcpConnectionTest(
        this.endpoints.postgres.host,
        this.endpoints.postgres.port
      );
      context.services.postgres.healthy = true;
      context.services.postgres.latencyMs = Date.now() - start;
    } catch (error) {
      context.services.postgres.healthy = false;
      context.services.postgres.error = error.message;
    }
  }

  async _checkRedis(context) {
    try {
      const start = Date.now();
      await this._tcpConnectionTest(
        this.endpoints.redis.host,
        this.endpoints.redis.port
      );
      context.services.redis.healthy = true;
      context.services.redis.latencyMs = Date.now() - start;
    } catch (error) {
      context.services.redis.healthy = false;
      context.services.redis.error = error.message;
    }
  }

  async _httpHealthCheck(host, port, path) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`HTTP health check timeout after ${this.healthCheckTimeout}ms`));
      }, this.healthCheckTimeout);

      const options = {
        hostname: host,
        port: port,
        path: path,
        method: 'GET',
        timeout: this.healthCheckTimeout
      };

      const req = http.request(options, (res) => {
        clearTimeout(timeoutId);
        const healthy = res.statusCode >= 200 && res.statusCode < 300;
        resolve({ healthy });
      });

      req.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });

      req.on('timeout', () => {
        clearTimeout(timeoutId);
        req.destroy();
        reject(new Error('HTTP health check timeout'));
      });

      req.end();
    });
  }

  async _tcpConnectionTest(host, port) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`TCP connection timeout after ${this.healthCheckTimeout}ms`));
      }, this.healthCheckTimeout);

      const socket = net.createConnection(host, port);

      socket.on('connect', () => {
        clearTimeout(timeoutId);
        socket.destroy();
        resolve();
      });

      socket.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });

      socket.on('timeout', () => {
        clearTimeout(timeoutId);
        socket.destroy();
        reject(new Error('TCP connection timeout'));
      });

      socket.setTimeout(this.healthCheckTimeout);
    });
  }

  async _fetchEnrichmentData(context) {
    const cacheKey = 'enrichment-data';
    if (this.enrichmentCache.has(cacheKey)) {
      const { data, timestamp } = this.enrichmentCache.get(cacheKey);
      if (Date.now() - timestamp < this.enrichmentCacheTtl) {
        context.enrichmentData = data;
        return;
      }
    }

    try {
      const enrichment = await Promise.all([
        this._fetchRouterMemory(),
        this._fetchCapabilityRegistry(),
        this._fetchActiveSkills(),
        this._fetchTokenForecast()
      ]);

      context.enrichmentData = {
        routerMemory: enrichment[0],
        capabilityRegistry: enrichment[1],
        activeSkills: enrichment[2],
        tokenForecast: enrichment[3],
        fetchedAt: Date.now()
      };

      this.enrichmentCache.set(cacheKey, {
        data: context.enrichmentData,
        timestamp: Date.now()
      });

    } catch (error) {
      context.enrichmentError = error.message;
      console.warn('[LocalDeploymentDetector] Enrichment failed:', error.message);
    }
  }

  async _fetchRouterMemory() {
    return this._fetchJson(
      this.endpoints.sharedState.host,
      this.endpoints.sharedState.port,
      '/state/router-memory'
    );
  }

  async _fetchCapabilityRegistry() {
    return this._fetchJson(
      this.endpoints.sharedState.host,
      this.endpoints.sharedState.port,
      '/state/capability-registry'
    );
  }

  async _fetchActiveSkills() {
    return this._fetchJson(
      this.endpoints.sharedState.host,
      this.endpoints.sharedState.port,
      '/state/active-skills'
    );
  }

  async _fetchTokenForecast() {
    return this._fetchJson(
      this.endpoints.sharedState.host,
      this.endpoints.sharedState.port,
      '/state/token-forecast'
    );
  }

  async _fetchJson(host, port, path) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Enrichment fetch timeout after ${this.enrichmentTimeout}ms for ${path}`));
      }, this.enrichmentTimeout);

      const options = {
        hostname: host,
        port: port,
        path: path,
        method: 'GET',
        timeout: this.enrichmentTimeout
      };

      const req = http.request(options, (res) => {
        let data = '';

        res.on('data', chunk => {
          data += chunk;
        });

        res.on('end', () => {
          clearTimeout(timeoutId);
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`HTTP ${res.statusCode} from ${path}`));
            return;
          }
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(new Error(`Failed to parse JSON from ${path}: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });

      req.on('timeout', () => {
        clearTimeout(timeoutId);
        req.destroy();
        reject(new Error(`Request timeout for ${path}`));
      });

      req.end();
    });
  }
}
