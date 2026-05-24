import test from "node:test";
import assert from "node:assert/strict";

import {
  defineChaosScenarioLibrary,
  runResilienceDrill,
  buildReleaseResilienceScorecard,
  tuneAdaptiveFallbackPolicy
} from "../../src/orchestration/reliability-differentiation.js";

test("REL-01 should define deterministic chaos scenario library", () => {
  const library = defineChaosScenarioLibrary();
  assert.equal(library.length, 4);
});

test("REL-02 should run resilience drills", () => {
  const run = runResilienceDrill({ scenarios: defineChaosScenarioLibrary(), runId: "run-1" });
  assert.equal(run.successRate, 1);
  assert.equal(run.results.length, 4);
});

test("REL-03 should publish release resilience scorecard", () => {
  const scorecard = buildReleaseResilienceScorecard({
    releaseId: "rel-1",
    drills: [{ passed: true }, { passed: true }]
  });

  assert.equal(scorecard.gate, "pass");
  assert.equal(scorecard.evidenceIncluded, true);
});

test("REL-04 should tune adaptive fallback policy", () => {
  const next = tuneAdaptiveFallbackPolicy({ incidents: [{ id: "i1" }], currentPolicy: { retryBudget: 2, confidenceFloor: 0.7 } });
  assert.equal(next.policy.retryBudget, 3);
  assert.equal(next.safetyGuardrailsMaintained, true);
});
