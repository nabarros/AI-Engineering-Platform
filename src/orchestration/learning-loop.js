function toRate(successCount, totalCount) {
  if (totalCount === 0) return 0.75;
  return successCount / totalCount;
}

export class LearningLoop {
  constructor() {
    this.stats = new Map();
    this.domainStats = new Map();
  }

  recordOutcome(agentId, outcome) {
    const entry = this.stats.get(agentId) || {
      runs: 0,
      successes: 0,
      totalLatencyMs: 0,
      totalTokens: 0,
      lastRunAt: 0,
      recentOutcomes: []
    };

    entry.runs += 1;
    if (outcome.success === true) entry.successes += 1;
    entry.totalLatencyMs += Number(outcome.latencyMs || 0);
    entry.totalTokens += Number(outcome.tokenUsage || 0);
    entry.lastRunAt = Date.now();
    entry.recentOutcomes.push({
      success: outcome.success === true,
      timestamp: Date.now()
    });
    if (entry.recentOutcomes.length > 20) entry.recentOutcomes.shift();

    this.stats.set(agentId, entry);

    if (outcome.domain) {
      const domainKey = `${outcome.domain}:${agentId}`;
      const domainEntry = this.domainStats.get(domainKey) || { runs: 0, successes: 0 };
      domainEntry.runs += 1;
      if (outcome.success === true) domainEntry.successes += 1;
      this.domainStats.set(domainKey, domainEntry);
    }
  }

  getSnapshot() {
    const snapshot = {};

    for (const [agentId, stat] of this.stats.entries()) {
      const recentSuccesses = stat.recentOutcomes.filter((o) => o.success).length;
      const recentTotal = stat.recentOutcomes.length;

      snapshot[agentId] = {
        successRate: Number(toRate(stat.successes, stat.runs).toFixed(4)),
        recentSuccessRate: recentTotal > 0 ? Number(toRate(recentSuccesses, recentTotal).toFixed(4)) : null,
        avgLatencyMs: Number((stat.totalLatencyMs / stat.runs).toFixed(2)),
        avgTokenUsage: Number((stat.totalTokens / stat.runs).toFixed(2)),
        runs: stat.runs,
        lastRunAt: stat.lastRunAt
      };
    }

    return snapshot;
  }

  getDomainSnapshot() {
    const snapshot = {};
    for (const [key, stat] of this.domainStats.entries()) {
      snapshot[key] = {
        successRate: Number(toRate(stat.successes, stat.runs).toFixed(4)),
        runs: stat.runs
      };
    }
    return snapshot;
  }

  getAgentReliability(agentId) {
    const stat = this.stats.get(agentId);
    if (!stat || stat.runs === 0) return { reliable: true, confidence: 0 };

    const successRate = toRate(stat.successes, stat.runs);
    return {
      reliable: successRate >= 0.7,
      confidence: Math.min(stat.runs / 10, 1),
      successRate: Number(successRate.toFixed(4)),
      runs: stat.runs
    };
  }

  exportState() {
    const state = [];
    for (const [agentId, stat] of this.stats.entries()) {
      state.push([agentId, stat]);
    }
    return state;
  }

  importState(entries = []) {
    this.stats.clear();
    for (const item of entries) {
      if (!Array.isArray(item) || item.length !== 2) continue;
      const [agentId, stat] = item;
      this.stats.set(agentId, stat);
    }
  }
}
