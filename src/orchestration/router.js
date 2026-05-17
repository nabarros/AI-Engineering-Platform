import { findCandidates } from "./capability-registry.js";

const COST_WEIGHTS = Object.freeze({ LOW: 1, MEDIUM: 2, HIGH: 3 });
const LATENCY_WEIGHTS = Object.freeze({ LOW: 1, MEDIUM: 2, HIGH: 3 });

// Penalty multipliers — cost penalised slightly harder than latency because
// token overruns directly affect billing; latency overruns degrade UX but
// are recoverable. Expose as named constants so tests can assert stability.
export const COST_OVERRUN_PENALTY = 0.45;
export const LATENCY_OVERRUN_PENALTY = 0.4;

// Score gap below which two candidates are considered ambiguous / tied.
export const NEAR_TIE_THRESHOLD = 0.03;

// Default learning success rate for capabilities with no observed history.
// Conservative prior avoids inflating new/unproven specialists.
export const DEFAULT_LEARNING_PRIOR = 0.6;

// Maximum unique agents produced by a compound routing plan.
export const MAX_COMPOUND_AGENTS = 4;

// Valid budget tier values for input validation.
const VALID_TIERS = new Set(["LOW", "MEDIUM", "HIGH"]);
const VALID_RISKS = new Set(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
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
  const requestedToken = String(budget?.tokenBudgetTier || "MEDIUM").toUpperCase();
  const requestedLatency = String(budget?.latencyBudgetTier || "MEDIUM").toUpperCase();
  const initialBudget = { tokenBudgetTier: requestedToken, latencyBudgetTier: requestedLatency };
  const budgetConflicts = [];

  if (risk === "CRITICAL") {
    if (requestedToken !== "HIGH") {
      budgetConflicts.push(`tokenBudgetTier overridden from ${requestedToken} to HIGH (CRITICAL risk requires HIGH budget)`);
    }
    if (requestedLatency !== "HIGH") {
      budgetConflicts.push(`latencyBudgetTier overridden from ${requestedLatency} to HIGH (CRITICAL risk requires HIGH latency budget)`);
    }
    return {
      tokenBudgetTier: "HIGH",
      latencyBudgetTier: "HIGH",
      ...(budgetConflicts.length > 0 && { budgetConflicts })
    };
  }

  if (risk === "HIGH") {
    const effectiveToken = maxTier(requestedToken, "MEDIUM");
    const effectiveLatency = maxTier(requestedLatency, "MEDIUM");
    if (effectiveToken !== requestedToken) {
      budgetConflicts.push(`tokenBudgetTier overridden from ${requestedToken} to ${effectiveToken} (HIGH risk requires minimum MEDIUM budget)`);
    }
    if (effectiveLatency !== requestedLatency) {
      budgetConflicts.push(`latencyBudgetTier overridden from ${requestedLatency} to ${effectiveLatency} (HIGH risk requires minimum MEDIUM latency budget)`);
    }
    return {
      tokenBudgetTier: effectiveToken,
      latencyBudgetTier: effectiveLatency,
      ...(budgetConflicts.length > 0 && { budgetConflicts })
    };
  }

  return initialBudget;
}

const DOMAIN_KEYWORDS = Object.freeze({
  frontend: ["react", "component", "ui", "css", "tsx", "jsx", "render", "hook", "state management", "dom", "browser"],
  backend: ["api", "endpoint", "server", "service", "database", "sql", "query", "rest", "graphql", "migration", "schema"],
  ux: ["user journey", "interaction", "usability", "accessibility", "a11y", "wireframe", "user flow", "persona"],
  sre: ["reliability", "sli", "slo", "incident", "monitoring", "alert", "uptime", "latency", "observability", "runbook"],
  ai: ["llm", "model", "prompt", "embedding", "rag", "inference", "token", "fine-tune", "vector", "ai", "ml", "neural"],
  architecture: ["system design", "service boundary", "adr", "architecture decision", "trade-off", "scalability", "component map"],
  devops: ["ci/cd", "pipeline", "deploy", "docker", "kubernetes", "terraform", "infrastructure", "release", "environment"],
  security: ["auth", "security", "vulnerability", "cve", "owasp", "credential", "encryption", "injection"],
  review: ["review", "code review", "audit", "inspect"],
  planning: ["plan", "decompose", "scope", "estimate", "roadmap"]
});

function clamp(number, min, max) {
  return Math.max(min, Math.min(number, max));
}

