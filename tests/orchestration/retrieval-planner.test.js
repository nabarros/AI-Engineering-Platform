import test from "node:test";
import assert from "node:assert/strict";
import { buildRetrievalPlan, detectTaskIntent, retrieveOrientedContext } from "../../src/orchestration/index.js";
import { OrchestrationMemory } from "../../src/orchestration/memory-store.js";

test("should detect docs intent and build deterministic retrieval plan", () => {
  const task = {
    domain: "docs",
    description: "Update roadmap documentation and runbook evidence"
  };

  const intent = detectTaskIntent(task);
  assert.equal(intent, "docs");

  const plan = buildRetrievalPlan(task, 7);
  assert.equal(plan.intent, "docs");
  assert.equal(plan.limit, 7);
  assert.ok(plan.query.includes("documentation"));
  assert.ok(plan.query.includes("runbook"));
});

test("should use planner from retrieveOrientedContext for ranked retrieval", () => {
  const memory = new OrchestrationMemory();

  memory.indexTaskMetadata("req-docs", {
    summary: "documentation checklist for roadmap review",
    ownerTeam: "memory-platform"
  }, {
    provenanceScore: 0.9,
    source: { sourceType: "verified" }
  });

  const results = retrieveOrientedContext(memory, {
    domain: "docs",
    description: "Review documentation and update roadmap evidence"
  }, 5);

  assert.equal(Array.isArray(results), true);
  assert.equal(results.length >= 1, true);
  assert.equal(results[0].source, "task");
  assert.equal(results[0].score > 0, true);
});
