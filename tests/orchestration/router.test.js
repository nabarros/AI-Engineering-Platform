import test from "node:test";
import assert from "node:assert/strict";
import { routeTask } from "../../src/orchestration/router.js";
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
