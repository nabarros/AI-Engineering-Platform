import { validateCapabilityRegistry } from "./capability-registry.js";
import { createExecutionPlan } from "./planner.js";
import { routeTask } from "./router.js";
import { enforcePolicy } from "./policy-engine.js";
import { verifyExecution } from "./verifier.js";
import { OrchestrationMemory } from "./memory-store.js";
import { TraceCollector } from "./tracer.js";
import { LearningLoop } from "./learning-loop.js";
import { runSkillSubsetDryRun } from "./skill-manifests.js";
import { retrieveOrientedContext } from "./retrieval-strategy.js";
import { createRelationshipShadowTracker, evaluateRelationshipShadow } from "./relationship-inference.js";
import { createVerificationCache } from "./verification-cache.js";
import { evaluateSubsetPolicyViolationAlert } from "./subset-policy-alerts.js";
import { resolveModelTierForStep } from "./model-tiering-policy.js";
import { createTokenBudgetAllocator } from "./token-budget-allocator.js";
import { createTokenForecaster } from "./token-forecaster.js";
import { optimizeCostQuality } from "./cost-quality-optimizer.js";
import { buildSpendAttributionSnapshot } from "./spend-attribution.js";
import { createDowngradePolicy } from "./downgrade-policy.js";
import { buildContextHash, createResponseCache } from "./response-cache.js";

export const ORCHESTRATION_STATES = Object.freeze({
  RECEIVED: "RECEIVED",
  POLICY_CHECKED: "POLICY_CHECKED",
  PLAN_CREATED: "PLAN_CREATED",
  ROUTED: "ROUTED",
  VERIFYING: "VERIFYING",
  VERIFIED: "VERIFIED",
  RECOVERING: "RECOVERING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED"
});

const ALLOWED_LIFECYCLE_TRANSITIONS = Object.freeze({
  [ORCHESTRATION_STATES.RECEIVED]: [ORCHESTRATION_STATES.POLICY_CHECKED],
  [ORCHESTRATION_STATES.POLICY_CHECKED]: [ORCHESTRATION_STATES.PLAN_CREATED, ORCHESTRATION_STATES.FAILED],
  [ORCHESTRATION_STATES.PLAN_CREATED]: [ORCHESTRATION_STATES.ROUTED, ORCHESTRATION_STATES.FAILED],
  [ORCHESTRATION_STATES.ROUTED]: [ORCHESTRATION_STATES.VERIFYING, ORCHESTRATION_STATES.FAILED],
  [ORCHESTRATION_STATES.VERIFYING]: [ORCHESTRATION_STATES.VERIFIED],
  [ORCHESTRATION_STATES.VERIFIED]: [ORCHESTRATION_STATES.COMPLETED, ORCHESTRATION_STATES.RECOVERING],
  [ORCHESTRATION_STATES.RECOVERING]: [ORCHESTRATION_STATES.COMPLETED],
  [ORCHESTRATION_STATES.COMPLETED]: [],
  [ORCHESTRATION_STATES.FAILED]: []
});

export function assertLifecycleTransition(fromState, toState) {
  const allowed = ALLOWED_LIFECYCLE_TRANSITIONS[fromState];
  if (!allowed) {
    throw new Error(`Unknown lifecycle state: ${fromState}`);
  }
  if (!allowed.includes(toState)) {
    throw new Error(`Invalid lifecycle transition: ${fromState} -> ${toState}`);
  }
}

function toCompactFindingsContext(findings) {
  if (!Array.isArray(findings) || findings.length === 0) {
    return "none";
  }
  return findings
    .slice(0, 5)
    .map((finding) => `${finding.code}:${finding.severity}`)
    .join(", ");
}

