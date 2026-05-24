export function definePublicBenchmarkSuite() {
  return {
    dimensions: ["quality", "cost", "latency", "governance", "recoverability"],
    fixtureCorpusVersion: "1.0.0",
    reproducible: true
  };
}

function seededRandom(seed) {
  let value = seed;
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

export function runDeterministicBenchmarkReplay({ suite, seed = 42, runs = 10 } = {}) {
  const next = seededRandom(seed);
  const samples = [];
  for (let index = 0; index < runs; index += 1) {
    samples.push(Number((0.75 + next() * 0.25).toFixed(4)));
  }

  return {
    suite,
    seed,
    runs,
    samples,
    deterministic: true
  };
}

export function buildQuarterlyBenchmarkScorecard({ quarter, reports = [] } = {}) {
  const normalized = Array.isArray(reports) ? reports : [];
  const avgScore = normalized.length === 0
    ? 0
    : Number((normalized.reduce((sum, report) => sum + Number(report.score || 0), 0) / normalized.length).toFixed(4));

  return {
    quarter: quarter || "unknown",
    reportCount: normalized.length,
    averageScore: avgScore,
    trendDelta: normalized.length >= 2 ? Number((Number(normalized.at(-1).score || 0) - Number(normalized[0].score || 0)).toFixed(4)) : 0,
    published: true
  };
}

export function runCompatibilityComparison({ baseline = [], candidate = [], adapters = {} } = {}) {
  const normalize = typeof adapters.normalize === "function"
    ? adapters.normalize
    : (value) => value;

  const baselineNormalized = baseline.map((row) => normalize(row));
  const candidateNormalized = candidate.map((row) => normalize(row));

  const overlap = baselineNormalized.filter((row) => candidateNormalized.includes(row)).length;
  const denominator = Math.max(1, baselineNormalized.length);

  return {
    overlap,
    baselineCount: baselineNormalized.length,
    candidateCount: candidateNormalized.length,
    compatibilityRate: Number((overlap / denominator).toFixed(4))
  };
}
