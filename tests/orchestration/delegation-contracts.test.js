import test from "node:test";
import assert from "node:assert/strict";
import {
  DELEGATION_TEMPLATE_VERSION,
  MEMORY_HANDOFF_PACKET_VERSION,
  buildDelegationContract,
  buildMemoryHandoffPacket,
  validateMemoryHandoffPacket,
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

test("should build and validate memory handoff packet", () => {
  const packet = buildMemoryHandoffPacket({
    fromAgent: "AIEP Context Planner",
    toAgent: "AIEP Senior Staff Backend Engineer",
    taskId: "task-2",
    entries: [
      {
        key: "request:task-2:summary",
        layer: "episodic",
        value: { summary: "prior context" },
        provenanceScore: 0.9
      }
    ],
    metadata: {
      summary: "handoff packet",
      retrievalIntent: "bugfix"
    },
    generatedAtMs: Date.UTC(2026, 4, 9)
  });

  assert.equal(packet.version, MEMORY_HANDOFF_PACKET_VERSION);
  const validation = validateMemoryHandoffPacket(packet);
  assert.equal(validation.valid, true);
  assert.deepEqual(validation.errors, []);
});

test("should include memory handoff packet in delegation contract when provided", () => {
  const contract = buildDelegationContract({
    fromAgent: "AIEP Context Planner",
    toAgent: "AIEP Senior Staff Backend Engineer",
    task: {
      taskId: "task-3",
      objective: "Implement memory retrieval ranking",
      constraints: ["deterministic", "backward-compatible"],
      requiredContext: ["memory contract", "retrieval planner"]
    },
    handoff: {
      summary: "carry context",
      artifacts: ["plan-v2"],
      memoryHandoffPacket: {
        entries: [{
          key: "task-3",
          layer: "working",
          value: { objective: "ranking" }
        }],
        metadata: {
          summary: "cross-agent state",
          retrievalIntent: "feature"
        },
        generatedAtMs: Date.UTC(2026, 4, 9)
      }
    }
  });

  assert.ok(contract.handoff.memoryHandoffPacket);
  assert.equal(contract.handoff.memoryHandoffPacket.entries.length, 1);
  assert.equal(contract.handoff.memoryHandoffPacket.taskId, "task-3");
});
