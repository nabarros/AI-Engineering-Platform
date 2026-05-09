import test from "node:test";
import assert from "node:assert/strict";
import {
  AgentOrchestrator,
  DEFAULT_CAPABILITY_REGISTRY,
  MODEL_TIER_POLICY_VERSION,
  resolveModelTierForStep,
  createTokenBudgetAllocator,
  createTokenForecaster,
  buildTokenForecastValidationReport,
  optimizeCostQuality,
  createResponseCache,
  buildContextHash,
  buildSpendAttributionSnapshot,
  createDowngradePolicy,
  runCostPolicyRedTeamEvaluation,
  createCostPolicyRedTeamScenarios
} from "../../src/orchestration/index.js";

test("should resolve model tier by step type, risk, and confidence band", () => {
  const lowRiskHighConfidence = resolveModelTierForStep({
    stepType: "routing",
    risk: "LOW",
    confidenceScore: 0.95
  });
  const highRisk = resolveModelTierForStep({
    stepType: "verification",
    risk: "HIGH",
    confidenceScore: 0.92
  });

  assert.equal(lowRiskHighConfidence.policyVersion, MODEL_TIER_POLICY_VERSION);
  assert.equal(lowRiskHighConfidence.confidenceBand, "HIGH");
  assert.equal(lowRiskHighConfidence.tier, "LOW");
  assert.equal(highRisk.tier, "HIGH");
});

test("should enforce deterministic token budget actions at request, workflow, and objective levels", () => {
  const allocator = createTokenBudgetAllocator();

  const within = allocator.allocate({
    tier: "LOW",
    requestId: "req-1",
    workflowId: "wf-1",
    objectiveId: "obj-1",
    requestedTokens: 1000
  });

  assert.equal(within.allowed, true);
  assert.equal(within.action, "ALLOW");

  allocator.recordUsage({ tier: "LOW", requestId: "req-1", workflowId: "wf-1", objectiveId: "obj-1", consumedTokens: 1300 });

  const requestExceeded = allocator.allocate({
    tier: "LOW",
    requestId: "req-1",
    workflowId: "wf-1",
    objectiveId: "obj-1",
    requestedTokens: 300
  });
  assert.equal(requestExceeded.action, "TRUNCATE_CONTEXT");

  allocator.recordUsage({ tier: "LOW", requestId: "req-2", workflowId: "wf-2", objectiveId: "obj-2", consumedTokens: 6900 });
  const workflowExceeded = allocator.allocate({
    tier: "LOW",
    requestId: "req-3",
    workflowId: "wf-2",
    objectiveId: "obj-2",
    requestedTokens: 200
  });
  assert.equal(workflowExceeded.action, "DOWNGRADE_MODEL");

  allocator.recordUsage({ tier: "LOW", requestId: "req-4", workflowId: "wf-4", objectiveId: "obj-3", consumedTokens: 19950 });
  const objectiveExceeded = allocator.allocate({
    tier: "LOW",
    requestId: "req-5",
    workflowId: "wf-5",
    objectiveId: "obj-3",
    requestedTokens: 120
  });
  assert.equal(objectiveExceeded.allowed, false);
  assert.equal(objectiveExceeded.action, "BLOCK_EXECUTION");
});

test("should forecast tokens and produce passing validation report with bounded error", () => {
  const forecaster = createTokenForecaster();
  forecaster.recordStepTelemetry({ stepType: "routing", risk: "LOW", modelTier: "LOW", objective: "review", tokens: 510 });
  forecaster.recordStepTelemetry({ stepType: "routing", risk: "LOW", modelTier: "LOW", objective: "review", tokens: 550 });
  forecaster.recordStepTelemetry({ stepType: "execution", risk: "MEDIUM", modelTier: "MEDIUM", objective: "backend", tokens: 2000 });
  forecaster.recordStepTelemetry({ stepType: "execution", risk: "MEDIUM", modelTier: "MEDIUM", objective: "backend", tokens: 2100 });

  const report = buildTokenForecastValidationReport({
    forecaster,
    generatedAt: 1710000000000,
    validationSamples: [
      { stepType: "routing", risk: "LOW", modelTier: "LOW", objective: "review", actualTokens: 535 },
      { stepType: "execution", risk: "MEDIUM", modelTier: "MEDIUM", objective: "backend", actualTokens: 2080 }
    ]
  });

  assert.equal(report.generatedAt, 1710000000000);
  assert.equal(report.status, "pass");
  assert.equal(report.sampleCount, 2);
  assert.ok(report.metrics.meanAbsolutePercentageError <= 0.2);
});

test("should optimize cost-quality with escalation guardrails and downgrade rules", () => {
  const escalated = optimizeCostQuality({
    risk: "HIGH",
    currentTier: "MEDIUM",
    qualityScore: 0.93,
    verificationPass: true,
    predictedTokens: 1800,
    downgradeDecision: { applied: true, recommendedTier: "LOW" }
  });
  assert.equal(escalated.recommendedTier, "HIGH");
  assert.equal(escalated.escalationTriggered, true);

  const downgraded = optimizeCostQuality({
    risk: "LOW",
    currentTier: "MEDIUM",
    qualityScore: 0.95,
    verificationPass: true,
    predictedTokens: 3000,
    downgradeDecision: { applied: true, recommendedTier: "LOW" }
  });
  assert.equal(downgraded.recommendedTier, "LOW");
  assert.equal(downgraded.downgradeApplied, true);
});

