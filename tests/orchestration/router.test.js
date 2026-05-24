import test from "node:test";
import assert from "node:assert/strict";
import { applyRiskBudgetOverrides, classifyTask, routeTask } from "../../src/orchestration/router.js";
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
  assert.equal(high.tokenBudgetTier, "MEDIUM");
  assert.equal(high.latencyBudgetTier, "MEDIUM");
  assert.ok(Array.isArray(high.budgetConflicts));

  const critical = applyRiskBudgetOverrides(
    { risk: "CRITICAL" },
    { tokenBudgetTier: "LOW", latencyBudgetTier: "MEDIUM" }
  );
  assert.equal(critical.tokenBudgetTier, "HIGH");
  assert.equal(critical.latencyBudgetTier, "HIGH");
  assert.ok(Array.isArray(critical.budgetConflicts));
});

test("should return applied budget in routeTask result", () => {
  const result = routeTask({
    task: { domain: "backend", risk: "HIGH" },
    registry: DEFAULT_CAPABILITY_REGISTRY,
    budget: { tokenBudgetTier: "LOW", latencyBudgetTier: "LOW" },
    learningStats: {}
  });

  assert.equal(result.appliedBudget.tokenBudgetTier, "MEDIUM");
  assert.equal(result.appliedBudget.latencyBudgetTier, "MEDIUM");
  assert.ok(Array.isArray(result.appliedBudget.budgetConflicts));
});

test("should normalize ui-ux alias to ux for explicit task domain", () => {
  const result = routeTask({
    task: { domain: "ui-ux", risk: "MEDIUM" },
    registry: DEFAULT_CAPABILITY_REGISTRY,
    budget: { tokenBudgetTier: "MEDIUM", latencyBudgetTier: "MEDIUM" },
    learningStats: {}
  });

  assert.equal(result.selected.id, "AIEP Senior Staff UI/UX Engineer");
});

test("should normalize ai-llm alias to ai for explicit task domain", () => {
  const result = routeTask({
    task: { domain: "ai-llm", risk: "MEDIUM" },
    registry: DEFAULT_CAPABILITY_REGISTRY,
    budget: { tokenBudgetTier: "HIGH", latencyBudgetTier: "MEDIUM" },
    learningStats: {}
  });

  assert.equal(result.selected.id, "AIEP Senior Staff AI/LLM Engineer");
});

test("should classify explicit alias domain as normalized primary domain", () => {
  const classification = classifyTask({
    domain: "ui/ux",
    description: "Review interaction hierarchy and accessibility regressions"
  });

  assert.equal(classification.primaryDomain, "ux");
});

test("should classify Azure DevOps and Ansible wording as devops domain", () => {
  const classification = classifyTask({
    description: "Create an Azure DevOps pipeline and Ansible playbook for Kubernetes rollout"
  });

  assert.equal(classification.primaryDomain, "devops");
});