export class AgentOrchestrator {
  constructor({
    capabilityRegistry,
    stateStore = null,
    scoringWeights,
    weightTuner = null,
    relationshipShadowTracker = null,
    exceptionRegistry = null,
    verificationCache = null,
    tokenBudgetAllocator = null,
    tokenForecaster = null,
    downgradePolicy = null,
    responseCache = null
  }) {
    validateCapabilityRegistry(capabilityRegistry);
    this.capabilityRegistry = capabilityRegistry;
    this.memory = new OrchestrationMemory();
    this.learning = new LearningLoop();
    this.stateStore = stateStore;
    this.scoringWeights = scoringWeights;
    this.weightTuner = weightTuner;
    this.relationshipShadowTracker = relationshipShadowTracker || createRelationshipShadowTracker();
    this.exceptionRegistry = exceptionRegistry;
    this.verificationCache = verificationCache || createVerificationCache();
    this.tokenBudgetAllocator = tokenBudgetAllocator || createTokenBudgetAllocator();
    this.tokenForecaster = tokenForecaster || createTokenForecaster();
    this.downgradePolicy = downgradePolicy || createDowngradePolicy();
    this.responseCache = responseCache || createResponseCache();
    this.taskClassCounts = new Map();
    this.spendEvents = [];
    this.initializationPromise = this.stateStore ? this.restoreState() : Promise.resolve();

  }

  invalidateResponseCacheByPolicyVersion(policyVersion) {
    return this.responseCache.invalidateByPolicyVersion(policyVersion);
  }

  invalidateResponseCacheByContext(context = {}) {
    const contextHash = buildContextHash(context);
    const removed = this.responseCache.invalidateByContextHash(contextHash);
    return {
      contextHash,
      removed
    };
  }

  async restoreState() {
    const state = await Promise.resolve(this.stateStore.load());
    if (!state) return;

    this.memory.importState(state.memory || {});
    this.learning.importState(state.learning || []);
    if (this.weightTuner && state.weightTuner) {
      this.weightTuner.importState(state.weightTuner);
    }
  }

  async ready() {
    await this.initializationPromise;
  }

  async persistState() {
    if (!this.stateStore) return;
    await Promise.resolve(this.stateStore.save({
      memory: this.memory.exportState(),
      learning: this.learning.exportState(),
      weightTuner: this.weightTuner ? this.weightTuner.exportState() : null,
      updatedAt: Date.now()
    }));
  }

