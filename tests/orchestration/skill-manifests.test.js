import test from "node:test";
import assert from "node:assert/strict";
import {
  MINIMUM_SKILL_MANIFESTS,
  resolveAllowedSkillsForAgent,
  inferRequiredSkillsFromTask,
  enforceSkillSubsetPolicy,
  resolveSkillManifestV2,
  validateSkillManifestV2,
  lintCompiledSkillPolicies,
  runSkillSubsetDryRun,
  clearSkillSubsetResolutionCache
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
  clearSkillSubsetResolutionCache();
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
  clearSkillSubsetResolutionCache();
  const result = enforceSkillSubsetPolicy({
    agentId: "AIEP Context Planner",
    task: {
      domain: "backend",
      description: "Implement backend security feature with bugfix"
    }
  });

  assert.equal(result.allowed, false);
  assert.ok(result.deniedSkills.includes("backend") || result.deniedSkills.includes("security") || result.deniedSkills.includes("debugging"));
  assert.ok(result.denialReasons.length > 0);
});

test("should allow denied skill when temporary exception is active", () => {
  clearSkillSubsetResolutionCache();
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
  assert.deepEqual(result.deniedSkills, []);
});

test("should resolve compiled subset using role, domain, and risk", () => {
  const allowed = resolveAllowedSkillsForAgent("AIEP Senior Staff Backend Engineer", {
    domain: "backend",
    risk: "HIGH"
  });

  assert.ok(allowed.includes("backend"));
  assert.ok(allowed.includes("security"));
  assert.ok(allowed.includes("review"));
  assert.ok(!allowed.includes("frontend"));
});

test("should validate schema v2 manifests with explicit deny and expiry fields", () => {
  const manifest = resolveSkillManifestV2("AIEP Senior Staff Frontend Engineer", {
    domain: "frontend",
    risk: "MEDIUM"
  });

  const validation = validateSkillManifestV2(manifest);
  assert.equal(validation.valid, true);
  assert.ok(Array.isArray(manifest.deny));
  assert.equal(typeof manifest.exception.expiresAtRequired, "boolean");
  assert.ok(manifest.exception.maxTtlMs > 0);
});

test("should pass policy lint for all compiled rows", () => {
  const report = lintCompiledSkillPolicies();
  assert.equal(report.valid, true);
  assert.ok(report.reports.length > 0);
});

test("should return deterministic cached subset resolution for repeated signatures", () => {
  clearSkillSubsetResolutionCache();
  const args = {
    agentId: "AIEP Senior Staff Frontend Engineer",
    task: {
      domain: "frontend",
      risk: "LOW",
      description: "Implement frontend ui feature with tests"
    }
  };

  const first = enforceSkillSubsetPolicy(args);
  const second = enforceSkillSubsetPolicy(args);

  assert.equal(first.allowed, true);
  assert.equal(first.cache.hit, false);
  assert.equal(second.cache.hit, true);
  assert.equal(second.cache.key, first.cache.key);
  assert.deepEqual(second.requiredSkills, first.requiredSkills);
});

test("should provide actionable preflight dry-run denial messages", () => {
  clearSkillSubsetResolutionCache();
  const dryRun = runSkillSubsetDryRun({
    agentId: "AIEP Context Planner",
    task: {
      domain: "backend",
      risk: "HIGH",
      description: "Implement backend security feature"
    }
  });

  assert.equal(dryRun.allowed, false);
  assert.ok(dryRun.blockedReasonCodes.length > 0);
  assert.ok(dryRun.messages.some((message) => message.includes("SKILL_")));
});

test("should avoid low-risk security requirement on generic secure wording", () => {
  const required = inferRequiredSkillsFromTask({
    domain: "backend",
    risk: "LOW",
    description: "Implement backend feature with secure logging and tests"
  });

  assert.ok(required.includes("backend"));
  assert.ok(required.includes("testing"));
  assert.ok(!required.includes("security"));
});

test("should keep security requirement when explicit security intent is present", () => {
  const required = inferRequiredSkillsFromTask({
    domain: "backend",
    risk: "LOW",
    description: "Implement backend feature and run security audit for vulnerabilities"
  });

  assert.ok(required.includes("security"));
});
