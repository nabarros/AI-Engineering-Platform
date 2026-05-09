import test from "node:test";
import assert from "node:assert/strict";
import { OrchestrationMemory } from "../../src/orchestration/memory-store.js";

test("should require explicit approval for repository memory writes", () => {
  const memory = new OrchestrationMemory();

  assert.throws(() => {
    memory.write("repository", "architecture", { value: 1 });
  }, /requires explicit approval/);

  memory.write("repository", "architecture", { value: 1 }, { approved: true });
  assert.deepEqual(memory.read("repository", "architecture"), { value: 1 });
});

test("should expire entries based on ttl", async () => {
  const memory = new OrchestrationMemory();
  memory.write("session", "short-lived", { ok: true }, { ttlMs: 5 });

  await new Promise((resolve) => setTimeout(resolve, 12));
  assert.equal(memory.read("session", "short-lived"), null);
});

test("should index and query task and repository metadata", () => {
  const memory = new OrchestrationMemory();

  memory.indexTaskMetadata("req-100", {
    intent: "feature",
    description: "implement backend feature with testing"
  }, { provenanceScore: 0.95 });
  memory.indexRepositoryMetadata("agent:backend", {
    intent: "feature",
    summary: "backend specialist for feature implementation"
  }, { provenanceScore: 0.9 });

  const matches = memory.queryIndexedMetadata({
    intent: "feature",
    query: "backend implement",
    limit: 5
  });

  assert.ok(Array.isArray(matches));
  assert.ok(matches.length >= 2);
  assert.ok(matches.every((item) => item.score > 0));

  const exported = memory.exportState();
  const restored = new OrchestrationMemory();
  restored.importState(exported);

  const restoredMatches = restored.queryIndexedMetadata({
    intent: "feature",
    query: "backend implement",
    limit: 5
  });
  assert.ok(restoredMatches.length >= 2);
});

test("should suppress stale indexed metadata and weight by provenance", async () => {
  const memory = new OrchestrationMemory();

  memory.indexTaskMetadata("req-old", {
    intent: "feature",
    description: "backend implementation"
  }, { provenanceScore: 1, ttlMs: 5 });

  memory.indexTaskMetadata("req-low-provenance", {
    intent: "feature",
    description: "backend implementation"
  }, { provenanceScore: 0.1 });

  memory.indexTaskMetadata("req-high-provenance", {
    intent: "feature",
    description: "backend implementation"
  }, { provenanceScore: 1 });

  await new Promise((resolve) => setTimeout(resolve, 10));

  const matches = memory.queryIndexedMetadata({
    intent: "feature",
    query: "backend implementation",
    limit: 10
  });

  const keys = matches.map((match) => match.key);
  assert.equal(keys.includes("req-old"), false);

  const low = matches.find((match) => match.key === "req-low-provenance");
  const high = matches.find((match) => match.key === "req-high-provenance");
  assert.ok(low && high);
  assert.ok(high.score > low.score);
});

test("should prune expired metadata and reindex deterministically", async () => {
  const memory = new OrchestrationMemory();

  memory.indexTaskMetadata("req-expired", { description: "old" }, { ttlMs: 5 });
  memory.indexRepositoryMetadata("repo-expired", { summary: "old" }, { ttlMs: 5 });
  memory.indexTaskMetadata("req-fresh", { description: "new" }, { provenanceScore: 0.8 });

  await new Promise((resolve) => setTimeout(resolve, 10));

  const pruned = memory.pruneExpiredIndexedMetadata();
  assert.equal(pruned.taskMetadata >= 1, true);
  assert.equal(pruned.repositoryMetadata >= 1, true);

  const reindexed = memory.reindexMetadata();
  assert.equal(reindexed.total >= 1, true);
  assert.equal(reindexed.taskMetadata >= 1, true);
});
