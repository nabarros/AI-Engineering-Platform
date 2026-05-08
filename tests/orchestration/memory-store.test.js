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
