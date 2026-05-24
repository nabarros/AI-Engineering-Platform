import test from "node:test";
import assert from "node:assert/strict";

import {
  createStepBudgetEnvelopeAllocator,
  reallocateWorkflowBudget,
  compressContextWithGuardrails,
  resolveStepAwareCachePolicy,
  optimizeModelPortfolio,
  buildMonthlyTokenGovernanceReview
} from "../../src/orchestration/token-leverage-runtime.js";

test("TOK-01 should allocate per-step token envelopes", () => {
  const allocator = createStepBudgetEnvelopeAllocator();
  const result = allocator.allocate({ tier: "LOW", stepType: "planning", requestedTokens: 150 });
  assert.equal(result.allowed, true);
  assert.equal(result.limit > 0, true);
});

test("TOK-02 should rebalance workflow budgets deterministically", () => {
  const result = reallocateWorkflowBudget({
    objectiveBudget: 1000,
    stepUsage: { planning: 200, execution: 500, verification: 200, recovery: 100 },
    rebalanceToward: "verification",
    maxShiftRatio: 0.1
  });

  assert.equal(result.shiftedTokens, 100);
  assert.equal(result.redistributed.verification >= 300, true);
});

test("TOK-03 should compress context with quality guardrails", () => {
  const result = compressContextWithGuardrails({ context: "x".repeat(1000), maxChars: 500, qualityThreshold: 0.4 });
  assert.equal(result.compressed.length, 500);
  assert.equal(result.passesGuardrail, true);
});

test("TOK-04 should resolve step-aware cache policy", () => {
  const policy = resolveStepAwareCachePolicy({ stepType: "verification", risk: "HIGH", confidence: 0.95 });
  assert.equal(policy.cacheAllowed, true);
  assert.equal(policy.ttlSeconds > 0, true);
});

test("TOK-05 should optimize model portfolio by utility", () => {
  const optimized = optimizeModelPortfolio({
    objective: "cost",
    candidates: [
      { id: "m1", quality: 0.9, cost: 0.03, latency: 600 },
      { id: "m2", quality: 0.88, cost: 0.01, latency: 450 }
    ]
  });

  assert.equal(optimized.selected !== null, true);
  assert.equal(optimized.ranked.length, 2);
});

test("TOK-06 should build monthly token governance review", () => {
  const review = buildMonthlyTokenGovernanceReview({
    month: "2026-05",
    rows: [
      { team: "a", tokens: 1000, deltaPct: 0.1 },
      { team: "b", tokens: 2000, deltaPct: 0.25 }
    ]
  });

  assert.equal(review.totalTokens, 3000);
  assert.equal(review.anomalies.length, 1);
});
