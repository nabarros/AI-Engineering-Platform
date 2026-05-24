import test from "node:test";
import assert from "node:assert/strict";

import {
  definePublicBenchmarkSuite,
  runDeterministicBenchmarkReplay,
  buildQuarterlyBenchmarkScorecard,
  runCompatibilityComparison
} from "../../src/orchestration/benchmark-narrative.js";

test("BEN-01 should define public benchmark suite", () => {
  const suite = definePublicBenchmarkSuite();
  assert.equal(suite.dimensions.length, 5);
});

test("BEN-02 should run deterministic benchmark replay", () => {
  const first = runDeterministicBenchmarkReplay({ suite: "s", seed: 42, runs: 4 });
  const second = runDeterministicBenchmarkReplay({ suite: "s", seed: 42, runs: 4 });
  assert.deepEqual(first.samples, second.samples);
});

test("BEN-03 should build quarterly scorecard", () => {
  const scorecard = buildQuarterlyBenchmarkScorecard({
    quarter: "2026-Q2",
    reports: [{ score: 0.81 }, { score: 0.86 }]
  });

  assert.equal(scorecard.published, true);
  assert.equal(scorecard.reportCount, 2);
});

test("BEN-04 should support compatibility comparison adapters", () => {
  const result = runCompatibilityComparison({
    baseline: ["A", "B"],
    candidate: ["a", "b", "c"],
    adapters: {
      normalize: (v) => String(v).toLowerCase()
    }
  });

  assert.equal(result.compatibilityRate, 1);
});
