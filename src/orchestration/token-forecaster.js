const DEFAULT_BASELINES = Object.freeze({
  routing: 650,
  planning: 1200,
  execution: 2200,
  verification: 750,
  recovery: 1800,
  objective: 1400,
  default: 1000
});

function normalizeStepType(value) {
  const stepType = String(value || "default").toLowerCase();
  return Object.hasOwn(DEFAULT_BASELINES, stepType) ? stepType : "default";
}

function normalizeRisk(value) {
  const risk = String(value || "MEDIUM").toUpperCase();
  if (risk === "LOW" || risk === "MEDIUM" || risk === "HIGH" || risk === "CRITICAL") {
    return risk;
  }
  return "MEDIUM";
}

function round(value, precision = 2) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function percentile(values, percentileRank) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(percentileRank * sorted.length) - 1));
  return sorted[index];
}

function buildBucketKey(input = {}) {
  const stepType = normalizeStepType(input.stepType);
  const risk = normalizeRisk(input.risk);
  const modelTier = String(input.modelTier || "MEDIUM").toUpperCase();
  const objective = String(input.objective || "general").toLowerCase();
  return `${stepType}|${risk}|${modelTier}|${objective}`;
}

export function createTokenForecaster(options = {}) {
  const maxSamplesPerBucket = Math.max(5, Number(options.maxSamplesPerBucket) || 120);
  const buckets = new Map();

  function getOrCreateBucket(key) {
    if (!buckets.has(key)) {
      buckets.set(key, []);
    }
    return buckets.get(key);
  }

  function recordStepTelemetry(sample = {}) {
    const key = buildBucketKey(sample);
    const tokens = Math.max(0, Number(sample.tokens) || 0);
    const bucket = getOrCreateBucket(key);
    bucket.push(tokens);

    while (bucket.length > maxSamplesPerBucket) {
      bucket.shift();
    }

    return {
      bucketKey: key,
      sampleCount: bucket.length,
      latestTokens: tokens
    };
  }

  function forecast(input = {}) {
    const key = buildBucketKey(input);
    const bucket = buckets.get(key) || [];
    const stepType = normalizeStepType(input.stepType);

    if (bucket.length === 0) {
      const baseline = DEFAULT_BASELINES[stepType] || DEFAULT_BASELINES.default;
      const errorBound = Math.max(80, Math.round(baseline * 0.25));
      return {
        bucketKey: key,
        predictedTokens: baseline,
        errorBound,
        sampleCount: 0,
        source: "baseline"
      };
    }

    const sum = bucket.reduce((total, value) => total + value, 0);
    const mean = sum / bucket.length;
    const deviations = bucket.map((value) => Math.abs(value - mean));
    const errorBound = Math.max(60, Math.round(percentile(deviations, 0.9)));

    return {
      bucketKey: key,
      predictedTokens: Math.round(mean),
      errorBound,
      sampleCount: bucket.length,
      source: "historical"
    };
  }

  function snapshot() {
    const rows = [];
    for (const [bucketKey, values] of buckets.entries()) {
      const sum = values.reduce((total, value) => total + value, 0);
      rows.push({
        bucketKey,
        sampleCount: values.length,
        averageTokens: values.length ? round(sum / values.length) : 0
      });
    }
    return rows.sort((left, right) => left.bucketKey.localeCompare(right.bucketKey));
  }

  return {
    recordStepTelemetry,
    forecast,
    snapshot
  };
}

export function buildTokenForecastValidationReport(input = {}) {
  const samples = Array.isArray(input.validationSamples) ? input.validationSamples : [];
  const forecaster = input.forecaster;
  const maxMeanAbsolutePercentageError = Number(input.maxMeanAbsolutePercentageError || 0.2);
  const minCoverageWithinErrorBound = Number(input.minCoverageWithinErrorBound || 0.85);

  let absolutePercentageErrorTotal = 0;
  let measuredCount = 0;
  let withinBound = 0;

  const sampleRows = [];

  for (const sample of samples) {
    const prediction = forecaster.forecast(sample);
    const actualTokens = Math.max(0, Number(sample.actualTokens || sample.tokens) || 0);
    const absoluteError = Math.abs(actualTokens - prediction.predictedTokens);
    const absolutePercentageError = actualTokens > 0 ? absoluteError / actualTokens : 0;

    measuredCount += 1;
    absolutePercentageErrorTotal += absolutePercentageError;
    if (absoluteError <= prediction.errorBound) {
      withinBound += 1;
    }

    sampleRows.push({
      stepType: normalizeStepType(sample.stepType),
      risk: normalizeRisk(sample.risk),
      modelTier: String(sample.modelTier || "MEDIUM").toUpperCase(),
      objective: String(sample.objective || "general").toLowerCase(),
      actualTokens,
      predictedTokens: prediction.predictedTokens,
      errorBound: prediction.errorBound,
      absoluteError,
      withinErrorBound: absoluteError <= prediction.errorBound
    });
  }

  const meanAbsolutePercentageError = measuredCount ? round(absolutePercentageErrorTotal / measuredCount, 4) : 0;
  const coverageWithinErrorBound = measuredCount ? round(withinBound / measuredCount, 4) : 0;

  const breaches = [];
  if (meanAbsolutePercentageError > maxMeanAbsolutePercentageError) {
    breaches.push({
      metric: "meanAbsolutePercentageError",
      actual: meanAbsolutePercentageError,
      operator: "<=",
      threshold: maxMeanAbsolutePercentageError
    });
  }
  if (coverageWithinErrorBound < minCoverageWithinErrorBound) {
    breaches.push({
      metric: "coverageWithinErrorBound",
      actual: coverageWithinErrorBound,
      operator: ">=",
      threshold: minCoverageWithinErrorBound
    });
  }

  return {
    generatedAt: typeof input.generatedAt === "number" ? input.generatedAt : Date.now(),
    sampleCount: measuredCount,
    thresholds: {
      maxMeanAbsolutePercentageError,
      minCoverageWithinErrorBound
    },
    metrics: {
      meanAbsolutePercentageError,
      coverageWithinErrorBound
    },
    status: breaches.length === 0 ? "pass" : "fail",
    breaches,
    samples: sampleRows
  };
}
