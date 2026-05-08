import test from "node:test";
import assert from "node:assert/strict";
import { enforcePolicy } from "../../src/orchestration/policy-engine.js";
import { verifyExecution } from "../../src/orchestration/verifier.js";

test("should block high-risk operations without confirmation", () => {
  const result = enforcePolicy(
    { description: "Change auth flow and authorization handling", risk: "HIGH" },
    { confirmed: false }
  );

  assert.equal(result.allowed, false);
  assert.equal(result.violations[0].code, "MISSING_CONFIRMATION");
});

test("should fail verification when test/security evidence is missing", () => {
  const verification = verifyExecution({
    testsPassed: false,
    securityChecksPassed: false,
    contractChecksPassed: true,
    errorHandlingValidated: true,
    qualityScore: 0.95
  });

  assert.equal(verification.pass, false);
  assert.ok(verification.findings.some((finding) => finding.code === "MISSING_TESTS"));
  assert.ok(verification.findings.some((finding) => finding.code === "SECURITY_UNVERIFIED"));
});
