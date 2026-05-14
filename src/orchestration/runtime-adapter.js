import { AgentOrchestrator } from "./orchestrator.js";
import { DEFAULT_CAPABILITY_REGISTRY } from "./default-capability-registry.js";
import { DEFAULT_SCORING_WEIGHTS } from "./router.js";

export function createRouterRuntimeAdapter(options = {}) {
  const weightTuner = options.weightTuner;
  const orchestrator = new AgentOrchestrator({
    capabilityRegistry: options.capabilityRegistry || DEFAULT_CAPABILITY_REGISTRY,
    stateStore: options.stateStore,
    scoringWeights: options.scoringWeights || DEFAULT_SCORING_WEIGHTS,
    weightTuner,
    relationshipShadowTracker: options.relationshipShadowTracker,
    exceptionRegistry: options.exceptionRegistry,
    verificationCache: options.verificationCache,
    tokenBudgetAllocator: options.tokenBudgetAllocator,
    tokenForecaster: options.tokenForecaster,
    downgradePolicy: options.downgradePolicy,
    responseCache: options.responseCache
  });

  return {
    async orchestrateRouting(input) {
      const result = await orchestrator.processRequest({
        requestId: input.requestId,
        task: input.task,
        budget: input.budget,
        confirmation: input.confirmation,
        executionEvidence: input.executionEvidence,
        runtimeEnvironment: input.runtimeEnvironment
      });

      const output = {
        selectedSpecialist: result.selectedAgent || null,
        fallbackChain: result.fallbackChain || [],
        routeScores: result.routeScores || [],
        routingConfidence: result.routingConfidence ?? null,
        needsClarification: result.needsClarification ?? false,
        classification: result.classification || null,
        compoundRoute: result.compoundRoute || null,
        verification: result.verification || null,
        lifecycleState: result.lifecycleState || null,
        trace: result.trace,
        plan: result.plan || [],
        recoveryPlan: result.recoveryPlan || null,
        fallbackSelection: result.fallbackSelection || { specialistId: null, reason: "none" },
        orientedContext: result.orientedContext || [],
        premiumFallback: result.premiumFallback || {
          trigger: false,
          reason: "none",
          recommendedBudgetTier: null
        },
        relationshipShadowSummary: result.relationshipShadowSummary || {
          totalSamples: 0,
          mismatches: 0,
          mismatchRate: 0,
          byMismatchType: {}
        },
        modelTierDecision: result.modelTierDecision || null,
        tokenForecast: result.tokenForecast || null,
        budgetDecision: result.budgetDecision || null,
        downgradeDecision: result.downgradeDecision || null,
        costQualityDecision: result.costQualityDecision || null,
        responseCacheContextHash: result.responseCacheContextHash || null,
        spendAttribution: result.spendAttribution || null,
        activeWeights: weightTuner ? weightTuner.getWeights() : (options.scoringWeights || DEFAULT_SCORING_WEIGHTS),
        rollingMetrics: weightTuner ? weightTuner.getRollingMetrics() : null,
        ok: result.ok,
        error: result.error || null
      };

      if (result.policy) {
        output.policy = result.policy;
      }

      if (result.preflight) {
        output.preflight = result.preflight;
      }

      if (result.alerts) {
        output.alerts = result.alerts;
      }

      return output;
    },

    invalidateResponseCacheByPolicyVersion(policyVersion) {
      return orchestrator.invalidateResponseCacheByPolicyVersion(policyVersion);
    },

    invalidateResponseCacheByContext(context) {
      return orchestrator.invalidateResponseCacheByContext(context);
    }
  };
}
