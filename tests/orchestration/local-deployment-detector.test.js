import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { LocalDeploymentDetector, LocalDeploymentContext } from '../../src/orchestration/local-deployment-detector.js';

describe('LocalDeploymentDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new LocalDeploymentDetector({
      healthCheckTimeout: 100,
      cacheTtl: 1000
    });
  });

  it('should return unavailable context when disabled', async () => {
    const disabledDetector = new LocalDeploymentDetector({ enabled: false });
    const context = await disabledDetector.detect();
    assert.strictEqual(context.isAvailable, false);
  });

  it('should cache health status for TTL duration', async () => {
    const context1 = await detector.detect();
    const context2 = await detector.detect();
    assert.strictEqual(context1.detectedAt, context2.detectedAt);
  });

  it('should invalidate cache on demand', async () => {
    await detector.detect();
    const firstTime = detector.lastContext.detectedAt;
    
    detector.invalidateCache();
    assert.strictEqual(detector.lastContext, null);
    
    await new Promise(resolve => setTimeout(resolve, 10));
    await detector.detect();
    assert(detector.lastContext.detectedAt >= firstTime);
  });

  it('should determine health based on 3+ services up', () => {
    const context = new LocalDeploymentContext();
    
    assert.strictEqual(context.isHealthy, false);
    
    context.services.orchestration.healthy = true;
    context.services.sharedState.healthy = true;
    assert.strictEqual(context.isHealthy, false);
    
    context.services.weaviate.healthy = true;
    assert.strictEqual(context.isHealthy, true);
  });

  it('should track service latencies', async () => {
    const context = await detector.detect();
    
    Object.values(context.services).forEach(service => {
      assert.strictEqual(typeof service.latencyMs, 'number');
      assert(service.latencyMs >= 0);
    });
  });

  it('should fall back gracefully when enrichment fails', async () => {
    const context = new LocalDeploymentContext();
    context.services.orchestration.healthy = true;
    context.services.sharedState.healthy = true;
    context.services.weaviate.healthy = true;
    context.enrichmentError = 'Mock enrichment error';
    
    assert.strictEqual(context.isHealthy, true);
    assert.strictEqual(context.enrichmentData, null);
    assert.strictEqual(context.enrichmentError, 'Mock enrichment error');
  });

  it('should handle concurrent detection calls', async () => {
    const results = await Promise.all([
      detector.detect(),
      detector.detect(),
      detector.detect()
    ]);
    
     // Concurrent calls during detection should return the same cached result
     // All results should have the same detectedAt timestamp (from same detection run)
     assert.deepStrictEqual(results[0].detectedAt, results[1].detectedAt);
     assert.deepStrictEqual(results[1].detectedAt, results[2].detectedAt);
  });
});

describe('LocalDeploymentContext', () => {
  it('should initialize with correct defaults', () => {
    const context = new LocalDeploymentContext();
    
    assert.strictEqual(context.isAvailable, false);
    assert.strictEqual(context.ttl, 30_000);
    assert.strictEqual(context.enrichmentData, null);
    assert.strictEqual(context.enrichmentError, null);
    
    assert(context.services.orchestration);
    assert.strictEqual(context.services.orchestration.healthy, false);
    assert.strictEqual(context.services.orchestration.latencyMs, 0);
  });

  it('should calculate cache validity correctly', () => {
    const context = new LocalDeploymentContext();
    context.detectedAt = Date.now();
    context.ttl = 1000;
    
    assert.strictEqual(context.isCacheValid, true);
    
    context.detectedAt = Date.now() - 2000;
    assert.strictEqual(context.isCacheValid, false);
  });

  it('should require 3+ healthy services', () => {
    const context = new LocalDeploymentContext();
    
    // 0 healthy
    assert.strictEqual(context.isHealthy, false);
    
    // 1 healthy
    context.services.orchestration.healthy = true;
    assert.strictEqual(context.isHealthy, false);
    
    // 2 healthy
    context.services.sharedState.healthy = true;
    assert.strictEqual(context.isHealthy, false);
    
    // 3 healthy
    context.services.weaviate.healthy = true;
    assert.strictEqual(context.isHealthy, true);
    
    // 4 healthy
    context.services.postgres.healthy = true;
    assert.strictEqual(context.isHealthy, true);
  });
});
