import test from "node:test";
import assert from "node:assert/strict";
import { executeTaskGraph } from "../../src/orchestration/multi-agent-engine.js";

test("should execute dependency graph with concurrency", async () => {
  const events = [];
  const handlers = {
    planner: async ({ node }) => {
      events.push(`start:${node.id}`);
      return { plan: true };
    },
    implementer: async ({ node }) => {
      events.push(`start:${node.id}`);
      return { implemented: true };
    },
    verifier: async ({ node }) => {
      events.push(`start:${node.id}`);
      return { verified: true };
    }
  };

  const result = await executeTaskGraph({
    nodes: [
      { id: "n1", agentId: "planner" },
      { id: "n2", agentId: "implementer" },
      { id: "n3", agentId: "verifier" }
    ],
    edges: [
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3" }
    ],
    handlers,
    maxConcurrency: 2
  });

  assert.equal(result.ok, true);
  assert.equal(result.executedNodes, 3);
  assert.equal(events[0], "start:n1");
  assert.equal(events.includes("start:n2"), true);
  assert.equal(events.includes("start:n3"), true);
});

test("should retry failing node and return failure after attempts", async () => {
  let attempts = 0;
  const result = await executeTaskGraph({
    nodes: [{ id: "n1", agentId: "unstable", maxAttempts: 2, timeoutMs: 100 }],
    handlers: {
      unstable: async () => {
        attempts += 1;
        throw new Error("boom");
      }
    }
  });

  assert.equal(result.ok, false);
  assert.equal(attempts, 2);
  assert.equal(result.results.n1.ok, false);
});
