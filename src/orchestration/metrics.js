function ratio(numerator, denominator) {
  if (!denominator) return 0;
  return Number((numerator / denominator).toFixed(4));
}

export function buildQualityDashboard(executions) {
  const total = executions.length;
  const firstPassSuccesses = executions.filter((run) => run.verificationPass === true && run.fallbackUsed === false).length;
  const fallbacks = executions.filter((run) => run.fallbackUsed === true).length;
  const verificationFails = executions.filter((run) => run.verificationPass === false).length;
  const totalTokens = executions.reduce((sum, run) => sum + Number(run.tokenUsage || 0), 0);

  return {
    totalRuns: total,
    firstPassSuccessRate: ratio(firstPassSuccesses, total),
    fallbackRate: ratio(fallbacks, total),
    verificationFailRate: ratio(verificationFails, total),
    avgTokenUsage: total ? Number((totalTokens / total).toFixed(2)) : 0
  };
}

export function buildWeeklyCostQualityScorecard(executions, options = {}) {
  const items = Array.isArray(executions) ? executions : [];
  const groups = new Map();

  for (const run of items) {
    const objective = String(run?.objective || "unspecified");
    const modelTier = String(run?.modelTier || "standard");
    const key = `${objective}::${modelTier}`;
    const totalTokens = Number(run?.tokenUsage || (Number(run?.inputTokens || 0) + Number(run?.outputTokens || 0)) || 0);
    const passed = run?.verificationPass === true ? 1 : 0;

    if (!groups.has(key)) {
      groups.set(key, {
        objective,
        modelTier,
        tokenTotals: 0,
        passCount: 0,
        sampleCount: 0
      });
    }

    const aggregate = groups.get(key);
    aggregate.tokenTotals += totalTokens;
    aggregate.passCount += passed;
    aggregate.sampleCount += 1;
  }

  const grouped = [...groups.values()]
    .map((aggregate) => ({
      objective: aggregate.objective,
      modelTier: aggregate.modelTier,
      tokenTotals: aggregate.tokenTotals,
      avgTokens: aggregate.sampleCount > 0 ? Number((aggregate.tokenTotals / aggregate.sampleCount).toFixed(2)) : 0,
      passRate: aggregate.sampleCount > 0 ? ratio(aggregate.passCount, aggregate.sampleCount) : 0,
      sampleCount: aggregate.sampleCount
    }))
    .sort((left, right) => {
      if (left.objective !== right.objective) {
        return left.objective.localeCompare(right.objective);
      }
      return left.modelTier.localeCompare(right.modelTier);
    });

  return {
    generatedAt: typeof options.generatedAt === "number" ? options.generatedAt : Date.now(),
    totalExecutions: items.length,
    groups: grouped
  };
}
