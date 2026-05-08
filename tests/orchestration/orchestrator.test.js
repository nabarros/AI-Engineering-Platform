import test from "node:test";
import assert from "node:assert/strict";
import { AgentOrchestrator } from "../../src/orchestration/orchestrator.js";
import { DEFAULT_CAPABILITY_REGISTRY } from "../../src/orchestration/default-capability-registry.js";

test("should orchestrate request, verify evidence, and produce trace", async () => {
  const orchestrator = new AgentOrchestrator({ capabilityRegistry: DEFAULT_CAPABILITY_REGISTRY });

  const result = await orchestrator.processRequest({
    requestId: "req-001",
    task: {
      domain: "backend",
      risk: "MEDIUM",
      description: "Implement deterministic routing and add verification tests"
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
      qualityScore: 0.92,
      latencyMs: 140,
      tokenUsage: 3400
    }
  });

  assert.equal(result.ok, true);
  assert.ok(result.selectedAgent);
  assert.equal(result.verification.pass, true);
  assert.equal(result.trace.verificationPass, true);
});

test("should block policy violating request", async () => {
  const orchestrator = new AgentOrchestrator({ capabilityRegistry: DEFAULT_CAPABILITY_REGISTRY });

  const result = await orchestrator.processRequest({
    requestId: "req-002",
    task: {
      domain: "backend",
      risk: "HIGH",
      description: "Modify auth service authorization behavior"
    },
    budget: {
      tokenBudgetTier: "LOW",
      latencyBudgetTier: "LOW"
    },
    confirmation: false,
    executionEvidence: {
      testsPassed: true,
      securityChecksPassed: true,
      contractChecksPassed: true,
      errorHandlingValidated: true,
      qualityScore: 0.9
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.error, "POLICY_BLOCKED");
});
