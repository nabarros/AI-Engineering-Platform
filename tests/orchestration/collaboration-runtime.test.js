import test from "node:test";
import assert from "node:assert/strict";

import {
  COLLABORATION_PROTOCOL_VERSION,
  createCollaborationMessage,
  validateCollaborationMessage
} from "../../src/orchestration/collaboration/collaboration-protocol.js";
import { TaskLeaseManager } from "../../src/orchestration/collaboration/lease-manager.js";
import { PeerNegotiationChannel } from "../../src/orchestration/collaboration/negotiation-channel.js";
import { cancelWorkflowWithCompensation } from "../../src/orchestration/collaboration/cancellation-manager.js";
import { DeadLetterQueue } from "../../src/orchestration/collaboration/dead-letter-queue.js";
import { buildCollaborationHandoffGraph } from "../../src/orchestration/collaboration/collaboration-graph.js";
import { enforceCollaborationGuardrails } from "../../src/orchestration/collaboration/collaboration-guardrails.js";

test("MAC-01 should validate collaboration protocol schema", () => {
  const message = createCollaborationMessage({
    messageId: "m-1",
    workflowId: "w-1",
    fromAgent: "router",
    toAgent: "backend",
    type: "handoff",
    payload: { objective: "implement endpoint" }
  });

  assert.equal(message.protocolVersion, COLLABORATION_PROTOCOL_VERSION);
  assert.equal(validateCollaborationMessage(message).valid, true);
  assert.equal(validateCollaborationMessage({}).valid, false);
});

test("MAC-02 should support lease acquire heartbeat and expiry reclaim", () => {
  let now = 1_000;
  const manager = new TaskLeaseManager({ nowFn: () => now });

  const acquired = manager.acquire({ taskId: "t-1", agentId: "backend", ttlMs: 100 });
  assert.equal(acquired.acquired, true);

  const renewed = manager.heartbeat({ taskId: "t-1", agentId: "backend" });
  assert.equal(renewed.renewed, true);

  now += 120;
  const reclaimed = manager.reclaimExpired();
  assert.equal(reclaimed.reclaimedCount, 1);
});

test("MAC-03 should allow bounded single-hop peer negotiation", () => {
  const channel = new PeerNegotiationChannel({
    maxHops: 1,
    allowedEdges: [{ from: "frontend", to: "ui-ux" }]
  });

  const accepted = channel.negotiate({
    workflowId: "w-1",
    fromAgent: "frontend",
    toAgent: "ui-ux",
    objective: "accessibility review",
    hopCount: 1
  });
  assert.equal(accepted.accepted, true);

  const rejected = channel.negotiate({
    workflowId: "w-1",
    fromAgent: "frontend",
    toAgent: "backend",
    objective: "unexpected handoff",
    hopCount: 1
  });
  assert.equal(rejected.accepted, false);
});

test("MAC-04 should execute deterministic cancellation with compensation", async () => {
  const compensated = [];
  const result = await cancelWorkflowWithCompensation({
    workflowId: "w-cancel",
    reason: "manual cancel",
    steps: [
      {
        stepId: "a",
        compensate: async () => {
          compensated.push("a");
        }
      },
      {
        stepId: "b",
        compensate: async () => {
          compensated.push("b");
        }
      }
    ]
  });

  assert.equal(result.cancelled, true);
  assert.equal(result.cleanupSuccess, true);
  assert.deepEqual(compensated, ["b", "a"]);
});

test("MAC-05 should support dead-letter replay with idempotency guard", async () => {
  const dlq = new DeadLetterQueue();
  dlq.enqueue({ message: { messageId: "m-1", payload: { value: 1 } }, error: "timeout", idempotencyKey: "k-1" });
  dlq.enqueue({ message: { messageId: "m-1", payload: { value: 1 } }, error: "timeout", idempotencyKey: "k-1" });

  let handled = 0;
  const firstReplay = await dlq.replay(async () => {
    handled += 1;
  });

  const secondReplay = await dlq.replay(async () => {
    handled += 1;
  });

  assert.equal(firstReplay.success, 1);
  assert.equal(secondReplay.attempted, 0);
  assert.equal(handled, 1);
});

test("MAC-06 should build collaboration handoff graph output", () => {
  const graph = buildCollaborationHandoffGraph([
    { type: "handoff", workflowId: "w-1", fromAgent: "router", toAgent: "backend" },
    { type: "handoff", workflowId: "w-1", fromAgent: "backend", toAgent: "reviewer" }
  ]);

  assert.equal(graph.nodes.length, 3);
  assert.equal(graph.edges.length, 2);
  assert.equal(graph.mermaid.includes("router --> backend"), true);
});

test("MAC-07 should enforce collaboration guardrails", () => {
  const result = enforceCollaborationGuardrails({
    path: ["frontend", "ui-ux", "reviewer"],
    maxHops: 1,
    restrictedEdges: [{ from: "ui-ux", to: "reviewer" }],
    requireEscalationFor: ["ui-ux"]
  });

  assert.equal(result.allowed, false);
  assert.equal(result.violations.some((entry) => entry.code === "MAX_HOPS_EXCEEDED"), true);
  assert.equal(result.violations.some((entry) => entry.code === "RESTRICTED_EDGE"), true);
  assert.equal(result.violations.some((entry) => entry.code === "ESCALATION_REQUIRED"), true);
});
