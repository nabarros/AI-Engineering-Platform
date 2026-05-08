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
