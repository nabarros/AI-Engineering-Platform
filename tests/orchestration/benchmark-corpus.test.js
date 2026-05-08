import test from "node:test";
import assert from "node:assert/strict";
import { generateScenarioCorpus } from "../../src/orchestration/benchmark.js";

test("should generate large benchmark corpus", () => {
  const scenarios = generateScenarioCorpus();
  assert.ok(scenarios.length >= 200);

  const ids = new Set(scenarios.map((scenario) => scenario.id));
  assert.equal(ids.size, scenarios.length);

  const hasBackend = scenarios.some((scenario) => scenario.task.domain === "backend");
  const hasFrontend = scenarios.some((scenario) => scenario.task.domain === "frontend");
  const hasSre = scenarios.some((scenario) => scenario.task.domain === "sre");

  assert.equal(hasBackend, true);
  assert.equal(hasFrontend, true);
  assert.equal(hasSre, true);
});