function scoreCostFitness(tokenBudgetTier, capabilityTier) {
  const budget = COST_WEIGHTS[tokenBudgetTier] || 2;
  const cost = COST_WEIGHTS[capabilityTier] || 2;
  if (cost <= budget) return 1;
  const delta = cost - budget;
  return clamp(1 - delta * COST_OVERRUN_PENALTY, 0, 1);
}

function scoreLatencyFitness(latencyBudgetTier, capabilityTier) {
  const budget = LATENCY_WEIGHTS[latencyBudgetTier] || 2;
  const latency = LATENCY_WEIGHTS[capabilityTier] || 2;
  if (latency <= budget) return 1;
  const delta = latency - budget;
  return clamp(1 - delta * LATENCY_OVERRUN_PENALTY, 0, 1);
}

function getLearningSuccessRate(learningStats, capabilityId) {
  const stats = learningStats?.[capabilityId];
  if (!stats || typeof stats.successRate !== "number") {
    return DEFAULT_LEARNING_PRIOR;
  }
  return clamp(stats.successRate, 0, 1);
}

function getDomainScore(taskDomain, capability) {
  const domain = String(taskDomain || "general").toLowerCase();
  if (capability.domains.includes(domain)) return 1;
  if (capability.domains.includes("general")) return 0.7;
  // Hard-penalise domain mismatches — a specialist with no domain overlap should
  // almost never beat a domain-matched agent regardless of quality/learning scores.
  return 0.05;
}

// Validate that task, registry, and budget are structurally usable before routing.
// Returns null when valid; returns a structured error string when invalid.
function validateRouteInputs(task, registry, budget) {
  if (!task || typeof task !== "object") return "task must be a non-null object";
  if (!task.description && !task.domain) return "task must have at least a description or domain";
  if (task.risk && !VALID_RISKS.has(String(task.risk).toUpperCase())) {
    return `task.risk "${task.risk}" is not valid; must be one of LOW, MEDIUM, HIGH, CRITICAL`;
  }
  if (!Array.isArray(registry) || registry.length === 0) return "registry must be a non-empty array";
  if (budget) {
    const tok = budget.tokenBudgetTier ? String(budget.tokenBudgetTier).toUpperCase() : null;
    const lat = budget.latencyBudgetTier ? String(budget.latencyBudgetTier).toUpperCase() : null;
    if (tok && !VALID_TIERS.has(tok)) return `budget.tokenBudgetTier "${budget.tokenBudgetTier}" is invalid; must be LOW, MEDIUM, or HIGH`;
    if (lat && !VALID_TIERS.has(lat)) return `budget.latencyBudgetTier "${budget.latencyBudgetTier}" is invalid; must be LOW, MEDIUM, or HIGH`;
  }
  return null;
}

// Deterministic tie-breaker for two equally-scored candidates.
// Priority: higher domainScore → higher qualityScore → lower cost tier → lower latency tier → lexicographic id.
function tieBreakCompare(a, b) {
  const sc = (entry) => entry.score.components;
  const diff = (fn) => fn(sc(b)) - fn(sc(a)); // b-a so larger wins
  return (
    diff((c) => c.domainScore) ||
    diff((c) => c.qualityScore) ||
    (COST_WEIGHTS[a.capability.tokenCostTier] || 2) - (COST_WEIGHTS[b.capability.tokenCostTier] || 2) || // lower cost wins
    (LATENCY_WEIGHTS[a.capability.latencyTier] || 2) - (LATENCY_WEIGHTS[b.capability.latencyTier] || 2) || // lower latency wins
    a.capability.id.localeCompare(b.capability.id) // stable lexicographic fallback
  );
}

export function detectDomains(description) {
  const text = String(description || "").toLowerCase();
  const detected = [];

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    const matchCount = keywords.filter((kw) => text.includes(kw)).length;
    if (matchCount > 0) {
      detected.push({ domain, confidence: clamp(matchCount / keywords.length, 0.1, 1), matchCount });
    }
  }

  return detected.sort((a, b) => b.confidence - a.confidence);
}

