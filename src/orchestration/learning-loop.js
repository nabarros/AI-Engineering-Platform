function toRate(successCount, totalCount) {
  if (totalCount === 0) return 0.75;
  return successCount / totalCount;
}

export class LearningLoop {
  constructor() {
    this.stats = new Map();
  }

  recordOutcome(agentId, outcome) {
    const entry = this.stats.get(agentId) || {
      runs: 0,
      successes: 0,
      totalLatencyMs: 0,
      totalTokens: 0
    };

    entry.runs += 1;
    if (outcome.success === true) entry.successes += 1;
    entry.totalLatencyMs += Number(outcome.latencyMs || 0);
    entry.totalTokens += Number(outcome.tokenUsage || 0);

    this.stats.set(agentId, entry);
  }

  getSnapshot() {
    const snapshot = {};

    for (const [agentId, stat] of this.stats.entries()) {
      snapshot[agentId] = {
        successRate: Number(toRate(stat.successes, stat.runs).toFixed(4)),
        avgLatencyMs: Number((stat.totalLatencyMs / stat.runs).toFixed(2)),
        avgTokenUsage: Number((stat.totalTokens / stat.runs).toFixed(2)),
        runs: stat.runs
      };
    }

    return snapshot;
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
