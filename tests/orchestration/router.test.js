import test from "node:test";
import assert from "node:assert/strict";
import { applyRiskBudgetOverrides, routeTask } from "../../src/orchestration/router.js";
import { DEFAULT_CAPABILITY_REGISTRY } from "../../src/orchestration/default-capability-registry.js";

test("should select backend specialist for backend domain within budget", () => {
  const result = routeTask({
    task: { domain: "backend", risk: "MEDIUM" },
    registry: DEFAULT_CAPABILITY_REGISTRY,
    budget: { tokenBudgetTier: "MEDIUM", latencyBudgetTier: "MEDIUM" },
    learningStats: {}
  });

  assert.equal(result.selected.id, "AIEP Senior Staff Backend Engineer");
  assert.ok(result.fallbackChain.length > 0);
});

test("should penalize high token cost candidates when budget is low", () => {
  const registry = [
    {
      id: "premium-agent",
      domains: ["general"],
      maxRisk: "HIGH",
      tokenCostTier: "HIGH",
      latencyTier: "LOW",
      qualityScore: 0.99,
      supportsVerificationGate: true,
      supportsMemoryWrites: true
    },
    {
      id: "efficient-agent",
      domains: ["general"],
      maxRisk: "HIGH",
      tokenCostTier: "LOW",
      latencyTier: "LOW",
      qualityScore: 0.9,
      supportsVerificationGate: true,
      supportsMemoryWrites: true
    }
  ];

  const result = routeTask({
    task: { domain: "general", risk: "LOW" },
    registry,
    budget: { tokenBudgetTier: "LOW", latencyBudgetTier: "LOW" },
    learningStats: {}
  });

  assert.equal(result.selected.id, "efficient-agent");
});

test("should apply risk budget overrides for high and critical tasks", () => {
  const high = applyRiskBudgetOverrides(
    { risk: "HIGH" },
    { tokenBudgetTier: "LOW", latencyBudgetTier: "LOW" }
  );
  assert.deepEqual(high, { tokenBudgetTier: "MEDIUM", latencyBudgetTier: "MEDIUM" });

  const critical = applyRiskBudgetOverrides(
    { risk: "CRITICAL" },
    { tokenBudgetTier: "LOW", latencyBudgetTier: "MEDIUM" }
  );
  assert.deepEqual(critical, { tokenBudgetTier: "HIGH", latencyBudgetTier: "HIGH" });
});

test("should return applied budget in routeTask result", () => {
  const result = routeTask({
    task: { domain: "backend", risk: "HIGH" },
    registry: DEFAULT_CAPABILITY_REGISTRY,
    budget: { tokenBudgetTier: "LOW", latencyBudgetTier: "LOW" },
    learningStats: {}
  });

  assert.deepEqual(result.appliedBudget, { tokenBudgetTier: "MEDIUM", latencyBudgetTier: "MEDIUM" });
});