export function classifyTask(task) {
  const detectedDomains = detectDomains(task.description);
  const explicitDomain = task.domain ? [{ domain: task.domain, confidence: 1, matchCount: 0 }] : [];
  const allDomains = [...explicitDomain];

  for (const detected of detectedDomains) {
    if (!allDomains.find((d) => d.domain === detected.domain)) {
      allDomains.push(detected);
    }
  }

  const isCompound = allDomains.filter((d) => d.confidence >= 0.3).length > 1;
  const primaryDomain = allDomains[0]?.domain || "general";

  return {
    primaryDomain,
    allDomains,
    isCompound,
    domainCount: allDomains.filter((d) => d.confidence >= 0.3).length,
    confidence: allDomains[0]?.confidence || 0
  };
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
  const validationError = validateRouteInputs(task, registry, budget);
  if (validationError) {
    return {
      selected: null,
      fallbackChain: [],
      explanation: `Routing failed: ${validationError}`,
      scores: [],
      appliedBudget: null,
      classification: null,
      routingConfidence: 0,
      needsClarification: true,
      error: validationError
    };
  }

  const safeBudget = applyRiskBudgetOverrides(task, budget);

  const classification = classifyTask(task);
  const effectiveTask = { ...task, domain: task.domain || classification.primaryDomain };

  const candidates = findCandidates(effectiveTask, registry);
  if (candidates.length === 0) {
    return {
      selected: null,
      fallbackChain: [],
      explanation: "No candidates matched domain and risk constraints.",
      scores: [],
      appliedBudget: safeBudget,
      classification
    };
  }

  const scores = candidates
    .map((capability) => ({ capability, score: scoreCapability(capability, { task: effectiveTask, budget: safeBudget, learningStats, scoringWeights }) }))
    .sort((a, b) => {
      const scoreDiff = b.score.totalScore - a.score.totalScore;
      if (Math.abs(scoreDiff) > 1e-6) return scoreDiff;
      return tieBreakCompare(a, b);
    });

  const selected = scores[0].capability;
  const fallbackChain = scores.slice(1, 4).map((entry) => entry.capability.id);
  const topScore = scores[0].score.totalScore;
  const runnerUpScore = scores[1]?.score.totalScore ?? 0;
  const routingConfidence = clamp(topScore, 0, 1);
  const scoreGap = topScore - runnerUpScore;
  const isNearTie = scores.length > 1 && scoreGap < NEAR_TIE_THRESHOLD;

  // Surface budget conflicts produced by applyRiskBudgetOverrides so callers
  // are aware that their requested budget was silently adjusted.
  const budgetConflicts = safeBudget.budgetConflicts;

  return {
    selected,
    fallbackChain,
    explanation: `Selected ${selected.id} (confidence: ${(routingConfidence * 100).toFixed(1)}%) based on domain, quality, learning history, and budget fitness.`,
    scores: scores.map((entry) => ({ capabilityId: entry.capability.id, ...entry.score })),
    appliedBudget: safeBudget,
    classification,
    routingConfidence,
    scoreGap: Number(scoreGap.toFixed(4)),
    needsClarification: routingConfidence < 0.7 || isNearTie,
    ...(isNearTie && { nearTieWarning: `Score gap to runner-up is ${scoreGap.toFixed(4)} (below ${NEAR_TIE_THRESHOLD} threshold); consider providing more task context.` }),
    ...(budgetConflicts && budgetConflicts.length > 0 && { budgetConflicts })
  };
}

export function routeCompoundTask({ task, registry, budget, learningStats = {}, scoringWeights = DEFAULT_SCORING_WEIGHTS }) {
  const classification = classifyTask(task);

  if (!classification.isCompound) {
    return {
      isCompound: false,
      routes: [routeTask({ task, registry, budget, learningStats, scoringWeights })]
    };
  }

  const eligibleDomains = classification.allDomains.filter((d) => d.confidence >= 0.3);

  // Enforce agent cap: if too many domains are detected, keep the highest-confidence
  // ones and note that lower-confidence domains are folded into sequential execution.
  const cappedDomains = eligibleDomains.slice(0, MAX_COMPOUND_AGENTS);
  const droppedDomains = eligibleDomains.slice(MAX_COMPOUND_AGENTS);

  const subRoutes = cappedDomains.map((domainEntry) => {
    const subTask = { ...task, domain: domainEntry.domain };
    const route = routeTask({ task: subTask, registry, budget, learningStats, scoringWeights });
    return {
      domain: domainEntry.domain,
      confidence: domainEntry.confidence,
      route
    };
  });

  const uniqueAgents = [...new Set(subRoutes.map((sr) => sr.route.selected?.id).filter(Boolean))];

  return {
    isCompound: true,
    classification,
    routes: subRoutes,
    uniqueAgentsNeeded: uniqueAgents,
    recommendedStrategy: uniqueAgents.length <= 2 ? "sequential-peer" : "decompose-and-delegate",
    ...(droppedDomains.length > 0 && {
      agentCapWarning: `Compound task exceeded MAX_COMPOUND_AGENTS (${MAX_COMPOUND_AGENTS}). ${droppedDomains.length} lower-confidence domain(s) were dropped: ${droppedDomains.map((d) => d.domain).join(", ")}. Increase MAX_COMPOUND_AGENTS or decompose the task.`
    })
  };
}
