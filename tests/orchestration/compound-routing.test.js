import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectDomains, classifyTask, routeCompoundTask, routeTask, DEFAULT_SCORING_WEIGHTS } from "../../src/orchestration/router.js";
import { DEFAULT_CAPABILITY_REGISTRY } from "../../src/orchestration/default-capability-registry.js";

describe("detectDomains", () => {
  it("should detect frontend domain from React keywords", () => {
    const result = detectDomains("Create a React component with state management and hooks");
    const frontendDomain = result.find((d) => d.domain === "frontend");
    assert.ok(frontendDomain, "Should detect frontend domain");
    assert.ok(frontendDomain.confidence > 0, "Should have positive confidence");
  });

  it("should detect backend domain from API keywords", () => {
    const result = detectDomains("Build a REST API endpoint with database queries");
    const backendDomain = result.find((d) => d.domain === "backend");
    assert.ok(backendDomain, "Should detect backend domain");
  });

  it("should detect multiple domains from compound description", () => {
    const result = detectDomains("Create an API endpoint and a React component to call it");
    const domains = result.map((d) => d.domain);
    assert.ok(domains.includes("backend"), "Should detect backend");
    assert.ok(domains.includes("frontend"), "Should detect frontend");
  });

  it("should detect AI/LLM domain from model keywords", () => {
    const result = detectDomains("Optimize the LLM prompt template for embedding generation with RAG");
    const aiDomain = result.find((d) => d.domain === "ai");
    assert.ok(aiDomain, "Should detect AI domain");
    assert.ok(aiDomain.matchCount >= 3, "Should match multiple AI keywords");
  });

  it("should detect DevOps domain from infrastructure keywords", () => {
    const result = detectDomains("Set up CI/CD pipeline with Docker containers and Kubernetes deployment");
    const devopsDomain = result.find((d) => d.domain === "devops");
    assert.ok(devopsDomain, "Should detect DevOps domain");
  });

  it("should return empty array for generic description", () => {
    const result = detectDomains("Do something");
    assert.equal(result.length, 0);
  });
});

describe("classifyTask", () => {
  it("should classify single-domain task", () => {
    const result = classifyTask({ description: "Fix the React component rendering bug", domain: "frontend" });
    assert.equal(result.isCompound, false);
    assert.equal(result.primaryDomain, "frontend");
  });

  it("should classify compound task spanning frontend and backend", () => {
    const result = classifyTask({ description: "Build a REST API endpoint with database SQL query and server service, then create a React component with hooks and state management to render the DOM" });
    assert.equal(result.isCompound, true);
    assert.ok(result.domainCount >= 2, `Should detect at least 2 domains, got ${result.domainCount}: ${JSON.stringify(result.allDomains)}`);
  });

  it("should prefer explicit domain over detected", () => {
    const result = classifyTask({ description: "Some generic task", domain: "sre" });
    assert.equal(result.primaryDomain, "sre");
  });

  it("should fallback to general when no domain detected", () => {
    const result = classifyTask({ description: "Hello world" });
    assert.equal(result.primaryDomain, "general");
  });
});

describe("routeCompoundTask", () => {
  it("should return single route for non-compound task", () => {
    const result = routeCompoundTask({
      task: { domain: "backend", risk: "LOW", description: "Fix API bug" },
      registry: DEFAULT_CAPABILITY_REGISTRY,
      budget: { tokenBudgetTier: "MEDIUM", latencyBudgetTier: "MEDIUM" }
    });
    assert.equal(result.isCompound, false);
    assert.equal(result.routes.length, 1);
  });

  it("should return multiple sub-routes for compound task", () => {
    const result = routeCompoundTask({
      task: { description: "Build REST API endpoint with database queries and create React component with hooks and state management" },
      registry: DEFAULT_CAPABILITY_REGISTRY,
      budget: { tokenBudgetTier: "MEDIUM", latencyBudgetTier: "MEDIUM" }
    });

    if (result.isCompound) {
      assert.ok(result.routes.length >= 2, "Should have multiple sub-routes");
      assert.ok(result.uniqueAgentsNeeded.length >= 1, "Should identify unique agents");
      assert.ok(["sequential-peer", "decompose-and-delegate"].includes(result.recommendedStrategy));
    }
  });

  it("should include routing confidence in each route", () => {
    const result = routeTask({
      task: { domain: "backend", risk: "LOW", description: "Fix API endpoint" },
      registry: DEFAULT_CAPABILITY_REGISTRY,
      budget: { tokenBudgetTier: "MEDIUM", latencyBudgetTier: "MEDIUM" }
    });
    assert.ok(typeof result.routingConfidence === "number");
    assert.ok(result.routingConfidence > 0 && result.routingConfidence <= 1);
  });

  it("should include classification in route result", () => {
    const result = routeTask({
      task: { domain: "frontend", risk: "LOW", description: "Update component" },
      registry: DEFAULT_CAPABILITY_REGISTRY,
      budget: { tokenBudgetTier: "LOW", latencyBudgetTier: "LOW" }
    });
    assert.ok(result.classification);
    assert.equal(result.classification.primaryDomain, "frontend");
  });
});
