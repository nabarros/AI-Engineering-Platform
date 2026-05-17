let globalTraceCounter = 0;

function nextId() {
  globalTraceCounter += 1;
  return `trace-${globalTraceCounter}`;
}

export class TraceCollector {
  constructor(requestId) {
    this.requestId = requestId;
    this.events = [];
    this.startedAt = Date.now();
  }

  addEvent(type, payload = {}) {
    this.events.push({
      id: nextId(),
      requestId: this.requestId,
      type,
      timestamp: Date.now(),
      payload
    });
  }

  getEvent(type) {
    return this.events.find((e) => e.type === type) || null;
  }

  getEvents(type) {
    return this.events.filter((e) => e.type === type);
  }

  addLocalDetectionEvent(context) {
    this.events.push({
      type: 'local.detect',
      timestamp: Date.now(),
      payload: {
        available: context.isAvailable,
        healthy: context.isHealthy,
        services: {
          orchestration: {
            healthy: context.services.orchestration.healthy,
            latencyMs: context.services.orchestration.latencyMs
          },
          sharedState: {
            healthy: context.services.sharedState.healthy,
            latencyMs: context.services.sharedState.latencyMs
          },
          weaviate: {
            healthy: context.services.weaviate.healthy,
            latencyMs: context.services.weaviate.latencyMs
          },
          postgres: {
            healthy: context.services.postgres.healthy,
            latencyMs: context.services.postgres.latencyMs
          },
          redis: {
            healthy: context.services.redis.healthy,
            latencyMs: context.services.redis.latencyMs
          }
        },
        healthyServices: Object.values(context.services).filter(s => s.healthy).length
      }
    });
  }

  addLocalEnrichmentEvent(enrichmentData, error = null) {
    this.events.push({
      type: 'local.enrich',
      timestamp: Date.now(),
      payload: {
        success: !error,
        error: error?.message || null,
        dataAvailable: !!enrichmentData,
        capabilitiesCount: enrichmentData?.capabilityRegistry?.length || 0,
        activeSkillsCount: enrichmentData?.activeSkills?.length || 0,
        routerMemoryKeys: enrichmentData?.routerMemory ? Object.keys(enrichmentData.routerMemory) : [],
        fetchedAt: enrichmentData?.fetchedAt || null
      }
    });
  }

  addLocalScoreAdjustmentEvent(candidatesAdjusted, adjustmentSummary) {
    this.events.push({
      type: 'local.score_adjustment',
      timestamp: Date.now(),
      payload: {
        candidatesAdjusted,
        domainScoresImproved: adjustmentSummary.domainScoresImproved || 0,
        learningScoresUpdated: adjustmentSummary.learningScoresUpdated || 0,
        maxDomainBoost: adjustmentSummary.maxDomainBoost || 0,
        avgLearningAdjustment: adjustmentSummary.avgLearningAdjustment || 0
      }
    });
  }

  addLocalFallbackEvent(reason) {
    this.events.push({
      type: 'local.fallback',
      timestamp: Date.now(),
      payload: {
        fallbackReason: reason,
        mode: 'LEAN',
        usingStaticAnalysis: true
      }
    });
  }

  summary() {
    const finishedAt = Date.now();
    const telemetryEventCount = this.events.filter((event) => event.type.startsWith("telemetry.")).length;
    const routeEvent = this.getEvent("route.selected");
    const classificationEvent = this.getEvent("task.classified");
    const compoundEvent = this.getEvent("compound.routed");
    const verificationEvent = this.getEvent("verification.completed");

    return {
      requestId: this.requestId,
      durationMs: finishedAt - this.startedAt,
      eventCount: this.events.length,
      telemetryEventCount,
      selectedAgent: routeEvent?.payload?.selectedAgent || null,
      routingConfidence: routeEvent?.payload?.routingConfidence ?? null,
      needsClarification: routeEvent?.payload?.needsClarification ?? false,
      isCompound: classificationEvent?.payload?.isCompound ?? false,
      primaryDomain: classificationEvent?.payload?.primaryDomain || null,
      domainCount: classificationEvent?.payload?.domainCount ?? 1,
      compoundStrategy: compoundEvent?.payload?.recommendedStrategy || null,
      verificationPass: verificationEvent?.payload?.pass ?? null,
      fallbackUsed: routeEvent?.payload?.fallbackUsed || false
    };
  }

  toDetailedLog() {
    return {
      requestId: this.requestId,
      startedAt: this.startedAt,
      events: this.events.map((e) => ({
        id: e.id,
        type: e.type,
        timestamp: e.timestamp,
        offsetMs: e.timestamp - this.startedAt,
        payload: e.payload
      }))
    };
  }
}
