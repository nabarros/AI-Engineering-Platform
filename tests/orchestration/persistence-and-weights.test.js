import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { AgentOrchestrator } from "../../src/orchestration/orchestrator.js";
import { DEFAULT_CAPABILITY_REGISTRY } from "../../src/orchestration/default-capability-registry.js";
import { routeTask } from "../../src/orchestration/router.js";
import { FileStateStore } from "../../src/orchestration/persistence/file-state-store.js";

test("should persist and restore orchestration memory and learning state", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aiep-orch-"));
  const stateFile = path.join(tempDir, "state.json");
  const store = new FileStateStore(stateFile);

  const orchestratorA = new AgentOrchestrator({
    capabilityRegistry: DEFAULT_CAPABILITY_REGISTRY,
    stateStore: store
  });

  const firstResult = await orchestratorA.processRequest({
    requestId: "persist-001",
    task: { domain: "backend", risk: "MEDIUM", description: "Implement endpoint and tests" },
    budget: { tokenBudgetTier: "LOW", latencyBudgetTier: "LOW" },
    confirmation: true,
    executionEvidence: {
      testsPassed: true,
      securityChecksPassed: true,
      contractChecksPassed: true,
      errorHandlingValidated: true,
      qualityScore: 0.91,
      latencyMs: 100,
      tokenUsage: 1700
    }
  });

  assert.equal(firstResult.ok, true);
  assert.equal(fs.existsSync(stateFile), true);

  const orchestratorB = new AgentOrchestrator({
    capabilityRegistry: DEFAULT_CAPABILITY_REGISTRY,
    stateStore: store
  });

  await orchestratorB.ready();
  const snapshot = orchestratorB.learning.getSnapshot();
  assert.ok(snapshot[firstResult.selectedAgent]);
});

test("should accept custom scoring weights for routing calibration", () => {
  const result = routeTask({
    task: { domain: "general", risk: "LOW" },
    registry: [
      {
        id: "high-quality-expensive",
        domains: ["general"],
        maxRisk: "HIGH",
        tokenCostTier: "HIGH",
        latencyTier: "LOW",
        qualityScore: 0.99,
        supportsVerificationGate: true,
        supportsMemoryWrites: true
      },
      {
        id: "cost-efficient",
        domains: ["general"],
        maxRisk: "HIGH",
        tokenCostTier: "LOW",
        latencyTier: "LOW",
        qualityScore: 0.88,
        supportsVerificationGate: true,
        supportsMemoryWrites: true
      }
    ],
    budget: { tokenBudgetTier: "LOW", latencyBudgetTier: "LOW" },
    scoringWeights: {
      domain: 0.2,
      quality: 0.1,
      learning: 0.1,
      cost: 0.5,
      latency: 0.1
    }
  });

  assert.equal(result.selected.id, "cost-efficient");
});
