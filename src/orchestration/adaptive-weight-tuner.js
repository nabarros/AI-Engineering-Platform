import { DEFAULT_SCORING_WEIGHTS } from "./router.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeWeights(weights) {
  const total = Object.values(weights).reduce((sum, current) => sum + current, 0);
  if (!total) return { ...DEFAULT_SCORING_WEIGHTS };

  return {
    domain: Number((weights.domain / total).toFixed(4)),
    quality: Number((weights.quality / total).toFixed(4)),
    learning: Number((weights.learning / total).toFixed(4)),
    cost: Number((weights.cost / total).toFixed(4)),
    latency: Number((weights.latency / total).toFixed(4))
  };
}

export class AdaptiveWeightTuner {
  constructor(options = {}) {
    this.windowSize = options.windowSize || 40;
    this.targetSuccessRate = options.targetSuccessRate || 0.9;
    this.targetAvgTokens = options.targetAvgTokens || 2800;
    this.targetAvgLatencyMs = options.targetAvgLatencyMs || 450;
    this.adjustmentStep = options.adjustmentStep || 0.03;
    this.weights = normalizeWeights(options.initialWeights || DEFAULT_SCORING_WEIGHTS);
    this.history = [];
  }

  getWeights() {
    return { ...this.weights };
  }

  exportState() {
    return {
      windowSize: this.windowSize,
      targetSuccessRate: this.targetSuccessRate,
      targetAvgTokens: this.targetAvgTokens,
      targetAvgLatencyMs: this.targetAvgLatencyMs,
      adjustmentStep: this.adjustmentStep,
      weights: this.weights,
      history: this.history
    };
  }

  importState(state = {}) {
    if (state.weights) {
      this.weights = normalizeWeights(state.weights);
    }
    if (Array.isArray(state.history)) {
      this.history = state.history.slice(-this.windowSize);
    }
  }

  observe(outcome) {
    const entry = {
      success: outcome.success === true,
      tokenUsage: Number(outcome.tokenUsage || 0),
      latencyMs: Number(outcome.latencyMs || 0)
    };

    this.history.push(entry);
    if (this.history.length > this.windowSize) {
      this.history.shift();
    }

    this.rebalance();
  }

  getRollingMetrics() {
    if (this.history.length === 0) {
      return {
        sampleSize: 0,
        successRate: 0,
        avgTokens: 0,
        avgLatencyMs: 0
      };
    }

    const sampleSize = this.history.length;
    const successCount = this.history.filter((entry) => entry.success).length;
    const tokenSum = this.history.reduce((sum, entry) => sum + entry.tokenUsage, 0);
    const latencySum = this.history.reduce((sum, entry) => sum + entry.latencyMs, 0);

    return {
      sampleSize,
      successRate: Number((successCount / sampleSize).toFixed(4)),
      avgTokens: Number((tokenSum / sampleSize).toFixed(2)),
      avgLatencyMs: Number((latencySum / sampleSize).toFixed(2))
    };
  }

  rebalance() {
    if (this.history.length < Math.max(10, Math.floor(this.windowSize / 4))) {
      return;
    }

    const metrics = this.getRollingMetrics();
    const nextWeights = { ...this.weights };

    if (metrics.successRate < this.targetSuccessRate) {
      nextWeights.quality += this.adjustmentStep;
      nextWeights.domain += this.adjustmentStep * 0.5;
      nextWeights.cost -= this.adjustmentStep * 0.5;
      nextWeights.latency -= this.adjustmentStep * 0.3;
    }

    if (metrics.avgTokens > this.targetAvgTokens) {
      nextWeights.cost += this.adjustmentStep;
      nextWeights.quality -= this.adjustmentStep * 0.3;
      nextWeights.learning -= this.adjustmentStep * 0.2;
    }

    if (metrics.avgLatencyMs > this.targetAvgLatencyMs) {
      nextWeights.latency += this.adjustmentStep;
      nextWeights.learning += this.adjustmentStep * 0.2;
      nextWeights.quality -= this.adjustmentStep * 0.2;
    }

    for (const key of Object.keys(nextWeights)) {
      nextWeights[key] = clamp(nextWeights[key], 0.02, 0.7);
    }

    this.weights = normalizeWeights(nextWeights);
  }
}
