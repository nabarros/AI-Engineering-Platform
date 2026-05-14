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
