function normalizeModelTier(value) {
  const tier = String(value || "MEDIUM").toUpperCase();
  if (tier === "LOW" || tier === "MEDIUM" || tier === "HIGH") {
    return tier;
  }
  return "MEDIUM";
}

function normalizeTeam(value) {
  const team = String(value || "unknown").trim().toLowerCase();
  return team.length > 0 ? team : "unknown";
}

function normalizeDateBucket(timestampMs) {
  const value = Number(timestampMs);
  const date = Number.isFinite(value) ? new Date(value) : new Date();
  return date.toISOString().slice(0, 10);
}

function average(values) {
  if (values.length === 0) return 0;
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

export function buildSpendAttributionReport(executions, options = {}) {
  const rows = Array.isArray(executions) ? executions : [];
  const byTeam = new Map();

  for (const execution of rows) {
    const team = normalizeTeam(execution?.team || execution?.ownerTeam);
    const modelTier = normalizeModelTier(execution?.modelTier);
    const tokenUsage = Math.max(0, Number(execution?.tokenUsage || execution?.tokens) || 0);
    const dateBucket = normalizeDateBucket(execution?.timestampMs || execution?.timestamp || Date.now());

    if (!byTeam.has(team)) {
      byTeam.set(team, {
        team,
        totalTokens: 0,
        sampleCount: 0,
        byModelTier: { LOW: 0, MEDIUM: 0, HIGH: 0 },
        dailySpend: {}
      });
    }

    const aggregate = byTeam.get(team);
    aggregate.totalTokens += tokenUsage;
    aggregate.sampleCount += 1;
    aggregate.byModelTier[modelTier] += tokenUsage;
    aggregate.dailySpend[dateBucket] = Number(aggregate.dailySpend[dateBucket] || 0) + tokenUsage;
  }

  const teams = [...byTeam.values()]
    .map((entry) => ({
      team: entry.team,
      totalTokens: entry.totalTokens,
      sampleCount: entry.sampleCount,
      averageTokensPerRun: entry.sampleCount > 0 ? Number((entry.totalTokens / entry.sampleCount).toFixed(2)) : 0,
      byModelTier: entry.byModelTier,
      dailySpend: Object.keys(entry.dailySpend)
        .sort((left, right) => left.localeCompare(right))
        .map((dateBucket) => ({
          dateBucket,
          tokens: entry.dailySpend[dateBucket]
        }))
    }))
    .sort((left, right) => left.team.localeCompare(right.team));

  return {
    generatedAt: typeof options.generatedAt === "number" ? options.generatedAt : Date.now(),
    totalExecutions: rows.length,
    teams
  };
}

export function detectSpendAnomalies(report, options = {}) {
  const teams = Array.isArray(report?.teams) ? report.teams : [];
  const minTokensForAlert = Math.max(1000, Number(options.minTokensForAlert) || 7000);
  const spikeMultiplier = Math.max(1.1, Number(options.spikeMultiplier) || 1.8);
  const trailingWindowDays = Math.max(2, Number(options.trailingWindowDays) || 3);

  const alerts = [];

  for (const teamEntry of teams) {
    const points = Array.isArray(teamEntry.dailySpend) ? teamEntry.dailySpend : [];
    if (points.length < trailingWindowDays + 1) {
      continue;
    }

    const historical = points.slice(0, points.length - 1).map((point) => Number(point.tokens || 0));
    const recentWindow = historical.slice(Math.max(0, historical.length - trailingWindowDays));
    const baseline = average(recentWindow);
    const currentPoint = points[points.length - 1];
    const currentTokens = Number(currentPoint.tokens || 0);
    const threshold = Math.max(minTokensForAlert, baseline * spikeMultiplier);

    if (currentTokens > threshold) {
      alerts.push({
        alertName: "team-spend-anomaly",
        severity: currentTokens > threshold * 1.3 ? "critical" : "high",
        team: teamEntry.team,
        dateBucket: currentPoint.dateBucket,
        currentTokens,
        baselineTokens: Number(baseline.toFixed(2)),
        thresholdTokens: Number(threshold.toFixed(2)),
        message: `Team ${teamEntry.team} spend spiked above threshold.`
      });
    }
  }

  return {
    generatedAt: typeof report?.generatedAt === "number" ? report.generatedAt : Date.now(),
    alertCount: alerts.length,
    alerts
  };
}

export function buildSpendAttributionSnapshot(executions, options = {}) {
  const report = buildSpendAttributionReport(executions, options);
  const anomalies = detectSpendAnomalies(report, options);

  return {
    generatedAt: report.generatedAt,
    report,
    anomalies
  };
}
