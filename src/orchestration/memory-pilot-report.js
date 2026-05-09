import { buildRetrievalQualityDashboard, buildRetrievalQualityReport } from "./retrieval-quality.js";

export const DEFAULT_MEMORY_PILOT_ACCEPTANCE_THRESHOLDS = Object.freeze({
  minLatencyMsImprovement: 40,
  minPrecisionImprovement: 0.2
});

export function createDeterministicMemoryPilotSample() {
  return {
    generatedAt: Date.UTC(2026, 4, 9, 0, 0, 0),
    baseline: [
      { requestId: "pilot-001", intent: "bugfix", latencyMs: 210, retrievedCount: 5, relevantRetrievedCount: 2, missReason: null },
      { requestId: "pilot-002", intent: "feature", latencyMs: 245, retrievedCount: 5, relevantRetrievedCount: 2, missReason: "low_graph_coverage" },
      { requestId: "pilot-003", intent: "review", latencyMs: 190, retrievedCount: 4, relevantRetrievedCount: 1, missReason: "stale_memory" },
      { requestId: "pilot-004", intent: "docs", latencyMs: 175, retrievedCount: 4, relevantRetrievedCount: 1, missReason: null }
    ],
    memoryAssisted: [
      { requestId: "pilot-101", intent: "bugfix", latencyMs: 150, retrievedCount: 5, relevantRetrievedCount: 4, missReason: null },
      { requestId: "pilot-102", intent: "feature", latencyMs: 168, retrievedCount: 5, relevantRetrievedCount: 4, missReason: null },
      { requestId: "pilot-103", intent: "review", latencyMs: 142, retrievedCount: 4, relevantRetrievedCount: 3, missReason: "partial_ownership_links" },
      { requestId: "pilot-104", intent: "docs", latencyMs: 133, retrievedCount: 4, relevantRetrievedCount: 3, missReason: null }
    ]
  };
}

function round(value, precision = 4) {
  return Number(Number(value).toFixed(precision));
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  if (Number.isFinite(number)) {
    return number;
  }
  return fallback;
}

function resolveMemoryPilotAcceptanceThresholds(thresholds = {}) {
  return {
    minLatencyMsImprovement: toNumber(
      thresholds.minLatencyMsImprovement,
      DEFAULT_MEMORY_PILOT_ACCEPTANCE_THRESHOLDS.minLatencyMsImprovement
    ),
    minPrecisionImprovement: toNumber(
      thresholds.minPrecisionImprovement,
      DEFAULT_MEMORY_PILOT_ACCEPTANCE_THRESHOLDS.minPrecisionImprovement
    )
  };
}

export function evaluateMemoryPilotAcceptanceGates(report, thresholds = {}) {
  const resolvedThresholds = resolveMemoryPilotAcceptanceThresholds(thresholds);
  const evaluatedMetrics = {
    latencyMsImprovement: round(toNumber(report?.delta?.latencyMsImprovement), 2),
    precisionImprovement: round(toNumber(report?.delta?.precisionImprovement))
  };
  const breaches = [];

  if (evaluatedMetrics.latencyMsImprovement < resolvedThresholds.minLatencyMsImprovement) {
    breaches.push({
      metric: "latencyMsImprovement",
      actual: evaluatedMetrics.latencyMsImprovement,
      operator: ">=",
      threshold: resolvedThresholds.minLatencyMsImprovement
    });
  }

  if (evaluatedMetrics.precisionImprovement < resolvedThresholds.minPrecisionImprovement) {
    breaches.push({
      metric: "precisionImprovement",
      actual: evaluatedMetrics.precisionImprovement,
      operator: ">=",
      threshold: resolvedThresholds.minPrecisionImprovement
    });
  }

  return {
    status: breaches.length === 0 ? "pass" : "fail",
    thresholds: resolvedThresholds,
    evaluatedMetrics,
    breaches
  };
}

