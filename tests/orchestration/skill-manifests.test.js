import test from "node:test";
import assert from "node:assert/strict";
import {
  MINIMUM_SKILL_MANIFESTS,
  resolveAllowedSkillsForAgent,
  inferRequiredSkillsFromTask,
  enforceSkillSubsetPolicy
} from "../../src/orchestration/skill-manifests.js";
import { createSkillExceptionRegistry } from "../../src/orchestration/skill-exceptions.js";

test("should define minimum manifests for all active default capability ids", () => {
  const ids = Object.keys(MINIMUM_SKILL_MANIFESTS);
  assert.ok(ids.length >= 7);
  for (const agentId of ids) {
    const allowlist = resolveAllowedSkillsForAgent(agentId);
    assert.ok(Array.isArray(allowlist));
    assert.ok(allowlist.length > 0);
  }
});

test("should infer required skills deterministically from task keywords", () => {
  const task = {
    domain: "backend",
    description: "Bugfix security review for backend performance"
  };

  const required = inferRequiredSkillsFromTask(task);
  assert.deepEqual(required, [...required].sort());
  assert.ok(required.includes("debugging"));
  assert.ok(required.includes("security"));
  assert.ok(required.includes("review"));
  assert.ok(required.includes("backend"));
  assert.ok(required.includes("performance"));
});

test("should allow when required skills are subset of manifest", () => {
  const result = enforceSkillSubsetPolicy({
    agentId: "AIEP Senior Staff Backend Engineer",
    task: {
      domain: "backend",
      description: "Bugfix backend feature"
    }
  });

  assert.equal(result.allowed, true);
  assert.deepEqual(result.deniedSkills, []);
});

test("should deny by default when required skills are missing from manifest", () => {
  const result = enforceSkillSubsetPolicy({
    agentId: "AIEP Context Planner",
    task: {
      domain: "backend",
      description: "Implement backend security feature with bugfix"
    }
  });

  assert.equal(result.allowed, false);
  assert.ok(result.deniedSkills.includes("backend") || result.deniedSkills.includes("security") || result.deniedSkills.includes("debugging"));
});

test("should allow denied skill when temporary exception is active", () => {
  const registry = createSkillExceptionRegistry();
  const expiresAt = Date.now() + 60_000;
  registry.grant({
    agentId: "AIEP Context Planner",
    skill: "backend",
    reason: "Temporary delegation trial",
    approver: "platform-lead",
    expiresAt
  });
  registry.grant({
    agentId: "AIEP Context Planner",
    skill: "testing",
    reason: "Temporary delegation trial",
    approver: "platform-lead",
    expiresAt
  });

  const result = enforceSkillSubsetPolicy({
    agentId: "AIEP Context Planner",
    task: {
      domain: "backend",
      description: "Implement backend plan"
    },
    exceptionRegistry: registry,
    nowMs: Date.now()
  });

  assert.equal(result.allowed, true);
  assert.ok(result.exceptionAllowedSkills.includes("backend"));
  assert.ok(result.exceptionAllowedSkills.includes("testing"));
  assert.deepEqual(result.deniedSkills, []);
});
