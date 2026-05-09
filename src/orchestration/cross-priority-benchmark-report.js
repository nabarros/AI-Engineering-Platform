import { buildMultiStepReliabilityBenchmark } from "./benchmark.js";
import {
  DEFAULT_RETRIEVAL_QUALITY_THRESHOLDS,
  buildRetrievalQualityReport,
  evaluateRetrievalQualityGates
} from "./retrieval-quality.js";
import { createDeterministicMemoryPilotSample } from "./memory-pilot-report.js";

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function round(value, precision = 4) {
  return Number(toNumber(value).toFixed(precision));
}

function normalizeExecution(run = {}) {
  return {
    runId: String(run.runId || "unknown"),
    completed: run.completed === true,
    recovered: run.recovered === true,
    verificationPass: run.verificationPass === true,
    recoveryPlanCreated: run.recoveryPlanCreated === true,
    recoveryLatencyMs: Math.max(0, toNumber(run.recoveryLatencyMs, 0))
  };
}

function resolveThresholds(thresholds = {}) {
  const retrieval = thresholds.retrievalQuality || {};

  return {
    minCompletionRate: Math.max(0, toNumber(thresholds.minCompletionRate, 0.75)),
    maxVerificationFailureRate: Math.max(0, toNumber(thresholds.maxVerificationFailureRate, 0.35)),
    minRecoveryCoverage: Math.max(0, toNumber(thresholds.minRecoveryCoverage, 0.6)),
    retrievalQuality: {
      maxLatencyMs: Math.max(0, toNumber(retrieval.maxLatencyMs, DEFAULT_RETRIEVAL_QUALITY_THRESHOLDS.maxLatencyMs)),
      minPrecision: Math.max(0, toNumber(retrieval.minPrecision, DEFAULT_RETRIEVAL_QUALITY_THRESHOLDS.minPrecision)),
      maxMissRate: Math.max(0, toNumber(retrieval.maxMissRate, DEFAULT_RETRIEVAL_QUALITY_THRESHOLDS.maxMissRate))
    }
  };
}

export function buildRecoveryIndicators(executions = []) {
  const runs = Array.isArray(executions) ? executions.map((run) => normalizeExecution(run)) : [];
  const totalRuns = runs.length;

  const verificationFailures = runs.filter((run) => run.verificationPass === false).length;
  const recoveredFailures = runs.filter((run) => run.verificationPass === false && run.recovered === true).length;
  const unrecoveredFailures = runs.filter((run) => run.verificationPass === false && run.recovered === false).length;
  const recoveryPlanCreatedCount = runs.filter((run) => run.recoveryPlanCreated === true).length;

  const recoveredRuns = runs.filter((run) => run.recovered === true);
  const totalRecoveryLatencyMs = recoveredRuns.reduce((sum, run) => sum + run.recoveryLatencyMs, 0);

  return {
    totalRuns,
    verificationFailures,
    recoveredFailures,
    unrecoveredFailures,
    recoveryCoverage: verificationFailures === 0 ? 1 : round(recoveredFailures / verificationFailures),
    recoveryPlanActivationRate: totalRuns === 0 ? 0 : round(recoveryPlanCreatedCount / totalRuns),
    averageRecoveryLatencyMs: recoveredRuns.length === 0 ? 0 : round(totalRecoveryLatencyMs / recoveredRuns.length, 2)
  };
}

function evaluateCrossPriorityReadiness(benchmark, thresholds) {
  const breaches = [];

  if (benchmark.reliability.completionRate < thresholds.minCompletionRate) {
    breaches.push({
      metric: "completionRate",
      actual: benchmark.reliability.completionRate,
      operator: ">=",
      threshold: thresholds.minCompletionRate
    });
  }

  if (benchmark.reliability.verificationFailureRate > thresholds.maxVerificationFailureRate) {
    breaches.push({
      metric: "verificationFailureRate",
      actual: benchmark.reliability.verificationFailureRate,
      operator: "<=",
      threshold: thresholds.maxVerificationFailureRate
    });
  }

  if (benchmark.recoveryIndicators.recoveryCoverage < thresholds.minRecoveryCoverage) {
    breaches.push({
      metric: "recoveryCoverage",
      actual: benchmark.recoveryIndicators.recoveryCoverage,
      operator: ">=",
      threshold: thresholds.minRecoveryCoverage
    });
  }

  return {
    status: breaches.length === 0 && benchmark.retrievalQuality.gates.status === "pass" ? "pass" : "fail",
    thresholds,
    breaches
  };
}