export function buildMemoryAssistedPilotReport(sample = createDeterministicMemoryPilotSample(), options = {}) {
  const baselineReport = buildRetrievalQualityReport(sample.baseline, { generatedAt: sample.generatedAt });
  const assistedReport = buildRetrievalQualityReport(sample.memoryAssisted, { generatedAt: sample.generatedAt });

  const latencyDeltaMs = baselineReport.averageLatencyMs - assistedReport.averageLatencyMs;
  const precisionDelta = assistedReport.averagePrecision - baselineReport.averagePrecision;
  const missRateDelta = baselineReport.missRate - assistedReport.missRate;

  const report = {
    generatedAt: sample.generatedAt,
    baseline: baselineReport,
    memoryAssisted: assistedReport,
    delta: {
      latencyMsImprovement: round(latencyDeltaMs, 2),
      precisionImprovement: round(precisionDelta),
      missRateReduction: round(missRateDelta)
    },
    dashboards: {
      baseline: buildRetrievalQualityDashboard(baselineReport),
      memoryAssisted: buildRetrievalQualityDashboard(assistedReport)
    }
  };

  return {
    ...report,
    acceptanceGates: evaluateMemoryPilotAcceptanceGates(report, options.acceptanceThresholds)
  };
}

export function renderMemoryPilotMarkdown(report) {
  const acceptanceGates = report.acceptanceGates || evaluateMemoryPilotAcceptanceGates(report);
  const lines = [];
  lines.push("# Memory-Assisted Retrieval Pilot Report");
  lines.push("");
  lines.push(`- generatedAt: ${new Date(report.generatedAt).toISOString()}`);
  lines.push(`- baselineAttempts: ${report.baseline.retrievalAttempts}`);
  lines.push(`- memoryAssistedAttempts: ${report.memoryAssisted.retrievalAttempts}`);
  lines.push("");
  lines.push("## Key Deltas");
  lines.push("");
  lines.push(`- latencyMsImprovement: ${report.delta.latencyMsImprovement}`);
  lines.push(`- precisionImprovement: ${report.delta.precisionImprovement}`);
  lines.push(`- missRateReduction: ${report.delta.missRateReduction}`);
  lines.push("");
  lines.push("## Verification Gates");
  lines.push("");
  lines.push(`- status: ${acceptanceGates.status}`);
  lines.push(`- minimumLatencyMsImprovement: ${acceptanceGates.thresholds.minLatencyMsImprovement}`);
  lines.push(`- minimumPrecisionImprovement: ${acceptanceGates.thresholds.minPrecisionImprovement}`);

  if (acceptanceGates.breaches.length === 0) {
    lines.push("- breachedCriteria: none");
  } else {
    for (const breach of acceptanceGates.breaches) {
      lines.push(
        `- breachedCriteria: ${breach.metric} ${breach.operator} ${breach.threshold} (actual=${breach.actual})`
      );
    }
  }

  lines.push("");
  lines.push("## Baseline Summary");
  lines.push("");
  lines.push(`- averageLatencyMs: ${report.baseline.averageLatencyMs}`);
  lines.push(`- averagePrecision: ${report.baseline.averagePrecision}`);
  lines.push(`- missRate: ${report.baseline.missRate}`);
  lines.push("");
  lines.push("## Memory-Assisted Summary");
  lines.push("");
  lines.push(`- averageLatencyMs: ${report.memoryAssisted.averageLatencyMs}`);
  lines.push(`- averagePrecision: ${report.memoryAssisted.averagePrecision}`);
  lines.push(`- missRate: ${report.memoryAssisted.missRate}`);
  lines.push("");
  lines.push("## Top Miss Reasons (Memory-Assisted)");
  lines.push("");

  for (const entry of report.dashboards.memoryAssisted.topMissReasons) {
    lines.push(`- ${entry.reason}: ${entry.count}`);
  }

  if (report.dashboards.memoryAssisted.topMissReasons.length === 0) {
    lines.push("- none");
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
}
