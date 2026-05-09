import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCrossPriorityBenchmarkReport,
  buildRecoveryIndicators,
  createDeterministicCrossPriorityBenchmarkSample,
  renderCrossPriorityBenchmarkMarkdown
} from "../../src/orchestration/index.js";

test("should compute deterministic recovery indicators", () => {
  const indicators = buildRecoveryIndicators([
    { verificationPass: false, recovered: true, recoveryPlanCreated: true, recoveryLatencyMs: 120 },
    { verificationPass: false, recovered: false, recoveryPlanCreated: true },
    { verificationPass: true, recovered: false, recoveryPlanCreated: false }
  ]);

  assert.deepEqual(indicators, {
    totalRuns: 3,
    verificationFailures: 2,
    recoveredFailures: 1,
    unrecoveredFailures: 1,
    recoveryCoverage: 0.5,
    recoveryPlanActivationRate: 0.6667,
    averageRecoveryLatencyMs: 120
  });
});

test("should build cross-priority benchmark report with reliability, retrieval gate, and readiness", () => {
  const sample = createDeterministicCrossPriorityBenchmarkSample();
  const report = buildCrossPriorityBenchmarkReport(sample);

  assert.equal(report.sampleCounts.orchestrationRuns, 8);
  assert.equal(report.sampleCounts.retrievalSamples, 8);
  assert.equal(report.reliability.completionRate, 0.875);
  assert.equal(report.reliability.verificationFailureRate, 0.375);
  assert.equal(report.recoveryIndicators.recoveryCoverage, 0.6667);
  assert.equal(report.retrievalQuality.gates.status, "pass");
  assert.equal(report.readiness.status, "fail");
  assert.deepEqual(report.readiness.breaches.map((item) => item.metric), ["verificationFailureRate"]);
});

test("should render benchmark markdown with key sections", () => {
  const report = buildCrossPriorityBenchmarkReport(createDeterministicCrossPriorityBenchmarkSample());
  const markdown = renderCrossPriorityBenchmarkMarkdown(report);

  assert.ok(markdown.includes("# Cross-Priority Benchmark Report"));
  assert.ok(markdown.includes("## Multi-Step Reliability"));
  assert.ok(markdown.includes("## Recovery Indicators"));
  assert.ok(markdown.includes("## Retrieval Quality Gate"));
  assert.ok(markdown.includes("verificationFailureRate"));
});
