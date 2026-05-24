import test from "node:test";
import assert from "node:assert/strict";
import { AgentOrchestrator, ORCHESTRATION_STATES, assertLifecycleTransition } from "../../src/orchestration/orchestrator.js";
import { DEFAULT_CAPABILITY_REGISTRY } from "../../src/orchestration/default-capability-registry.js";
import { createVerificationCache } from "../../src/orchestration/verification-cache.js";

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
  assert.equal(result.lifecycleState, ORCHESTRATION_STATES.COMPLETED);
  assert.ok(result.trace.telemetryEventCount >= 1);
  assert.ok(result.relationshipShadowSummary.totalSamples >= 1);
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
  assert.equal(result.lifecycleState, ORCHESTRATION_STATES.FAILED);
});

test("should throw on invalid lifecycle transition", () => {
  assert.throws(
    () => assertLifecycleTransition(ORCHESTRATION_STATES.RECEIVED, ORCHESTRATION_STATES.COMPLETED),
    /Invalid lifecycle transition/
  );
});

test("should create recovery plan and complete orchestration when verification fails", async () => {
  const orchestrator = new AgentOrchestrator({ capabilityRegistry: DEFAULT_CAPABILITY_REGISTRY });

  const result = await orchestrator.processRequest({
    requestId: "req-003",
    task: {
      domain: "backend",
      risk: "MEDIUM",
      description: "Implement route safety and enforce verification"
    },
    budget: {
      tokenBudgetTier: "MEDIUM",
      latencyBudgetTier: "MEDIUM"
    },
    confirmation: true,
    executionEvidence: {
      testsPassed: false,
      securityChecksPassed: true,
      contractChecksPassed: true,
      errorHandlingValidated: true,
      qualityScore: 0.92,
      latencyMs: 160,
      tokenUsage: 3100
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.verification.pass, false);
  assert.equal(result.lifecycleState, ORCHESTRATION_STATES.COMPLETED);
  assert.ok(Array.isArray(result.recoveryPlan));
  assert.ok(result.recoveryPlan.length > 0);
  assert.equal(result.fallbackSelection.reason, "verification_failed");
  assert.equal(result.premiumFallback.trigger, true);
  assert.equal(result.premiumFallback.reason, "verification_failed");
  assert.ok(typeof result.fallbackSelection.specialistId === "string" || result.fallbackSelection.specialistId === null);
  assert.ok(Array.isArray(result.orientedContext));
});

test("should keep a callable selected agent after local-context score reordering", async () => {
  const orchestrator = new AgentOrchestrator({ capabilityRegistry: DEFAULT_CAPABILITY_REGISTRY });

  const result = await orchestrator.processRequest({
    requestId: "req-local-reorder-1",
    task: {
      domain: "backend",
      risk: "MEDIUM",
      description: "Implement backend API contract and validation"
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
      latencyMs: 120,
      tokenUsage: 2600
    },
    localContext: {
      isAvailable: true,
      isHealthy: true,
      services: {
        orchestration: { healthy: true, latencyMs: 20 },
        sharedState: { healthy: true, latencyMs: 18 },
        weaviate: { healthy: true, latencyMs: 26 },
        postgres: { healthy: true, latencyMs: 15 },
        redis: { healthy: true, latencyMs: 10 }
      },
      enrichmentData: {
        routerMemory: {
          successRates: {
            "AIEP Senior Staff Architect": 0.99,
            "AIEP Senior Staff Backend Engineer": 0.8
          }
        },
        capabilityRegistry: DEFAULT_CAPABILITY_REGISTRY
      }
    }
  });

  assert.equal(result.ok, true);
  assert.ok(typeof result.selectedAgent === "string" && result.selectedAgent.length > 0);
  assert.equal(result.selectedAgent, result.routeScores[0].capabilityId);
});

test("should fail with SKILL_POLICY_BLOCKED when selected agent lacks required skills", async () => {
  const registry = [
    {
      id: "AIEP Context Planner",
      domains: ["general", "planning", "risk", "strategy", "backend"],
      maxRisk: "HIGH",
      tokenCostTier: "LOW",
      latencyTier: "LOW",
      qualityScore: 0.99,
      supportsVerificationGate: true,
      supportsMemoryWrites: false,
      metadata: {
        ownerTeam: "plan",
        skillScopes: ["planning", "risk"]
      }
    }
  ];
  const orchestrator = new AgentOrchestrator({ capabilityRegistry: registry });

  const result = await orchestrator.processRequest({
    requestId: "req-004",
    task: {
      domain: "backend",
      risk: "LOW",
      description: "Implement backend security feature with performance checks"
    },
    budget: {
      tokenBudgetTier: "LOW",
      latencyBudgetTier: "LOW"
    },
    confirmation: true,
    executionEvidence: {
      testsPassed: true,
      securityChecksPassed: true,
      contractChecksPassed: true,
      errorHandlingValidated: true,
      qualityScore: 0.95
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.error, "SKILL_POLICY_BLOCKED");
  assert.equal(result.lifecycleState, ORCHESTRATION_STATES.FAILED);
  assert.ok(result.policy.deniedSkills.length > 0);
  assert.ok(Array.isArray(result.preflight.blockedReasonCodes));
  assert.ok(result.preflight.blockedReasonCodes.length > 0);
  assert.ok(Array.isArray(result.preflight.messages));
});

test("should include orientedContext in successful response", async () => {
  const orchestrator = new AgentOrchestrator({ capabilityRegistry: DEFAULT_CAPABILITY_REGISTRY });

  const result = await orchestrator.processRequest({
    requestId: "req-005",
    task: {
      domain: "backend",
      risk: "MEDIUM",
      description: "Implement backend feature with deterministic verification"
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
      latencyMs: 125,
      tokenUsage: 2500
    }
  });

  assert.equal(result.ok, true);
  assert.ok(Array.isArray(result.orientedContext));
  assert.ok(result.orientedContext.length > 0);
});

test("should use verification cache for repeated low risk requests", async () => {
  const verificationCache = createVerificationCache({ maxEntries: 10 });
  const orchestrator = new AgentOrchestrator({
    capabilityRegistry: DEFAULT_CAPABILITY_REGISTRY,
    verificationCache
  });

  const payload = {
    task: {
      domain: "review",
      risk: "LOW",
      description: "Review verification results for deterministic checks"
    },
    budget: {
      tokenBudgetTier: "LOW",
      latencyBudgetTier: "LOW"
    },
    confirmation: true,
    executionEvidence: {
      testsPassed: true,
      securityChecksPassed: true,
      contractChecksPassed: true,
      errorHandlingValidated: true,
      qualityScore: 0.9,
      latencyMs: 90,
      tokenUsage: 600
    }
  };

  const first = await orchestrator.processRequest({ requestId: "req-cache-1", ...payload });
  const second = await orchestrator.processRequest({ requestId: "req-cache-2", ...payload });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.ok(verificationCache.stats().hits >= 1);
});

test("should trigger premium fallback for low quality successful verification", async () => {
  const orchestrator = new AgentOrchestrator({ capabilityRegistry: DEFAULT_CAPABILITY_REGISTRY });

  const result = await orchestrator.processRequest({
    requestId: "req-006",
    task: {
      domain: "backend",
      risk: "MEDIUM",
      description: "Implement backend behavior and maintain quality"
    },
    budget: {
      tokenBudgetTier: "LOW",
      latencyBudgetTier: "LOW"
    },
    confirmation: true,
    executionEvidence: {
      testsPassed: true,
      securityChecksPassed: true,
      contractChecksPassed: true,
      errorHandlingValidated: true,
      qualityScore: 0.82,
      latencyMs: 130,
      tokenUsage: 1800
    }
  });

  assert.equal(result.verification.pass, true);
  assert.equal(result.premiumFallback.trigger, true);
  assert.equal(result.premiumFallback.reason, "low_quality");
});

test("should emit subset violation paging alert in production environment", async () => {
  const registry = [
    {
      id: "AIEP Context Planner",
      domains: ["general", "planning", "risk", "strategy", "backend"],
      maxRisk: "HIGH",
      tokenCostTier: "LOW",
      latencyTier: "LOW",
      qualityScore: 0.99,
      supportsVerificationGate: true,
      supportsMemoryWrites: false,
      metadata: {
        ownerTeam: "plan",
        skillScopes: ["planning", "risk"]
      }
    }
  ];
  const orchestrator = new AgentOrchestrator({ capabilityRegistry: registry });

  const result = await orchestrator.processRequest({
    requestId: "req-alert-001",
    task: {
      domain: "backend",
      risk: "LOW",
      description: "Implement backend security feature"
    },
    budget: {
      tokenBudgetTier: "LOW",
      latencyBudgetTier: "LOW"
    },
    runtimeEnvironment: "production",
    confirmation: true,
    executionEvidence: {
      testsPassed: true,
      securityChecksPassed: true,
      contractChecksPassed: true,
      errorHandlingValidated: true,
      qualityScore: 0.96
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.error, "SKILL_POLICY_BLOCKED");
  assert.equal(result.alerts.length, 1);
  assert.equal(result.alerts[0].alertName, "subset-policy-violation");
  assert.equal(result.alerts[0].page, true);
  assert.equal(result.alerts[0].severity, "critical");
});
