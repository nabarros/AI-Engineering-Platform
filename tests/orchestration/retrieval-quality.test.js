import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_MEMORY_PILOT_ACCEPTANCE_THRESHOLDS,
  DEFAULT_RETRIEVAL_QUALITY_THRESHOLDS,
  buildRetrievalQualityDashboard,
  buildRetrievalQualityReport,
  buildMemoryAssistedPilotReport,
  createDeterministicMemoryPilotSample,
  evaluateMemoryPilotAcceptanceGates,
  evaluateRetrievalQualityGates,
  renderMemoryPilotMarkdown
} from "../../src/orchestration/index.js";

test("should build retrieval quality report with latency, precision, and miss diagnostics", () => {
  const report = buildRetrievalQualityReport([
    { requestId: "req-1", latencyMs: 120, retrievedCount: 5, relevantRetrievedCount: 4, missReason: null },
    { requestId: "req-2", latencyMs: 200, retrievedCount: 5, relevantRetrievedCount: 0, missReason: "low_graph_coverage" },
    { requestId: "req-3", latencyMs: 150, retrievedCount: 4, relevantRetrievedCount: 2, missReason: null }
  ], {
    generatedAt: Date.UTC(2026, 4, 9)
  });

  assert.equal(report.retrievalAttempts, 3);
  assert.equal(report.averageLatencyMs, 156.67);
  assert.equal(report.averagePrecision, 0.4333);
  assert.equal(report.missCount, 1);
  assert.equal(report.missDiagnostics.low_graph_coverage, 1);

  const dashboard = buildRetrievalQualityDashboard(report);
  assert.equal(dashboard.cards.attempts, 3);
  assert.equal(dashboard.cards.averagePrecision, 0.4333);
  assert.equal(dashboard.qualityGates.status, "fail");
  assert.equal(dashboard.qualityGates.thresholds.minPrecision, DEFAULT_RETRIEVAL_QUALITY_THRESHOLDS.minPrecision);
  assert.equal(dashboard.topMissReasons.length, 1);
});

test("should evaluate retrieval quality gates deterministically", () => {
  const passingReport = buildRetrievalQualityReport([
    { requestId: "req-1", latencyMs: 120, retrievedCount: 5, relevantRetrievedCount: 3, missReason: null },
    { requestId: "req-2", latencyMs: 180, retrievedCount: 5, relevantRetrievedCount: 3, missReason: null }
  ], {
    generatedAt: Date.UTC(2026, 4, 9)
  });
  const passingGates = evaluateRetrievalQualityGates(passingReport);
  assert.equal(passingGates.status, "pass");
  assert.deepEqual(passingGates.breaches, []);

  const failingGates = evaluateRetrievalQualityGates(passingReport, {
    maxLatencyMs: 100,
    minPrecision: 0.8,
    maxMissRate: 0
  });
  assert.equal(failingGates.status, "fail");
  assert.deepEqual(failingGates.breaches.map((item) => item.metric), [
    "averageLatencyMs",
    "averagePrecision"
  ]);
});

test("should generate deterministic memory-assisted pilot report and markdown", () => {
  const sample = createDeterministicMemoryPilotSample();
  const report = buildMemoryAssistedPilotReport(sample);

  assert.equal(report.generatedAt, Date.UTC(2026, 4, 9, 0, 0, 0));
  assert.equal(report.delta.latencyMsImprovement, 56.75);
  assert.equal(report.delta.precisionImprovement, 0.45);
  assert.equal(report.delta.missRateReduction, 0);
  assert.equal(report.acceptanceGates.status, "pass");
  assert.equal(
    report.acceptanceGates.thresholds.minLatencyMsImprovement,
    DEFAULT_MEMORY_PILOT_ACCEPTANCE_THRESHOLDS.minLatencyMsImprovement
  );

  const markdown = renderMemoryPilotMarkdown(report);
  assert.ok(markdown.includes("# Memory-Assisted Retrieval Pilot Report"));
  assert.ok(markdown.includes("latencyMsImprovement: 56.75"));
  assert.ok(markdown.includes("## Verification Gates"));
  assert.ok(markdown.includes("status: pass"));
  assert.ok(markdown.includes("breachedCriteria: none"));
});

test("should mark acceptance gates as fail when thresholds are not met", () => {
  const gates = evaluateMemoryPilotAcceptanceGates({
    delta: {
      latencyMsImprovement: 10,
      precisionImprovement: 0.05
    }
  });

  assert.equal(gates.status, "fail");
  assert.deepEqual(gates.breaches.map((item) => item.metric), [
    "latencyMsImprovement",
    "precisionImprovement"
  ]);
});
