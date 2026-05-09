import { findCandidates } from "./capability-registry.js";

const COST_WEIGHTS = Object.freeze({ LOW: 1, MEDIUM: 2, HIGH: 3 });
const LATENCY_WEIGHTS = Object.freeze({ LOW: 1, MEDIUM: 2, HIGH: 3 });
export const DEFAULT_SCORING_WEIGHTS = Object.freeze({
  domain: 0.35,
  quality: 0.25,
  learning: 0.2,
  cost: 0.12,
  latency: 0.08
});

function tierRank(tier) {
  const normalized = String(tier || "MEDIUM").toUpperCase();
  return COST_WEIGHTS[normalized] || COST_WEIGHTS.MEDIUM;
}

function maxTier(left, right) {
  return tierRank(left) >= tierRank(right)
    ? String(left || "MEDIUM").toUpperCase()
    : String(right || "MEDIUM").toUpperCase();
}

export function applyRiskBudgetOverrides(task, budget = {}) {
  const risk = String(task?.risk || "MEDIUM").toUpperCase();
  const initialBudget = {
    tokenBudgetTier: String(budget?.tokenBudgetTier || "MEDIUM").toUpperCase(),
    latencyBudgetTier: String(budget?.latencyBudgetTier || "MEDIUM").toUpperCase()
  };

  if (risk === "CRITICAL") {
    return {
      tokenBudgetTier: "HIGH",
      latencyBudgetTier: "HIGH"
    };
  }

  if (risk === "HIGH") {
    return {
      tokenBudgetTier: maxTier(initialBudget.tokenBudgetTier, "MEDIUM"),
      latencyBudgetTier: maxTier(initialBudget.latencyBudgetTier, "MEDIUM")
    };
  }

  return initialBudget;
}

function clamp(number, min, max) {
  return Math.max(min, Math.min(number, max));
}

function scoreCostFitness(tokenBudgetTier, capabilityTier) {
  const budget = COST_WEIGHTS[tokenBudgetTier] || 2;
  const cost = COST_WEIGHTS[capabilityTier] || 2;
  if (cost <= budget) return 1;
  const delta = cost - budget;
  return clamp(1 - delta * 0.45, 0, 1);
}

function scoreLatencyFitness(latencyBudgetTier, capabilityTier) {
  const budget = LATENCY_WEIGHTS[latencyBudgetTier] || 2;
  const latency = LATENCY_WEIGHTS[capabilityTier] || 2;
  if (latency <= budget) return 1;
  const delta = latency - budget;
  return clamp(1 - delta * 0.4, 0, 1);
}

function getLearningSuccessRate(learningStats, capabilityId) {
  const stats = learningStats?.[capabilityId];
  if (!stats || typeof stats.successRate !== "number") {
    return 0.75;
  }
  return clamp(stats.successRate, 0, 1);
}

function getDomainScore(taskDomain, capability) {
  const domain = String(taskDomain || "general").toLowerCase();
  if (capability.domains.includes(domain)) return 1;
  if (capability.domains.includes("general")) return 0.7;
  return 0.2;
}

export function scoreCapability(capability, context) {
  const { task, budget, learningStats } = context;
  const weights = context.scoringWeights || DEFAULT_SCORING_WEIGHTS;
  const domainScore = getDomainScore(task.domain, capability);
  const qualityScore = clamp(capability.qualityScore, 0, 1);
  const learningScore = getLearningSuccessRate(learningStats, capability.id);
  const costScore = scoreCostFitness(budget.tokenBudgetTier, capability.tokenCostTier);
  const latencyScore = scoreLatencyFitness(budget.latencyBudgetTier, capability.latencyTier);

  const totalScore = (
    domainScore * weights.domain +
    qualityScore * weights.quality +
    learningScore * weights.learning +
    costScore * weights.cost +
    latencyScore * weights.latency
  );

  return {
    capabilityId: capability.id,
    totalScore: Number(totalScore.toFixed(4)),
    components: {
      domainScore,
      qualityScore,
      learningScore,
      costScore,
      latencyScore
    }
  };
}

export function routeTask({ task, registry, budget, learningStats = {}, scoringWeights = DEFAULT_SCORING_WEIGHTS }) {
  const safeBudget = applyRiskBudgetOverrides(task, budget);

  const candidates = findCandidates(task, registry);
  if (candidates.length === 0) {
    return {
      selected: null,
      fallbackChain: [],
      explanation: "No candidates matched domain and risk constraints.",
      scores: [],
      appliedBudget: safeBudget
    };
  }

  const scores = candidates
    .map((capability) => ({ capability, score: scoreCapability(capability, { task, budget: safeBudget, learningStats, scoringWeights }) }))
    .sort((a, b) => b.score.totalScore - a.score.totalScore);

  const selected = scores[0].capability;
  const fallbackChain = scores.slice(1, 4).map((entry) => entry.capability.id);

  return {
    selected,
    fallbackChain,
    explanation: `Selected ${selected.id} based on domain, quality, learning history, and budget fitness.`,
    scores: scores.map((entry) => ({ capabilityId: entry.capability.id, ...entry.score })),
    appliedBudget: safeBudget
  };
}
