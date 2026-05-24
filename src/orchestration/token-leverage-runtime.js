const STEP_TYPES = ["planning", "execution", "verification", "recovery"];

export function createStepBudgetEnvelopeAllocator({ tierLimits } = {}) {
  const defaults = tierLimits || {
    LOW: { planning: 200, execution: 800, verification: 250, recovery: 150 },
    MEDIUM: { planning: 350, execution: 1600, verification: 500, recovery: 300 },
    HIGH: { planning: 600, execution: 3200, verification: 900, recovery: 700 }
  };

  function allocate({ tier = "MEDIUM", stepType, requestedTokens }) {
    const normalizedTier = Object.hasOwn(defaults, tier) ? tier : "MEDIUM";
    const limits = defaults[normalizedTier];
    const normalizedStep = STEP_TYPES.includes(stepType) ? stepType : "execution";
    const limit = limits[normalizedStep];
    const requested = Math.max(0, Number(requestedTokens) || 0);

    return {
      tier: normalizedTier,
      stepType: normalizedStep,
      allowed: requested <= limit,
      allocatedTokens: Math.min(requested, limit),
      limit
    };
  }

  return { allocate, limitsByTier: defaults };
}

export function reallocateWorkflowBudget({ objectiveBudget, stepUsage = {}, rebalanceToward = "execution", maxShiftRatio = 0.1 } = {}) {
  const totalBudget = Math.max(0, Number(objectiveBudget) || 0);
  const normalizedUsage = {
    planning: Number(stepUsage.planning || 0),
    execution: Number(stepUsage.execution || 0),
    verification: Number(stepUsage.verification || 0),
    recovery: Number(stepUsage.recovery || 0)
  };

  const shift = Math.floor(totalBudget * Math.max(0, maxShiftRatio));
  const sourceSteps = Object.keys(normalizedUsage).filter((step) => step !== rebalanceToward);
  const perSource = sourceSteps.length > 0 ? Math.floor(shift / sourceSteps.length) : 0;

  for (const step of sourceSteps) {
    normalizedUsage[step] = Math.max(0, normalizedUsage[step] - perSource);
  }
  normalizedUsage[rebalanceToward] = (normalizedUsage[rebalanceToward] || 0) + shift;

  return {
    objectiveBudget: totalBudget,
    rebalanceToward,
    shiftedTokens: shift,
    redistributed: normalizedUsage
  };
}

export function compressContextWithGuardrails({ context = "", maxChars = 500, qualityThreshold = 0.85 } = {}) {
  const normalized = String(context || "").trim();
  const compressed = normalized.length > maxChars ? normalized.slice(0, maxChars) : normalized;
  const qualityScore = normalized.length === 0 ? 1 : Number((compressed.length / normalized.length).toFixed(4));

  return {
    compressed,
    droppedChars: Math.max(0, normalized.length - compressed.length),
    qualityScore,
    passesGuardrail: qualityScore >= qualityThreshold
  };
}

export function resolveStepAwareCachePolicy({ stepType, risk = "MEDIUM", confidence = 0.8 } = {}) {
  const normalizedStep = STEP_TYPES.includes(stepType) ? stepType : "execution";
  const normalizedRisk = String(risk || "MEDIUM").toUpperCase();
  const normalizedConfidence = Number.isFinite(Number(confidence)) ? Number(confidence) : 0.8;

  const baseTtlByStep = {
    planning: 900,
    execution: 300,
    verification: 120,
    recovery: 60
  };

  let ttlSeconds = baseTtlByStep[normalizedStep];
  if (normalizedRisk === "HIGH" || normalizedRisk === "CRITICAL") {
    ttlSeconds = Math.floor(ttlSeconds * 0.5);
  }
  if (normalizedConfidence >= 0.9) {
    ttlSeconds = Math.floor(ttlSeconds * 1.2);
  }

  return {
    stepType: normalizedStep,
    risk: normalizedRisk,
    confidence: normalizedConfidence,
    ttlSeconds,
    cacheAllowed: normalizedRisk !== "CRITICAL"
  };
}

export function optimizeModelPortfolio({ candidates = [], objective = "balanced" } = {}) {
  const normalizedCandidates = Array.isArray(candidates) ? candidates : [];

  const scored = normalizedCandidates.map((candidate) => {
    const quality = Number(candidate.quality || 0);
    const cost = Number(candidate.cost || 0);
    const latency = Number(candidate.latency || 0);

    const utility = objective === "cost"
      ? quality * 100 - cost * 10 - latency * 0.02
      : objective === "quality"
        ? quality * 120 - cost * 5 - latency * 0.01
        : quality * 110 - cost * 7 - latency * 0.015;

    return {
      ...candidate,
      utility: Number(utility.toFixed(4))
    };
  }).sort((left, right) => right.utility - left.utility);

  return {
    objective,
    selected: scored[0] || null,
    ranked: scored
  };
}

export function buildMonthlyTokenGovernanceReview({ month, rows = [] } = {}) {
  const items = Array.isArray(rows) ? rows : [];
  const totalTokens = items.reduce((sum, row) => sum + Number(row.tokens || 0), 0);
  const anomalyItems = items.filter((row) => Number(row.deltaPct || 0) >= 0.2);

  return {
    month: month || "unknown",
    totalTokens,
    rows: items,
    anomalies: anomalyItems,
    completion: "complete"
  };
}
