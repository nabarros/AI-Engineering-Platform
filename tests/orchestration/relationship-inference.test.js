import test from "node:test";
import assert from "node:assert/strict";
import {
  inferRelationshipCandidate,
  evaluateRelationshipShadow,
  createRelationshipShadowTracker
} from "../../src/orchestration/relationship-inference.js";

test("should infer backend specialist deterministically from backend task", () => {
  const specialist = inferRelationshipCandidate({
    domain: "backend",
    description: "Implement API service and SQL integration"
  });

  assert.equal(specialist, "AIEP Senior Staff Backend Engineer");
});

test("should evaluate relationship shadow and flag mismatch", () => {
  const evaluation = evaluateRelationshipShadow({
    task: {
      domain: "frontend",
      description: "Build React component for accessibility"
    },
    selectedSpecialist: "AIEP Senior Staff Backend Engineer"
  });

  assert.equal(evaluation.matches, false);
  assert.equal(evaluation.mismatchType, "specialist_mismatch");
  assert.equal(evaluation.inferredSpecialist, "AIEP Senior Staff Frontend Engineer");
});

test("should track mismatch summary with bounded samples", () => {
  const tracker = createRelationshipShadowTracker({ maxSamples: 2 });
  tracker.record({ matches: true, mismatchType: "none" });
  tracker.record({ matches: false, mismatchType: "specialist_mismatch" });
  tracker.record({ matches: false, mismatchType: "selection_missing" });

  const summary = tracker.summary();
  assert.equal(summary.totalSamples, 2);
  assert.equal(summary.mismatches, 2);
  assert.equal(summary.byMismatchType.specialist_mismatch || 0, 1);
  assert.equal(summary.byMismatchType.selection_missing || 0, 1);
});
