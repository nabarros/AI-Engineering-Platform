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

  summary() {
    const finishedAt = Date.now();
    return {
      requestId: this.requestId,
      durationMs: finishedAt - this.startedAt,
      eventCount: this.events.length,
      selectedAgent: this.events.find((e) => e.type === "route.selected")?.payload?.selectedAgent || null,
      verificationPass: this.events.find((e) => e.type === "verification.completed")?.payload?.pass ?? null,
      fallbackUsed: this.events.find((e) => e.type === "route.selected")?.payload?.fallbackUsed || false
    };
  }
}