export function buildCrossPriorityBenchmarkReport(options = {}) {
  const generatedAt = typeof options.generatedAt === "number" ? options.generatedAt : Date.now();
  const executions = Array.isArray(options.executions) ? options.executions : [];
  const retrievalSamples = Array.isArray(options.retrievalSamples) ? options.retrievalSamples : [];
  const thresholds = resolveThresholds(options.thresholds);

  const reliability = buildMultiStepReliabilityBenchmark(executions);
  const recoveryIndicators = buildRecoveryIndicators(executions);

  const retrievalReport = buildRetrievalQualityReport(retrievalSamples, { generatedAt });
  const retrievalGates = evaluateRetrievalQualityGates(retrievalReport, thresholds.retrievalQuality);

  const report = {
    generatedAt,
    benchmarkScope: "cross-priority",
    sampleCounts: {
      orchestrationRuns: reliability.totalRuns,
      retrievalSamples: retrievalReport.retrievalAttempts
    },
    reliability,
    recoveryIndicators,
    retrievalQuality: {
      report: retrievalReport,
      gates: retrievalGates
    }
  };

  return {
    ...report,
    readiness: evaluateCrossPriorityReadiness(report, thresholds)
  };
}

export function createDeterministicCrossPriorityBenchmarkSample() {
  const pilot = createDeterministicMemoryPilotSample();

  return {
    generatedAt: pilot.generatedAt,
    executions: [
      { runId: "run-001", completed: true, verificationPass: true, recovered: false, recoveryPlanCreated: false },
      { runId: "run-002", completed: true, verificationPass: false, recovered: true, recoveryPlanCreated: true, recoveryLatencyMs: 130 },
      { runId: "run-003", completed: true, verificationPass: true, recovered: false, recoveryPlanCreated: false },
      { runId: "run-004", completed: true, verificationPass: false, recovered: true, recoveryPlanCreated: true, recoveryLatencyMs: 110 },
      { runId: "run-005", completed: false, verificationPass: false, recovered: false, recoveryPlanCreated: true, recoveryLatencyMs: 0 },
      { runId: "run-006", completed: true, verificationPass: true, recovered: false, recoveryPlanCreated: false },
      { runId: "run-007", completed: true, verificationPass: true, recovered: false, recoveryPlanCreated: false },
      { runId: "run-008", completed: true, verificationPass: true, recovered: false, recoveryPlanCreated: false }
    ],
    retrievalSamples: [...pilot.baseline, ...pilot.memoryAssisted]
  };
}

export function renderCrossPriorityBenchmarkMarkdown(report) {
  const safeReport = report || buildCrossPriorityBenchmarkReport();

  return [
    "# Cross-Priority Benchmark Report",
    "",
    `- generatedAt: ${new Date(safeReport.generatedAt).toISOString()}`,
    `- readinessStatus: ${safeReport.readiness.status}`,
    `- orchestrationRuns: ${safeReport.sampleCounts.orchestrationRuns}`,
    `- retrievalSamples: ${safeReport.sampleCounts.retrievalSamples}`,
    "",
    "## Multi-Step Reliability",
    `- completionRate: ${safeReport.reliability.completionRate}`,
    `- recoveryRate: ${safeReport.reliability.recoveryRate}`,
    `- verificationFailureRate: ${safeReport.reliability.verificationFailureRate}`,
    "",
    "## Recovery Indicators",
    `- recoveryCoverage: ${safeReport.recoveryIndicators.recoveryCoverage}`,
    `- unrecoveredFailures: ${safeReport.recoveryIndicators.unrecoveredFailures}`,
    `- recoveryPlanActivationRate: ${safeReport.recoveryIndicators.recoveryPlanActivationRate}`,
    `- averageRecoveryLatencyMs: ${safeReport.recoveryIndicators.averageRecoveryLatencyMs}`,
    "",
    "## Retrieval Quality Gate",
    `- status: ${safeReport.retrievalQuality.gates.status}`,
    `- averageLatencyMs: ${safeReport.retrievalQuality.report.averageLatencyMs}`,
    `- averagePrecision: ${safeReport.retrievalQuality.report.averagePrecision}`,
    `- missRate: ${safeReport.retrievalQuality.report.missRate}`,
    `- thresholds: latency<=${safeReport.retrievalQuality.gates.thresholds.maxLatencyMs}, precision>=${safeReport.retrievalQuality.gates.thresholds.minPrecision}, missRate<=${safeReport.retrievalQuality.gates.thresholds.maxMissRate}`,
    "",
    "## Readiness Breaches",
    safeReport.readiness.breaches.length === 0
      ? "- none"
      : safeReport.readiness.breaches.map((breach) => `- ${breach.metric}: ${breach.actual} ${breach.operator} ${breach.threshold}`).join("\n"),
    ""
  ].join("\n");
}