test("should invalidate response cache by policy version and context hash", () => {
  const cache = createResponseCache({ maxEntries: 3 });
  const contextHash = buildContextHash({
    task: { domain: "backend", risk: "LOW", description: "Cacheable request" },
    selectedAgent: "AIEP Senior Staff Backend Engineer"
  });

  cache.set({ policyVersion: "v1", contextHash }, { pass: true });
  assert.deepEqual(cache.get({ policyVersion: "v1", contextHash }), { pass: true });

  cache.set({ policyVersion: "v1", contextHash }, { pass: true });
  const removedByPolicy = cache.invalidateByPolicyVersion("v1");
  assert.equal(removedByPolicy, 1);
  assert.equal(cache.get({ policyVersion: "v1", contextHash }), null);

  cache.set({ policyVersion: "v2", contextHash }, { pass: false });
  const removedByContext = cache.invalidateByContextHash(contextHash);
  assert.equal(removedByContext, 1);
});

test("should attribute spend by team and trigger anomaly alerts", () => {
  const base = Date.UTC(2026, 3, 1);
  const snapshot = buildSpendAttributionSnapshot([
    { team: "be", modelTier: "MEDIUM", tokenUsage: 3000, timestampMs: base },
    { team: "be", modelTier: "MEDIUM", tokenUsage: 3200, timestampMs: base + 86400000 },
    { team: "be", modelTier: "HIGH", tokenUsage: 3400, timestampMs: base + 2 * 86400000 },
    { team: "be", modelTier: "HIGH", tokenUsage: 11000, timestampMs: base + 3 * 86400000 }
  ], {
    spikeMultiplier: 1.6,
    minTokensForAlert: 7000,
    trailingWindowDays: 3
  });

  assert.equal(snapshot.report.teams.length, 1);
  assert.equal(snapshot.anomalies.alertCount, 1);
  assert.equal(snapshot.anomalies.alerts[0].team, "be");
});

test("should support downgrade rollback switch", () => {
  const policy = createDowngradePolicy({ enabled: true, highVolumeThreshold: 10 });

  const active = policy.evaluate({ risk: "LOW", taskClass: "review", recentVolume: 12, currentTier: "MEDIUM" });
  assert.equal(active.applied, true);
  assert.equal(active.recommendedTier, "LOW");

  policy.setRollbackSwitch(true);
  const rolledBack = policy.evaluate({ risk: "LOW", taskClass: "review", recentVolume: 20, currentTier: "MEDIUM" });
  assert.equal(rolledBack.applied, false);
  assert.equal(rolledBack.reason, "rollback_switch_enabled");
});

test("should run red-team evaluation and keep high-severity bypass findings closed", () => {
  const report = runCostPolicyRedTeamEvaluation({
    scenarios: createCostPolicyRedTeamScenarios(),
    evaluator: (scenario) => {
      if (scenario.id === "RT-COST-001") return { controlOutcome: "force_premium", blocked: true };
      if (scenario.id === "RT-COST-002") return { controlOutcome: "objective_limit_blocks", blocked: true };
      if (scenario.id === "RT-COST-003") return { controlOutcome: "optimizer_downgrade_guardrail", blocked: true };
      return { controlOutcome: "unknown", blocked: false, severity: "HIGH" };
    }
  });

  assert.equal(report.summary.status, "pass");
  assert.equal(report.summary.openHighSeverityFindings, 0);
});

test("should return TOKEN_BUDGET_EXCEEDED when allocator blocks objective budget", async () => {
  const orchestrator = new AgentOrchestrator({
    capabilityRegistry: DEFAULT_CAPABILITY_REGISTRY,
    tokenBudgetAllocator: {
      allocate() {
        return {
          allowed: false,
          action: "BLOCK_EXECUTION",
          reasonCode: "OBJECTIVE_LIMIT_EXCEEDED",
          effectiveTier: "LOW",
          allocatedTokens: 0,
          remaining: { request: 0, workflow: 0, objective: 0 }
        };
      },
      recordUsage() {},
      usageSnapshot() {
        return {};
      }
    }
  });

  const result = await orchestrator.processRequest({
    requestId: "req-budget-block-1",
    task: {
      domain: "backend",
      risk: "MEDIUM",
      description: "Budget block integration test"
    },
    budget: {
      tokenBudgetTier: "MEDIUM",
      latencyBudgetTier: "MEDIUM"
    },
    confirmation: true,
    executionEvidence: {
      testsPassed: true,
      securityChecksPassed: true,
      contractChecksPassed: true,
      errorHandlingValidated: true,
      qualityScore: 0.9,
      tokenUsage: 2000,
      latencyMs: 180
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.error, "TOKEN_BUDGET_EXCEEDED");
  assert.equal(result.budgetDecision.action, "BLOCK_EXECUTION");
});
