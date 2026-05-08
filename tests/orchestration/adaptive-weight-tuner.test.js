import test from "node:test";
import assert from "node:assert/strict";
import { AdaptiveWeightTuner } from "../../src/orchestration/adaptive-weight-tuner.js";

test("should adapt weights toward quality when success is below target", () => {
  const tuner = new AdaptiveWeightTuner({
    targetSuccessRate: 0.95,
    windowSize: 20,
    adjustmentStep: 0.04
  });

  const before = tuner.getWeights();

  for (let i = 0; i < 20; i += 1) {
    tuner.observe({
      success: i % 3 === 0,
      tokenUsage: 1400,
      latencyMs: 180
    });
  }

  const after = tuner.getWeights();
  assert.ok(after.quality > before.quality);
});

test("should export and import tuner state", () => {
  const tunerA = new AdaptiveWeightTuner({ windowSize: 10 });
  for (let i = 0; i < 10; i += 1) {
    tunerA.observe({ success: true, tokenUsage: 2000, latencyMs: 200 });
  }

  const state = tunerA.exportState();
  const tunerB = new AdaptiveWeightTuner({ windowSize: 10 });
  tunerB.importState(state);

  assert.deepEqual(tunerB.getWeights(), tunerA.getWeights());
  assert.deepEqual(tunerB.getRollingMetrics(), tunerA.getRollingMetrics());
});
