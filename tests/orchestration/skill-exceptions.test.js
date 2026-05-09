import test from "node:test";
import assert from "node:assert/strict";
import { createSkillExceptionRegistry } from "../../src/orchestration/skill-exceptions.js";

test("should grant and verify active skill exception", () => {
  const registry = createSkillExceptionRegistry();
  const expiresAt = Date.now() + 60_000;

  registry.grant({
    agentId: "AIEP Context Planner",
    skill: "backend",
    reason: "Temporary backend delegation",
    approver: "staff-engineer",
    expiresAt
  });

  const active = registry.listActive("AIEP Context Planner");
  assert.equal(active.length, 1);
  assert.equal(registry.isSkillAllowedByException("AIEP Context Planner", "backend"), true);
});

test("should expire grant and append audit events", () => {
  const registry = createSkillExceptionRegistry();
  const now = Date.now();

  registry.grant({
    agentId: "AIEP Context Planner",
    skill: "security",
    reason: "Security review handoff",
    approver: "security-lead",
    expiresAt: now + 20,
    nowMs: now
  });

  assert.equal(registry.isSkillAllowedByException("AIEP Context Planner", "security", now + 10), true);
  assert.equal(registry.isSkillAllowedByException("AIEP Context Planner", "security", now + 30), false);

  const events = registry.auditLog();
  const eventTypes = events.map((event) => event.type);
  assert.ok(eventTypes.includes("granted"));
  assert.ok(eventTypes.includes("expired"));
  assert.ok(eventTypes.includes("closed"));
  assert.ok(eventTypes.includes("checked"));
});

test("should enforce expiry job and return closure log entries", () => {
  const registry = createSkillExceptionRegistry();
  const now = Date.now();

  registry.grant({
    agentId: "AIEP Context Planner",
    skill: "backend",
    reason: "Temporary backend escalation",
    approver: "platform-lead",
    expiresAt: now + 5,
    nowMs: now
  });

  const enforcement = registry.enforceExpiry(now + 10);
  const closureLog = registry.closureLog();

  assert.equal(enforcement.closed.length, 1);
  assert.equal(enforcement.closed[0].skill, "backend");
  assert.equal(closureLog.length, 1);
  assert.equal(closureLog[0].payload.closedReason, "expired");
  assert.equal(registry.listActive("AIEP Context Planner").length, 0);
});
