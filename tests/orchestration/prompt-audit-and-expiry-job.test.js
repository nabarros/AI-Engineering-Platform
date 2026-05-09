import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { auditTopPromptSkillReferences } from "../../src/orchestration/prompt-skill-audit.js";
import { createSkillExceptionRegistry } from "../../src/orchestration/skill-exceptions.js";
import { runExceptionExpiryEnforcement } from "../../src/orchestration/exception-expiry-enforcement.js";

test("should audit prompt skill references and flag duplicate entries", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aiep-audit-"));
  fs.mkdirSync(path.join(tempDir, ".github/agents"), { recursive: true });

  fs.writeFileSync(path.join(tempDir, ".github/agents/test-backend.agent.md"), [
    "## Skills",
    "Use .ai/skills/api-design.md",
    "Use .ai/skills/api-design.md"
  ].join("\n"));

  fs.writeFileSync(path.join(tempDir, "README.md"), "# temp\n");

  const { report } = auditTopPromptSkillReferences({ workspaceRoot: tempDir, requestedCount: 25 });
  const backendEntry = report.auditedPrompts.find((item) => item.path === ".github/agents/test-backend.agent.md");

  assert.ok(backendEntry);
  assert.ok(backendEntry.unnecessarySkillReferences.includes(".ai/skills/api-design.md"));
  assert.equal(report.summary.filesWithIssues, 1);
});

test("should enforce exception expiry and expose closure log through helper", () => {
  const registry = createSkillExceptionRegistry();
  const nowMs = Date.now();

  registry.grant({
    agentId: "AIEP Context Planner",
    skill: "backend",
    reason: "Temporary escalation",
    approver: "platform-lead",
    expiresAt: nowMs + 5,
    nowMs
  });

  const result = runExceptionExpiryEnforcement({ registry, nowMs: nowMs + 10 });

  assert.equal(result.closedCount, 1);
  assert.equal(result.closureLog.length, 1);
  assert.equal(result.closureLog[0].payload.closedBy, "expiry-enforcement-job");
});
