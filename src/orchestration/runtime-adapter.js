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
    verificationCache: options.verificationCache
  });

  return {
    async orchestrateRouting(input) {
      const result = await orchestrator.processRequest({
        requestId: input.requestId,
        task: input.task,
        budget: input.budget,
        confirmation: input.confirmation,
        executionEvidence: input.executionEvidence
      });

      return {
        selectedSpecialist: result.selectedAgent || null,
        fallbackChain: result.fallbackChain || [],
        routeScores: result.routeScores || [],
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
        activeWeights: weightTuner ? weightTuner.getWeights() : (options.scoringWeights || DEFAULT_SCORING_WEIGHTS),
        rollingMetrics: weightTuner ? weightTuner.getRollingMetrics() : null,
        ok: result.ok,
        error: result.error || null
      };
    }
  };
}