  async processRequest({ requestId, task, budget, confirmation = false, executionEvidence, runtimeEnvironment = "development" }) {
    await this.initializationPromise;

    const tracer = new TraceCollector(requestId);
    let lifecycleState = ORCHESTRATION_STATES.RECEIVED;
    tracer.addEvent("request.received", { domain: task.domain, risk: task.risk });

    const policy = enforcePolicy(task, { confirmed: confirmation });
    assertLifecycleTransition(lifecycleState, ORCHESTRATION_STATES.POLICY_CHECKED);
    lifecycleState = ORCHESTRATION_STATES.POLICY_CHECKED;
    tracer.addEvent("policy.checked", { allowed: policy.allowed, risk: policy.risk, violations: policy.violations });

    if (!policy.allowed) {
      assertLifecycleTransition(lifecycleState, ORCHESTRATION_STATES.FAILED);
      lifecycleState = ORCHESTRATION_STATES.FAILED;
      return {
        ok: false,
        error: "POLICY_BLOCKED",
        policy,
        lifecycleState,
        relationshipShadowSummary: this.relationshipShadowTracker.summary(),
        trace: tracer.summary()
      };
    }

    const plan = createExecutionPlan(task);
    assertLifecycleTransition(lifecycleState, ORCHESTRATION_STATES.PLAN_CREATED);
    lifecycleState = ORCHESTRATION_STATES.PLAN_CREATED;
    tracer.addEvent("plan.created", { steps: plan.length });
    this.memory.indexTaskMetadata(requestId, {
      requestId,
      domain: String(task.domain || "general").toLowerCase(),
      risk: String(task.risk || "MEDIUM").toUpperCase(),
      description: String(task.description || ""),
      planSteps: plan.length
    });

    const taskClass = String(task?.taskClass || task?.class || task?.domain || "general").toLowerCase();
    const workflowId = String(task?.workflowId || `workflow:${taskClass}`);
    const objectiveId = String(task?.objectiveId || `objective:${taskClass}`);
    const recentVolume = Number(this.taskClassCounts.get(taskClass) || 0) + 1;
    this.taskClassCounts.set(taskClass, recentVolume);

    const modelTierDecision = resolveModelTierForStep({
      stepType: "routing",
      risk: task?.risk,
      confidenceScore: task?.confidenceScore
    });
    const tokenForecast = this.tokenForecaster.forecast({
      stepType: "routing",
      risk: task?.risk,
      modelTier: modelTierDecision.tier,
      objective: objectiveId
    });
    const budgetDecision = this.tokenBudgetAllocator.allocate({
      tier: modelTierDecision.tier,
      requestId,
      workflowId,
      objectiveId,
      requestedTokens: tokenForecast.predictedTokens
    });

    tracer.addEvent("token.policy.evaluated", {
      modelTierDecision,
      tokenForecast,
      budgetDecision
    });

    if (!budgetDecision.allowed) {
      assertLifecycleTransition(lifecycleState, ORCHESTRATION_STATES.FAILED);
      lifecycleState = ORCHESTRATION_STATES.FAILED;
      return {
        ok: false,
        error: "TOKEN_BUDGET_EXCEEDED",
        budgetDecision,
        tokenForecast,
        modelTierDecision,
        lifecycleState,
        relationshipShadowSummary: this.relationshipShadowTracker.summary(),
        trace: tracer.summary()
      };
    }

    const downgradeDecision = this.downgradePolicy.evaluate({
      taskClass,
      risk: task?.risk,
      currentTier: budgetDecision.effectiveTier,
      recentVolume
    });

    const learningSnapshot = this.learning.getSnapshot();
    const activeWeights = this.weightTuner ? this.weightTuner.getWeights() : this.scoringWeights;
    const route = routeTask({
      task,
      registry: this.capabilityRegistry,
      budget: {
        ...(budget || {}),
        tokenBudgetTier: budgetDecision.effectiveTier
      },
      learningStats: learningSnapshot,
      scoringWeights: activeWeights
    });

    if (!route.selected) {
      assertLifecycleTransition(lifecycleState, ORCHESTRATION_STATES.FAILED);
      lifecycleState = ORCHESTRATION_STATES.FAILED;
      return {
        ok: false,
        error: "NO_ELIGIBLE_AGENT",
        route,
        lifecycleState,
        relationshipShadowSummary: this.relationshipShadowTracker.summary(),
        trace: tracer.summary()
      };
    }

    assertLifecycleTransition(lifecycleState, ORCHESTRATION_STATES.ROUTED);
    lifecycleState = ORCHESTRATION_STATES.ROUTED;
    tracer.addEvent("route.selected", {
      selectedAgent: route.selected.id,
      fallbackUsed: false,
      fallbackChain: route.fallbackChain
    });

    const relationshipShadow = evaluateRelationshipShadow({
      task,
      selectedSpecialist: route.selected.id
    });
    this.relationshipShadowTracker.record(relationshipShadow);
    tracer.addEvent("relationship.shadow.evaluated", relationshipShadow);

    this.memory.indexRepositoryMetadata(`agent:${route.selected.id}`, {
      specialistId: route.selected.id,
      domain: String(task.domain || "general").toLowerCase(),
      summary: `Selected ${route.selected.id} for ${String(task.domain || "general").toLowerCase()} tasks.`
    });

    const subsetDryRun = runSkillSubsetDryRun({
      agentId: route.selected.id,
      task,
      exceptionRegistry: this.exceptionRegistry,
      nowMs: Date.now()
    });
    tracer.addEvent("skill.preflight.checked", {
      agentId: route.selected.id,
      allowed: subsetDryRun.allowed,
      deniedSkills: subsetDryRun.policy.deniedSkills,
      blockedReasonCodes: subsetDryRun.blockedReasonCodes,
      exceptionAllowedSkills: subsetDryRun.policy.exceptionAllowedSkills
    });

    if (!subsetDryRun.allowed) {
      const subsetViolationAlert = evaluateSubsetPolicyViolationAlert({
        requestId,
        environment: runtimeEnvironment,
        selectedAgent: route.selected.id,
        deniedSkills: subsetDryRun.policy.deniedSkills,
        blockedReasonCodes: subsetDryRun.blockedReasonCodes,
        timestampMs: Date.now()
      });
      tracer.addEvent("skill.preflight.denied", {
        agentId: route.selected.id,
        blockedReasonCodes: subsetDryRun.blockedReasonCodes
      });
      tracer.addEvent("telemetry.skill_policy.violation", {
        environment: String(runtimeEnvironment || "development").toLowerCase(),
        alertTriggered: subsetViolationAlert.triggered,
        severity: subsetViolationAlert.triggered ? subsetViolationAlert.severity : null,
        deniedSkills: subsetDryRun.policy.deniedSkills,
        blockedReasonCodes: subsetDryRun.blockedReasonCodes
      });
      assertLifecycleTransition(lifecycleState, ORCHESTRATION_STATES.FAILED);
      lifecycleState = ORCHESTRATION_STATES.FAILED;
      return {
        ok: false,
        error: "SKILL_POLICY_BLOCKED",
        policy: subsetDryRun.policy,
        preflight: {
          blockedReasonCodes: subsetDryRun.blockedReasonCodes,
          messages: subsetDryRun.messages
        },
        selectedAgent: route.selected.id,
        alerts: subsetViolationAlert.triggered ? [subsetViolationAlert] : [],
        fallbackChain: route.fallbackChain,
        lifecycleState,
        relationshipShadowSummary: this.relationshipShadowTracker.summary(),
        trace: tracer.summary()
      };
    }

    this.memory.write("session", `${requestId}:plan`, plan, { ttlMs: 30 * 60 * 1000 });
    this.memory.write("patterns", `${task.domain}:last-selected-agent`, { agentId: route.selected.id }, { ttlMs: 24 * 60 * 60 * 1000 });

    const isLowRiskTask = String(task?.risk || "MEDIUM").toUpperCase() === "LOW";
    const cacheRequest = {
      task,
      selectedAgent: route.selected.id,
      executionEvidence
    };
    const responseCacheContext = {
      task,
      selectedAgent: route.selected.id,
      workflowId,
      objectiveId
    };
    const responseCacheContextHash = buildContextHash(responseCacheContext);

    assertLifecycleTransition(lifecycleState, ORCHESTRATION_STATES.VERIFYING);
    lifecycleState = ORCHESTRATION_STATES.VERIFYING;
    let verification = null;

    if (isLowRiskTask && this.verificationCache) {
      verification = this.verificationCache.get(cacheRequest);
      if (verification) {
        tracer.addEvent("verification.cache.hit", {
          selectedAgent: route.selected.id,
          risk: String(task?.risk || "LOW").toUpperCase()
        });
      }
    }

    if (!verification && isLowRiskTask && this.verificationCache) {
      verification = this.responseCache.get({
        policyVersion: modelTierDecision.policyVersion,
        contextHash: responseCacheContextHash
      });
      if (verification) {
        tracer.addEvent("response.cache.hit", {
          policyVersion: modelTierDecision.policyVersion,
          contextHash: responseCacheContextHash
        });
      }
    }

    if (!verification) {
      verification = verifyExecution(executionEvidence);
      if (isLowRiskTask && this.verificationCache) {
        this.verificationCache.set(cacheRequest, verification);
        tracer.addEvent("verification.cache.store", {
          selectedAgent: route.selected.id,
          risk: String(task?.risk || "LOW").toUpperCase()
        });
        this.responseCache.set({
          policyVersion: modelTierDecision.policyVersion,
          contextHash: responseCacheContextHash
        }, verification);
        tracer.addEvent("response.cache.store", {
          policyVersion: modelTierDecision.policyVersion,
          contextHash: responseCacheContextHash
        });
      }
    }

    assertLifecycleTransition(lifecycleState, ORCHESTRATION_STATES.VERIFIED);
    lifecycleState = ORCHESTRATION_STATES.VERIFIED;
    tracer.addEvent("verification.completed", { pass: verification.pass, findingCount: verification.findings.length });
    tracer.addEvent("telemetry.verification", {
      tokenUsage: executionEvidence?.tokenUsage ?? null,
      latencyMs: executionEvidence?.latencyMs ?? null,
      qualityScore: executionEvidence?.qualityScore ?? null
    });

    this.learning.recordOutcome(route.selected.id, {
      success: verification.pass,
      latencyMs: executionEvidence?.latencyMs || 0,
      tokenUsage: executionEvidence?.tokenUsage || 0
    });

    if (this.weightTuner) {
      this.weightTuner.observe({
        success: verification.pass,
        latencyMs: executionEvidence?.latencyMs || 0,
        tokenUsage: executionEvidence?.tokenUsage || 0
      });
    }

    await this.persistState();

    const qualityScore = typeof executionEvidence?.qualityScore === "number" ? executionEvidence.qualityScore : 0;
    const costQualityDecision = optimizeCostQuality({
      risk: task?.risk,
      qualityScore,
      verificationPass: verification.pass,
      currentTier: budgetDecision.effectiveTier,
      predictedTokens: tokenForecast.predictedTokens,
      downgradeDecision
    });

    const premiumFallback = {
      trigger: false,
      reason: "none",
      recommendedBudgetTier: costQualityDecision.recommendedTier || route.appliedBudget?.tokenBudgetTier || "MEDIUM"
    };

    if (!verification.pass) {
      premiumFallback.trigger = true;
      premiumFallback.reason = "verification_failed";
      premiumFallback.recommendedBudgetTier = "HIGH";
    } else if (qualityScore < 0.85) {
      premiumFallback.trigger = true;
      premiumFallback.reason = "low_quality";
      premiumFallback.recommendedBudgetTier = "MEDIUM";
    } else if (costQualityDecision.escalationTriggered) {
      premiumFallback.trigger = true;
      premiumFallback.reason = "risk_escalation";
      premiumFallback.recommendedBudgetTier = "HIGH";
    }

    this.tokenForecaster.recordStepTelemetry({
      stepType: "routing",
      risk: task?.risk,
      modelTier: costQualityDecision.recommendedTier,
      objective: objectiveId,
      tokens: Number(executionEvidence?.tokenUsage || tokenForecast.predictedTokens || 0)
    });

    this.tokenBudgetAllocator.recordUsage({
      tier: budgetDecision.effectiveTier,
      requestId,
      workflowId,
      objectiveId,
      consumedTokens: Number(executionEvidence?.tokenUsage || 0)
    });

    const team = String(route.selected?.metadata?.ownerTeam || "unknown");
    this.spendEvents.push({
      team,
      modelTier: costQualityDecision.recommendedTier,
      tokenUsage: Number(executionEvidence?.tokenUsage || 0),
      timestampMs: Date.now(),
      objective: objectiveId
    });
    if (this.spendEvents.length > 500) {
      this.spendEvents.shift();
    }
    const spendAttribution = buildSpendAttributionSnapshot(this.spendEvents);

    let recoveryPlan = null;
    let fallbackSelection = { specialistId: null, reason: "none" };
    if (!verification.pass) {
      assertLifecycleTransition(lifecycleState, ORCHESTRATION_STATES.RECOVERING);
      lifecycleState = ORCHESTRATION_STATES.RECOVERING;
      const selectedFallback = route.fallbackChain.length > 0 ? route.fallbackChain[0] : null;
      fallbackSelection = {
        specialistId: selectedFallback,
        reason: "verification_failed"
      };
      tracer.addEvent("relationship.fallback.selected", { specialistId: selectedFallback });
      recoveryPlan = createExecutionPlan({
        description: `${String(task.description || "Recovery")}. Recovery findings: ${toCompactFindingsContext(verification.findings)}.`
      });
      tracer.addEvent("recovery.plan.created", { steps: recoveryPlan.length });
    } else {
      tracer.addEvent("relationship.fallback.selected", { specialistId: null });
    }

    assertLifecycleTransition(lifecycleState, ORCHESTRATION_STATES.COMPLETED);
    lifecycleState = ORCHESTRATION_STATES.COMPLETED;

    return {
      ok: verification.pass,
      selectedAgent: route.selected.id,
      fallbackChain: route.fallbackChain,
      routeScores: route.scores,
      appliedBudget: route.appliedBudget,
      budgetDecision,
      modelTierDecision,
      tokenForecast,
      downgradeDecision,
      costQualityDecision,
      plan,
      recoveryPlan,
      fallbackSelection,
      orientedContext: retrieveOrientedContext(this.memory, task),
      verification,
      premiumFallback,
      responseCacheContextHash,
      spendAttribution,
      relationshipShadowSummary: this.relationshipShadowTracker.summary(),
      lifecycleState,
      activeWeights,
      rollingMetrics: this.weightTuner ? this.weightTuner.getRollingMetrics() : null,
      learningSnapshot: this.learning.getSnapshot(),
      trace: tracer.summary()
    };
  }
}
