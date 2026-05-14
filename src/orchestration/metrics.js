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
  const compoundTasks = executions.filter((run) => run.isCompound === true).length;
  const clarificationsNeeded = executions.filter((run) => run.needsClarification === true).length;

  const agentUsage = {};
  for (const run of executions) {
    const agent = run.selectedAgent || "unknown";
    agentUsage[agent] = (agentUsage[agent] || 0) + 1;
  }

  const domainDistribution = {};
  for (const run of executions) {
    const domain = run.primaryDomain || "unknown";
    domainDistribution[domain] = (domainDistribution[domain] || 0) + 1;
  }

  return {
    totalRuns: total,
    firstPassSuccessRate: ratio(firstPassSuccesses, total),
    fallbackRate: ratio(fallbacks, total),
    verificationFailRate: ratio(verificationFails, total),
    avgTokenUsage: total ? Number((totalTokens / total).toFixed(2)) : 0,
    compoundTaskRate: ratio(compoundTasks, total),
    clarificationRate: ratio(clarificationsNeeded, total),
    agentUsage,
    domainDistribution
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

function resolveTokenUsage(run) {
  return Number(run?.tokenUsage || (Number(run?.inputTokens || 0) + Number(run?.outputTokens || 0)) || 0);
}

function resolveTaskClass(run) {
  return String(run?.taskClass || run?.objective || "unspecified");
}

export function buildSubsetTokenImpactReport(executions, options = {}) {
  const items = Array.isArray(executions) ? executions : [];
  const groups = new Map();

  for (const run of items) {
    const taskClass = resolveTaskClass(run);
    const tokenUsage = resolveTokenUsage(run);
    const subsetApplied = run?.subsetApplied === true;

    if (!groups.has(taskClass)) {
      groups.set(taskClass, {
        taskClass,
        withSubsetTokens: 0,
        withSubsetCount: 0,
        withoutSubsetTokens: 0,
        withoutSubsetCount: 0
      });
    }

    const aggregate = groups.get(taskClass);
    if (subsetApplied) {
      aggregate.withSubsetTokens += tokenUsage;
      aggregate.withSubsetCount += 1;
    } else {
      aggregate.withoutSubsetTokens += tokenUsage;
      aggregate.withoutSubsetCount += 1;
    }
  }

  const byTaskClass = [...groups.values()]
    .map((aggregate) => {
      const avgWithSubset = aggregate.withSubsetCount > 0
        ? Number((aggregate.withSubsetTokens / aggregate.withSubsetCount).toFixed(2))
        : null;
      const avgWithoutSubset = aggregate.withoutSubsetCount > 0
        ? Number((aggregate.withoutSubsetTokens / aggregate.withoutSubsetCount).toFixed(2))
        : null;
      const avgSavings = avgWithSubset !== null && avgWithoutSubset !== null
        ? Number((avgWithoutSubset - avgWithSubset).toFixed(2))
        : null;
      const savingsRate = avgSavings !== null && avgWithoutSubset
        ? Number((avgSavings / avgWithoutSubset).toFixed(4))
        : null;

      return {
        taskClass: aggregate.taskClass,
        withSubset: {
          sampleCount: aggregate.withSubsetCount,
          tokenTotals: aggregate.withSubsetTokens,
          avgTokens: avgWithSubset
        },
        withoutSubset: {
          sampleCount: aggregate.withoutSubsetCount,
          tokenTotals: aggregate.withoutSubsetTokens,
          avgTokens: avgWithoutSubset
        },
        avgTokenSavings: avgSavings,
        savingsRate
      };
    })
    .sort((left, right) => left.taskClass.localeCompare(right.taskClass));

  const completeComparisons = byTaskClass.filter((entry) => {
    return entry.withSubset.sampleCount > 0 && entry.withoutSubset.sampleCount > 0 && entry.avgTokenSavings !== null;
  });

  const totalSavings = completeComparisons.reduce((sum, entry) => sum + Number(entry.avgTokenSavings || 0), 0);
  const averageSavingsRate = completeComparisons.length > 0
    ? Number((completeComparisons.reduce((sum, entry) => sum + Number(entry.savingsRate || 0), 0) / completeComparisons.length).toFixed(4))
    : 0;

  return {
    generatedAt: typeof options.generatedAt === "number" ? options.generatedAt : Date.now(),
    totalExecutions: items.length,
    comparedTaskClassCount: completeComparisons.length,
    averageSavingsRate,
    totalAverageTokenSavings: Number(totalSavings.toFixed(2)),
    byTaskClass
  };
}

export function buildSubsetTokenImpactDashboard(report) {
  const rows = Array.isArray(report?.byTaskClass) ? report.byTaskClass : [];
  const topSavings = [...rows]
    .filter((entry) => entry.avgTokenSavings !== null)
    .sort((left, right) => Number(right.avgTokenSavings || 0) - Number(left.avgTokenSavings || 0))
    .slice(0, 5)
    .map((entry) => ({
      taskClass: entry.taskClass,
      avgTokenSavings: entry.avgTokenSavings,
      savingsRate: entry.savingsRate
    }));

  return {
    generatedAt: report?.generatedAt || Date.now(),
    totalExecutions: Number(report?.totalExecutions || 0),
    comparedTaskClassCount: Number(report?.comparedTaskClassCount || 0),
    averageSavingsRate: Number(report?.averageSavingsRate || 0),
    topSavings
  };
}
