import test from "node:test";
import assert from "node:assert/strict";
import {
  buildWeeklyCostQualityScorecard,
  buildSubsetTokenImpactReport,
  buildSubsetTokenImpactDashboard
} from "../../src/orchestration/metrics.js";
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

test("should compute subset token impact by task class with savings rates", () => {
  const executions = [
    { taskClass: "bugfix", subsetApplied: false, tokenUsage: 2200 },
    { taskClass: "bugfix", subsetApplied: true, tokenUsage: 1700 },
    { taskClass: "feature", subsetApplied: false, tokenUsage: 3200 },
    { taskClass: "feature", subsetApplied: true, tokenUsage: 2800 }
  ];

  const report = buildSubsetTokenImpactReport(executions, { generatedAt: 1710000001000 });

  assert.equal(report.generatedAt, 1710000001000);
  assert.equal(report.totalExecutions, 4);
  assert.equal(report.comparedTaskClassCount, 2);
  assert.equal(report.byTaskClass.length, 2);
  assert.equal(report.byTaskClass[0].taskClass, "bugfix");
  assert.equal(report.byTaskClass[0].avgTokenSavings, 500);
  assert.equal(report.byTaskClass[0].savingsRate, 0.2273);
});

test("should build subset token impact dashboard summary from report", () => {
  const report = buildSubsetTokenImpactReport([
    { taskClass: "review", subsetApplied: false, tokenUsage: 1500 },
    { taskClass: "review", subsetApplied: true, tokenUsage: 1200 },
    { taskClass: "feature", subsetApplied: false, tokenUsage: 2800 },
    { taskClass: "feature", subsetApplied: true, tokenUsage: 2400 }
  ], { generatedAt: 1710000002000 });

  const dashboard = buildSubsetTokenImpactDashboard(report);

  assert.equal(dashboard.generatedAt, 1710000002000);
  assert.equal(dashboard.totalExecutions, 4);
  assert.equal(dashboard.comparedTaskClassCount, 2);
  assert.equal(dashboard.topSavings.length, 2);
  assert.equal(dashboard.topSavings[0].taskClass, "feature");
});
