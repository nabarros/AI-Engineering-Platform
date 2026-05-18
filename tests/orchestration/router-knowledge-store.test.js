import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { RouterKnowledgeStore } from "../../src/services/router-knowledge-store.js";

function createLocalOnlyStore() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aiep-router-knowledge-store-"));
  const localStorePath = path.join(tempDir, `router-store-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);

  const store = new RouterKnowledgeStore({
    localStorePath,
    weaviateIndexEnabled: false,
    embeddingProviderOrder: [],
    anthropicScoringEnabled: false
  });

  return { store, tempDir };
}

test("should persist records locally without external providers", async () => {
  const { store, tempDir } = createLocalOnlyStore();

  try {
    store.store({
      promptText: "Implement backend API endpoint with validation",
      taskDomain: "backend",
      taskRisk: "MEDIUM",
      selectedAgent: "AIEP Senior Staff Backend Engineer",
      routingConfidence: 0.92,
      fallbackChain: ["AIEP Context Planner"],
      routingSummary: "Selected backend specialist for API implementation"
    });

    await new Promise((resolve) => setTimeout(resolve, 20));

    const health = store.healthStatus();
    assert.strictEqual(health.localStore.records, 1);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("should return lexical lookup hit from local store", async () => {
  const { store, tempDir } = createLocalOnlyStore();

  try {
    store.store({
      promptText: "Design backend service for PostgreSQL transaction handling",
      taskDomain: "backend",
      taskRisk: "MEDIUM",
      selectedAgent: "AIEP Senior Staff Backend Engineer",
      routingConfidence: 0.89,
      fallbackChain: ["AIEP Context Planner"],
      routingSummary: "Backend data integrity and API orchestration"
    });

    await new Promise((resolve) => setTimeout(resolve, 20));

    const hit = await store.lookup("Build backend API service with postgres transactions", {
      taskDomain: "backend"
    });

    assert.ok(hit);
    assert.strictEqual(hit.source, "lexical");
    assert.strictEqual(hit.selectedAgent, "AIEP Senior Staff Backend Engineer");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("should return null for unrelated lookup", async () => {
  const { store, tempDir } = createLocalOnlyStore();

  try {
    store.store({
      promptText: "Implement backend API endpoint with database consistency checks",
      taskDomain: "backend",
      taskRisk: "LOW",
      selectedAgent: "AIEP Senior Staff Backend Engineer",
      routingConfidence: 0.9,
      fallbackChain: ["AIEP Context Planner"],
      routingSummary: "Backend-focused routing decision"
    });

    await new Promise((resolve) => setTimeout(resolve, 20));

    const hit = await store.lookup("compose orchestral melody for cinematic strings", {
      taskDomain: "backend"
    });

    assert.strictEqual(hit, null);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
