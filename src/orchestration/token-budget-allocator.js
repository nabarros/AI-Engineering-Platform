const TOKEN_LIMITS_BY_TIER = Object.freeze({
  LOW: Object.freeze({ request: 1400, workflow: 7000, objective: 20000 }),
  MEDIUM: Object.freeze({ request: 2800, workflow: 14000, objective: 42000 }),
  HIGH: Object.freeze({ request: 5200, workflow: 28000, objective: 84000 })
});

function normalizeTier(value) {
  const tier = String(value || "MEDIUM").toUpperCase();
  return Object.hasOwn(TOKEN_LIMITS_BY_TIER, tier) ? tier : "MEDIUM";
}

function ensureUsageMap(map, key) {
  if (!map.has(key)) {
    map.set(key, 0);
  }
  return map.get(key);
}

function toUsageEntry(map, key) {
  return map.has(key) ? map.get(key) : 0;
}

function downgradeTier(tier) {
  if (tier === "HIGH") return "MEDIUM";
  if (tier === "MEDIUM") return "LOW";
  return "LOW";
}

function computeRemaining(limit, used, requested) {
  const remainingBefore = Math.max(0, limit - used);
  const remainingAfter = Math.max(0, remainingBefore - requested);
  return {
    remainingBefore,
    remainingAfter
  };
}

export function createTokenBudgetAllocator(options = {}) {
  const requestUsage = new Map();
  const workflowUsage = new Map();
  const objectiveUsage = new Map();
  const limitsByTier = options.limitsByTier || TOKEN_LIMITS_BY_TIER;

  function allocate(input = {}) {
    const tier = normalizeTier(input.tier);
    const limits = limitsByTier[tier] || TOKEN_LIMITS_BY_TIER.MEDIUM;
    const requestId = String(input.requestId || "request:default");
    const workflowId = String(input.workflowId || "workflow:default");
    const objectiveId = String(input.objectiveId || "objective:default");
    const requestedTokens = Math.max(0, Number(input.requestedTokens) || 0);

    const requestUsed = ensureUsageMap(requestUsage, requestId);
    const workflowUsed = ensureUsageMap(workflowUsage, workflowId);
    const objectiveUsed = ensureUsageMap(objectiveUsage, objectiveId);

    const requestRemaining = computeRemaining(limits.request, requestUsed, requestedTokens);
    const workflowRemaining = computeRemaining(limits.workflow, workflowUsed, requestedTokens);
    const objectiveRemaining = computeRemaining(limits.objective, objectiveUsed, requestedTokens);

    if (objectiveUsed + requestedTokens > limits.objective) {
      return {
        allowed: false,
        action: "BLOCK_EXECUTION",
        reasonCode: "OBJECTIVE_LIMIT_EXCEEDED",
        effectiveTier: tier,
        allocatedTokens: 0,
        remaining: {
          request: requestRemaining.remainingBefore,
          workflow: workflowRemaining.remainingBefore,
          objective: objectiveRemaining.remainingBefore
        }
      };
    }

    if (workflowUsed + requestedTokens > limits.workflow) {
      const downgradedTier = downgradeTier(tier);
      return {
        allowed: true,
        action: "DOWNGRADE_MODEL",
        reasonCode: "WORKFLOW_LIMIT_EXCEEDED",
        effectiveTier: downgradedTier,
        allocatedTokens: Math.max(0, workflowRemaining.remainingBefore),
        remaining: {
          request: requestRemaining.remainingBefore,
          workflow: workflowRemaining.remainingBefore,
          objective: objectiveRemaining.remainingBefore
        }
      };
    }

    if (requestUsed + requestedTokens > limits.request) {
      return {
        allowed: true,
        action: "TRUNCATE_CONTEXT",
        reasonCode: "REQUEST_LIMIT_EXCEEDED",
        effectiveTier: tier,
        allocatedTokens: Math.max(0, requestRemaining.remainingBefore),
        remaining: {
          request: requestRemaining.remainingBefore,
          workflow: workflowRemaining.remainingBefore,
          objective: objectiveRemaining.remainingBefore
        }
      };
    }

    return {
      allowed: true,
      action: "ALLOW",
      reasonCode: "WITHIN_LIMITS",
      effectiveTier: tier,
      allocatedTokens: requestedTokens,
      remaining: {
        request: requestRemaining.remainingAfter,
        workflow: workflowRemaining.remainingAfter,
        objective: objectiveRemaining.remainingAfter
      }
    };
  }

  function recordUsage(input = {}) {
    const tier = normalizeTier(input.tier);
    const requestId = String(input.requestId || "request:default");
    const workflowId = String(input.workflowId || "workflow:default");
    const objectiveId = String(input.objectiveId || "objective:default");
    const consumedTokens = Math.max(0, Number(input.consumedTokens) || 0);

    ensureUsageMap(requestUsage, requestId);
    ensureUsageMap(workflowUsage, workflowId);
    ensureUsageMap(objectiveUsage, objectiveId);

    requestUsage.set(requestId, requestUsage.get(requestId) + consumedTokens);
    workflowUsage.set(workflowId, workflowUsage.get(workflowId) + consumedTokens);
    objectiveUsage.set(objectiveId, objectiveUsage.get(objectiveId) + consumedTokens);

    return {
      tier,
      requestId,
      workflowId,
      objectiveId,
      consumedTokens
    };
  }

  function usageSnapshot() {
    const requestTotals = {};
    const workflowTotals = {};
    const objectiveTotals = {};

    for (const [key, value] of requestUsage.entries()) {
      requestTotals[key] = value;
    }
    for (const [key, value] of workflowUsage.entries()) {
      workflowTotals[key] = value;
    }
    for (const [key, value] of objectiveUsage.entries()) {
      objectiveTotals[key] = value;
    }

    return {
      requestTotals,
      workflowTotals,
      objectiveTotals
    };
  }

  return {
    allocate,
    recordUsage,
    usageSnapshot,
    limitsByTier,
    getUsageFor(input = {}) {
      return {
        request: toUsageEntry(requestUsage, String(input.requestId || "request:default")),
        workflow: toUsageEntry(workflowUsage, String(input.workflowId || "workflow:default")),
        objective: toUsageEntry(objectiveUsage, String(input.objectiveId || "objective:default"))
      };
    }
  };
}

export { TOKEN_LIMITS_BY_TIER };
