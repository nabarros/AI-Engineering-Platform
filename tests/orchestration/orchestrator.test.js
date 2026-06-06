import test from "node:test";
import assert from "node:assert/strict";
import { AgentOrchestrator, ORCHESTRATION_STATES, assertLifecycleTransition } from "../../src/orchestration/orchestrator.js";
import { DEFAULT_CAPABILITY_REGISTRY } from "../../src/orchestration/default-capability-registry.js";
import { createVerificationCache } from "../../src/orchestration/verification-cache.js";
import { createSkillExceptionRegistry } from "../../src/orchestration/skill-exceptions.js";

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

test("should re-route to fallback specialist when primary preflight is blocked", async () => {
  const registry = [
    {
      id: "AIEP Test Context Planner",
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
    },
    {
      id: "AIEP Test Backend Engineer",
      domains: ["backend", "general"],
      maxRisk: "HIGH",
      tokenCostTier: "MEDIUM",
      latencyTier: "MEDIUM",
      qualityScore: 0.94,
      supportsVerificationGate: true,
      supportsMemoryWrites: true,
      metadata: {
        ownerTeam: "be",
        skillScopes: ["api", "backend", "testing"]
      }
    }
  ];

  const exceptionRegistry = createSkillExceptionRegistry();
  const expiresAt = Date.now() + 60_000;
  exceptionRegistry.grant({
    agentId: "AIEP Test Backend Engineer",
    skill: "backend",
    reason: "Temporary backend testing",
    approver: "staff-engineer",
    expiresAt
  });
  exceptionRegistry.grant({
    agentId: "AIEP Test Backend Engineer",
    skill: "feature-development",
    reason: "Temporary backend testing",
    approver: "staff-engineer",
    expiresAt
  });
  exceptionRegistry.grant({
    agentId: "AIEP Test Backend Engineer",
    skill: "testing",
    reason: "Temporary backend testing",
    approver: "staff-engineer",
    expiresAt
  });

  const orchestrator = new AgentOrchestrator({ 
    capabilityRegistry: registry,
    exceptionRegistry
  });

  const result = await orchestrator.processRequest({
    requestId: "req-preflight-fallback-001",
    task: {
      domain: "backend",
      risk: "LOW",
      description: "Implement backend feature with tests"
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
      qualityScore: 0.91,
      latencyMs: 110,
      tokenUsage: 1400
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.selectedAgent, "AIEP Test Backend Engineer");
  assert.ok(Array.isArray(result.delegation.attemptedAgents));
  assert.equal(result.delegation.attemptedAgents[0], "AIEP Test Context Planner");
  assert.equal(result.delegation.attemptedAgents[1], "AIEP Test Backend Engineer");
});

test("should return clarification-required when routing confidence is too low", async () => {
  const registry = [
    {
      id: "AIEP Ambiguous Generalist",
      domains: ["general"],
      maxRisk: "HIGH",
      tokenCostTier: "HIGH",
      latencyTier: "HIGH",
      qualityScore: 0.4,
      supportsVerificationGate: true,
      supportsMemoryWrites: false,
      metadata: {
        ownerTeam: "gen",
        skillScopes: ["testing"]
      }
    }
  ];
  const orchestrator = new AgentOrchestrator({ capabilityRegistry: registry });

  const result = await orchestrator.processRequest({
    requestId: "req-clarification-001",
    task: {
      domain: "unknown-domain",
      risk: "LOW",
      description: "Need help"
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
  assert.equal(result.error, "ROUTE_NEEDS_CLARIFICATION");
  assert.equal(result.delegation.status, "clarification_required");
  assert.equal(result.lifecycleState, ORCHESTRATION_STATES.FAILED);
});

test("should support multi-turn progression from delegated to blocked and back to delegated", async () => {
  const registry = [
    {
      id: "AIEP Senior Staff Backend Engineer",
      domains: ["backend"],
      maxRisk: "HIGH",
      tokenCostTier: "MEDIUM",
      latencyTier: "MEDIUM",
      qualityScore: 0.95,
      supportsVerificationGate: true,
      supportsMemoryWrites: true,
      metadata: {
        ownerTeam: "be",
        skillScopes: ["backend", "api", "testing"]
      }
    },
    {
      id: "AIEP Ambiguous Generalist A",
      domains: ["general"],
      maxRisk: "HIGH",
      tokenCostTier: "HIGH",
      latencyTier: "HIGH",
      qualityScore: 0.1,
      supportsVerificationGate: true,
      supportsMemoryWrites: false,
      metadata: {
        ownerTeam: "gen-a",
        skillScopes: ["testing"]
      }
    },
    {
      id: "AIEP Ambiguous Generalist B",
      domains: ["general"],
      maxRisk: "HIGH",
      tokenCostTier: "HIGH",
      latencyTier: "HIGH",
      qualityScore: 0.08,
      supportsVerificationGate: true,
      supportsMemoryWrites: false,
      metadata: {
        ownerTeam: "gen-b",
        skillScopes: ["testing"]
      }
    }
  ];

  const orchestrator = new AgentOrchestrator({ capabilityRegistry: registry });

  const turn1 = await orchestrator.processRequest({
    requestId: "multi-turn-001",
    task: {
      domain: "backend",
      risk: "LOW",
      description: "Implement backend endpoint and tests"
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
      qualityScore: 0.93,
      latencyMs: 95,
      tokenUsage: 1100
    }
  });

  assert.equal(turn1.ok, true);
  assert.equal(turn1.selectedAgent, "AIEP Senior Staff Backend Engineer");
  assert.equal(turn1.delegation.status, "delegated");

  const turn2 = await orchestrator.processRequest({
    requestId: "multi-turn-002",
    task: {
      domain: "unknown-domain",
      risk: "LOW",
      description: "Need help"
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
      qualityScore: 0.92,
      latencyMs: 90,
      tokenUsage: 400
    }
  });

  assert.equal(turn2.ok, false);
  assert.equal(turn2.error, "ROUTE_NEEDS_CLARIFICATION");
  assert.equal(turn2.delegation.status, "clarification_required");

  const turn3 = await orchestrator.processRequest({
    requestId: "multi-turn-003",
    task: {
      domain: "backend",
      risk: "LOW",
      description: "Clarification: update backend handler with explicit validation"
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
      qualityScore: 0.94,
      latencyMs: 98,
      tokenUsage: 1200
    }
  });

  assert.equal(turn3.ok, true);
  assert.equal(turn3.selectedAgent, "AIEP Senior Staff Backend Engineer");
  assert.equal(turn3.delegation.status, "delegated");
});

test("should enforce allocator downgrade over user-requested token tier by default", async () => {
  const orchestrator = new AgentOrchestrator({
    capabilityRegistry: DEFAULT_CAPABILITY_REGISTRY,
    tokenBudgetAllocator: {
      allocate() {
        return {
          allowed: true,
          action: "DOWNGRADE_MODEL",
          reasonCode: "WORKFLOW_LIMIT_EXCEEDED",
          effectiveTier: "LOW",
          allocatedTokens: 500,
          remaining: {
            request: 500,
            workflow: 500,
            objective: 500
          }
        };
      },
      recordUsage() {},
      usageSnapshot() {
        return {};
      }
    }
  });

  const result = await orchestrator.processRequest({
    requestId: "req-economy-enforced-001",
    task: {
      domain: "backend",
      risk: "LOW",
      description: "Implement lightweight backend validation updates"
    },
    budget: {
      tokenBudgetTier: "HIGH",
      latencyBudgetTier: "HIGH"
    },
    confirmation: true,
    executionEvidence: {
      testsPassed: true,
      securityChecksPassed: true,
      contractChecksPassed: true,
      errorHandlingValidated: true,
      qualityScore: 0.93,
      latencyMs: 110,
      tokenUsage: 450
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.appliedBudget.tokenBudgetTier, "LOW");
});

test("should block execution when truncation action has zero allocated tokens", async () => {
  const orchestrator = new AgentOrchestrator({
    capabilityRegistry: DEFAULT_CAPABILITY_REGISTRY,
    tokenBudgetAllocator: {
      allocate() {
        return {
          allowed: true,
          action: "TRUNCATE_CONTEXT",
          reasonCode: "REQUEST_LIMIT_EXCEEDED",
          effectiveTier: "LOW",
          allocatedTokens: 0,
          remaining: {
            request: 0,
            workflow: 0,
            objective: 0
          }
        };
      },
      recordUsage() {},
      usageSnapshot() {
        return {};
      }
    }
  });

  const result = await orchestrator.processRequest({
    requestId: "req-economy-block-001",
    task: {
      domain: "backend",
      risk: "LOW",
      description: "Attempt execution when no tokens remain"
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
      qualityScore: 0.95,
      latencyMs: 100,
      tokenUsage: 300
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.error, "TOKEN_BUDGET_EXCEEDED");
});

test("should cache deterministic medium-risk verification results", async () => {
  const verificationCache = createVerificationCache({ maxEntries: 10 });
  const orchestrator = new AgentOrchestrator({
    capabilityRegistry: DEFAULT_CAPABILITY_REGISTRY,
    verificationCache
  });

  const payload = {
    task: {
      domain: "backend",
      risk: "MEDIUM",
      description: "Apply deterministic backend validation flow"
    },
    budget: {
      tokenBudgetTier: "MEDIUM",
      latencyBudgetTier: "LOW"
    },
    confirmation: true,
    executionEvidence: {
      testsPassed: true,
      securityChecksPassed: true,
      contractChecksPassed: true,
      errorHandlingValidated: true,
      qualityScore: 0.95,
      latencyMs: 95,
      tokenUsage: 1200
    }
  };

  const first = await orchestrator.processRequest({ requestId: "req-medium-cache-1", ...payload });
  const second = await orchestrator.processRequest({ requestId: "req-medium-cache-2", ...payload });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.ok(verificationCache.stats().hits >= 1);
});

test("should skip verification when executionEvidence is omitted (routing-only)", async () => {
  const orchestrator = new AgentOrchestrator({
    capabilityRegistry: DEFAULT_CAPABILITY_REGISTRY
  });

  const result = await orchestrator.processRequest({
    requestId: "req-routing-only-001",
    task: {
      domain: "backend",
      risk: "LOW",
      description: "Simple query without execution evidence"
    },
    budget: {
      tokenBudgetTier: "MEDIUM",
      latencyBudgetTier: "MEDIUM"
    },
    confirmation: true,
    executionEvidence: null
  });

  assert.equal(result.ok, true);
  assert.equal(result.verification.routingOnly, true);
  assert.equal(result.premiumFallback.trigger, false);

  // Verify that it did not record stats in learning loop
  const snapshot = result.learningSnapshot;
  const agentId = result.selectedAgent;
  assert.equal(snapshot[agentId], undefined);
});

