function toNumber(value, fallback = 0) {
  const number = Number(value);
  if (Number.isFinite(number)) {
    return number;
  }
  return fallback;
}

function round(value, precision = 4) {
  return Number(toNumber(value).toFixed(precision));
}

export const DEFAULT_RETRIEVAL_QUALITY_THRESHOLDS = Object.freeze({
  maxLatencyMs: 200,
  minPrecision: 0.5,
  maxMissRate: 0.1
});

function resolveRetrievalQualityThresholds(thresholds = {}) {
  return {
    maxLatencyMs: Math.max(0, toNumber(thresholds.maxLatencyMs, DEFAULT_RETRIEVAL_QUALITY_THRESHOLDS.maxLatencyMs)),
    minPrecision: Math.max(0, toNumber(thresholds.minPrecision, DEFAULT_RETRIEVAL_QUALITY_THRESHOLDS.minPrecision)),
    maxMissRate: Math.max(0, toNumber(thresholds.maxMissRate, DEFAULT_RETRIEVAL_QUALITY_THRESHOLDS.maxMissRate))
  };
}

function normalizeSample(sample = {}) {
  const retrievedCount = Math.max(0, Math.floor(toNumber(sample.retrievedCount, 0)));
  const relevantRetrievedCount = Math.max(0, Math.floor(toNumber(sample.relevantRetrievedCount, 0)));

  return {
    requestId: String(sample.requestId || "unknown"),
    intent: String(sample.intent || "general").toLowerCase(),
    latencyMs: Math.max(0, toNumber(sample.latencyMs, 0)),
    retrievedCount,
    relevantRetrievedCount,
    missReason: sample.missReason ? String(sample.missReason) : null
  };
}

export function buildRetrievalQualityReport(samples = [], options = {}) {
  const normalized = Array.isArray(samples) ? samples.map((sample) => normalizeSample(sample)) : [];
  const generatedAt = typeof options.generatedAt === "number" ? options.generatedAt : Date.now();

  let totalLatencyMs = 0;
  let retrievalAttempts = 0;
  let precisionSum = 0;
  let missCount = 0;
  const missDiagnostics = {};

  for (const sample of normalized) {
    retrievalAttempts += 1;
    totalLatencyMs += sample.latencyMs;

    const precision = sample.retrievedCount > 0
      ? sample.relevantRetrievedCount / sample.retrievedCount
      : 0;

    precisionSum += precision;

    const isMiss = sample.relevantRetrievedCount === 0;
    if (isMiss) {
      missCount += 1;
      const key = sample.missReason || "unknown";
      missDiagnostics[key] = (missDiagnostics[key] || 0) + 1;
    }
  }

  const averageLatencyMs = retrievalAttempts === 0 ? 0 : totalLatencyMs / retrievalAttempts;
  const averagePrecision = retrievalAttempts === 0 ? 0 : precisionSum / retrievalAttempts;
  const missRate = retrievalAttempts === 0 ? 0 : missCount / retrievalAttempts;

  return {
    generatedAt,
    retrievalAttempts,
    averageLatencyMs: round(averageLatencyMs, 2),
    averagePrecision: round(averagePrecision),
    missCount,
    missRate: round(missRate),
    missDiagnostics,
    samples: normalized
  };
}

export function evaluateRetrievalQualityGates(report, thresholds = {}) {
  const safeReport = report || buildRetrievalQualityReport([]);
  const resolvedThresholds = resolveRetrievalQualityThresholds(thresholds);
  const evaluatedMetrics = {
    averageLatencyMs: round(safeReport.averageLatencyMs, 2),
    averagePrecision: round(safeReport.averagePrecision),
    missRate: round(safeReport.missRate)
  };

  const breaches = [];

  if (evaluatedMetrics.averageLatencyMs > resolvedThresholds.maxLatencyMs) {
    breaches.push({
      metric: "averageLatencyMs",
      actual: evaluatedMetrics.averageLatencyMs,
      operator: "<=",
      threshold: resolvedThresholds.maxLatencyMs
    });
  }

  if (evaluatedMetrics.averagePrecision < resolvedThresholds.minPrecision) {
    breaches.push({
      metric: "averagePrecision",
      actual: evaluatedMetrics.averagePrecision,
      operator: ">=",
      threshold: resolvedThresholds.minPrecision
    });
  }

  if (evaluatedMetrics.missRate > resolvedThresholds.maxMissRate) {
    breaches.push({
      metric: "missRate",
      actual: evaluatedMetrics.missRate,
      operator: "<=",
      threshold: resolvedThresholds.maxMissRate
    });
  }

  return {
    status: breaches.length === 0 ? "pass" : "fail",
    thresholds: resolvedThresholds,
    evaluatedMetrics,
    breaches
  };
}

export function buildRetrievalQualityDashboard(report) {
  const safeReport = report || buildRetrievalQualityReport([]);
  const qualityGates = evaluateRetrievalQualityGates(safeReport);
  const rankedMisses = Object.entries(safeReport.missDiagnostics || {})
    .sort((left, right) => right[1] - left[1])
    .map(([reason, count]) => ({ reason, count }));

  return {
    generatedAt: safeReport.generatedAt,
    cards: {
      attempts: safeReport.retrievalAttempts,
      averageLatencyMs: safeReport.averageLatencyMs,
      averagePrecision: safeReport.averagePrecision,
      missRate: safeReport.missRate
    },
    qualityGates,
    topMissReasons: rankedMisses.slice(0, 5)
  };
}
