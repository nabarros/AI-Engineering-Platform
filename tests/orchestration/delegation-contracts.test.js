import test from "node:test";
import assert from "node:assert/strict";
import {
  DELEGATION_TEMPLATE_VERSION,
  buildDelegationContract,
  validateDelegationContract
} from "../../src/orchestration/delegation-contracts.js";

test("should build valid delegation contract with required fields", () => {
  const contract = buildDelegationContract({
    fromAgent: "AIEP Context Planner",
    toAgent: "AIEP Senior Staff Backend Engineer",
    task: {
      taskId: "task-1",
      objective: "Implement orchestration policy",
      constraints: ["ASCII only", "No docs edits"],
      requiredContext: ["policy rules", "memory state"]
    },
    handoff: {
      summary: "Proceed with backend implementation",
      artifacts: ["plan-v1"]
    }
  });

  assert.equal(contract.templateVersion, DELEGATION_TEMPLATE_VERSION);
  const validation = validateDelegationContract(contract);
  assert.equal(validation.valid, true);
  assert.deepEqual(validation.errors, []);
});

test("should reject invalid delegation contract", () => {
  const validation = validateDelegationContract({
    templateVersion: "0.9.0",
    fromAgent: "",
    toAgent: "",
    task: {
      taskId: "",
      objective: "",
      constraints: [],
      requiredContext: []
    }
  });

  assert.equal(validation.valid, false);
  assert.ok(validation.errors.length >= 4);
});
