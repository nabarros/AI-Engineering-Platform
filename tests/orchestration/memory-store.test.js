import test from "node:test";
import assert from "node:assert/strict";
import { OrchestrationMemory } from "../../src/orchestration/memory-store.js";
import { resolveMemoryLayer } from "../../src/orchestration/memory-contract.js";

test("should require explicit approval for repository memory writes", () => {
  const memory = new OrchestrationMemory();

  assert.throws(() => {
    memory.write("repository", "architecture", { value: 1 });
  }, /requires explicit approval/);

  memory.write("repository", "architecture", { value: 1 }, { approved: true });
  assert.deepEqual(memory.read("repository", "architecture"), { value: 1 });
});

test("should keep legacy aliases mapped to layered memory contract", () => {
  const memory = new OrchestrationMemory();
  assert.equal(resolveMemoryLayer("session"), "working");
  assert.equal(resolveMemoryLayer("repository"), "semantic");
  assert.equal(resolveMemoryLayer("patterns"), "procedural");

  memory.write("working", "req-1", { summary: "working-memory context" });
  assert.deepEqual(memory.read("session", "req-1"), { summary: "working-memory context" });

  memory.write("procedural", "rule-1", { action: "verify" });
  assert.deepEqual(memory.read("patterns", "rule-1"), { action: "verify" });
});

test("should persist write-path provenance and source metadata", () => {
  const memory = new OrchestrationMemory();
  const writeResult = memory.write("session", "req:meta", { summary: "context" }, {
    provenanceScore: 0.83,
    provenanceWriter: "AIEP Context Planner",
    provenanceStrategy: "deterministic",
    source: {
      sourceType: "retrieval",
      sourceId: "req-101",
      filePath: "src/orchestration/orchestrator.js",
      requestId: "req-101",
      agentId: "AIEP Context Planner",
      tags: ["intent:bugfix"]
    }
  });

  assert.equal(writeResult.metadata.layer, "working");
  assert.equal(writeResult.metadata.scope, "session");
  assert.equal(writeResult.metadata.provenance.writer, "AIEP Context Planner");
  assert.equal(writeResult.metadata.source.sourceType, "retrieval");
  assert.equal(typeof writeResult.metadata.updatedAt, "number");
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
  }, {
    provenanceScore: 0.9,
    source: { sourceType: "verified" }
  });

  memory.indexRepositoryGraph("agent:backend", {
    symbols: ["routeTask"],
    dependencies: ["router.js"],
    ownership: ["backend-platform"],
    links: ["docs/ARCHITECTURE.md"],
    summary: "backend selection graph"
  });

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
  const health = restored.getRepositoryGraphHealthReport({ nowMs: Date.UTC(2026, 4, 9) });
  assert.equal(health.nodeCount >= 1, true);
  assert.equal(typeof health.healthy, "boolean");
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

test("should compact and archive stale low-value memory entries", () => {
  const memory = new OrchestrationMemory();
  const staleTimestamp = Date.UTC(2026, 0, 1);
  const nowMs = Date.UTC(2026, 4, 9);

  memory.importState({
    session: [["stale-session", {
      value: { summary: "old" },
      createdAt: staleTimestamp,
      updatedAt: staleTimestamp,
      expiresAt: null,
      metadata: {
        layer: "working",
        scope: "session",
        writtenAt: staleTimestamp,
        updatedAt: staleTimestamp,
        provenance: { score: 0.1 },
        source: { sourceType: "sample" }
      }
    }]],
    taskMetadata: [["task-old", {
      requestId: "task-old",
      payload: { summary: "old indexed" },
      updatedAt: staleTimestamp,
      provenanceScore: 0.1,
      metadata: {
        provenance: { score: 0.1 },
        source: { sourceType: "sample" },
        writtenAt: staleTimestamp,
        updatedAt: staleTimestamp
      },
      expiresAt: null
    }]]
  });

  const summary = memory.compactAndArchive({
    nowMs,
    maxAgeMs: 30 * 24 * 60 * 60 * 1000,
    minProvenanceScore: 0.2
  });

  assert.equal(summary.compactedMemoryEntries, 1);
  assert.equal(summary.compactedIndexedEntries, 1);
  const archiveSnapshot = memory.getArchiveSnapshot();
  assert.equal(archiveSnapshot.memoryEntries.length >= 1, true);
  assert.equal(archiveSnapshot.indexedMetadata.length >= 1, true);
});
