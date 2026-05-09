import test from "node:test";
import assert from "node:assert/strict";
import { buildWeeklyCostQualityScorecard } from "../../src/orchestration/metrics.js";
import { buildMultiStepReliabilityBenchmark } from "../../src/orchestration/benchmark.js";

test("should group weekly scorecard by objective and model tier with token totals, average, and pass rate", () => {
  const executions = [
    { objective: "latency", modelTier: "standard", tokenUsage: 100, verificationPass: true },
    { objective: "latency", modelTier: "standard", inputTokens: 30, outputTokens: 20, verificationPass: false },
    { objective: "quality", modelTier: "premium", tokenUsage: 200, verificationPass: true },
    { objective: "quality", modelTier: "premium", tokenUsage: 100, verificationPass: true }
  ];

  const scorecard = buildWeeklyCostQualityScorecard(executions, { generatedAt: 1710000000000 });

  assert.equal(scorecard.generatedAt, 1710000000000);
  assert.equal(scorecard.totalExecutions, 4);
  assert.equal(scorecard.groups.length, 2);

  assert.deepEqual(scorecard.groups[0], {
    objective: "latency",
    modelTier: "standard",
    tokenTotals: 150,
    avgTokens: 75,
    passRate: 0.5,
    sampleCount: 2
  });

  assert.deepEqual(scorecard.groups[1], {
    objective: "quality",
    modelTier: "premium",
    tokenTotals: 300,
    avgTokens: 150,
    passRate: 1,
    sampleCount: 2
  });
});

test("should compute multi-step reliability rates deterministically", () => {
  const executions = [
    { completed: true, recovered: false, verificationPass: true },
    { completed: true, recovered: true, verificationPass: false },
    { completed: false, recovered: false, verificationPass: false }
  ];

  const benchmark = buildMultiStepReliabilityBenchmark(executions);

  assert.deepEqual(benchmark, {
    totalRuns: 3,
    completionRate: 0.6667,
    recoveryRate: 0.3333,
    verificationFailureRate: 0.6667
  });
});
