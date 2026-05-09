import fs from "node:fs";
import path from "node:path";
import { createSkillExceptionRegistry } from "../src/orchestration/skill-exceptions.js";
import { runExceptionExpiryEnforcement } from "../src/orchestration/exception-expiry-enforcement.js";

function loadInput(argPath) {
  if (!argPath) {
    return {
      nowMs: Date.now(),
      grants: [
        {
          agentId: "AIEP Context Planner",
          skill: "backend",
          reason: "Temporary handoff",
          approver: "agent-governance-lead",
          expiresAt: Date.now() + 1_000
        }
      ]
    };
  }

  const absolutePath = path.resolve(process.cwd(), argPath);
  const raw = fs.readFileSync(absolutePath, "utf8");
  return JSON.parse(raw);
}

function grantFromInput(registry, grantInput, nowMs) {
  const expiresAt = Number(grantInput?.expiresAt || 0);
  const grantNowMs = Math.min(nowMs - 1, expiresAt - 1);

  registry.grant({
    agentId: String(grantInput?.agentId || ""),
    skill: String(grantInput?.skill || ""),
    reason: String(grantInput?.reason || ""),
    approver: String(grantInput?.approver || ""),
    expiresAt,
    nowMs: Number.isFinite(grantNowMs) ? grantNowMs : Date.now()
  });
}

function main() {
  const inputPath = process.argv[2];
  const closureLogPath = process.argv[3] || "data/skill-exception-closure-log.json";
  const input = loadInput(inputPath);
  const nowMs = Number(input?.nowMs || Date.now());
  const grants = Array.isArray(input?.grants) ? input.grants : [];

  const registry = createSkillExceptionRegistry();
  for (const grantInput of grants) {
    grantFromInput(registry, grantInput, nowMs);
  }

  const enforcement = runExceptionExpiryEnforcement({ registry, nowMs });
  const payload = {
    generatedAt: Date.now(),
    inputSource: inputPath ? "file" : "default",
    nowMs,
    totalGranted: grants.length,
    closedCount: enforcement.closedCount,
    closureLog: enforcement.closureLog
  };

  const absoluteOutputPath = path.resolve(process.cwd(), closureLogPath);
  fs.mkdirSync(path.dirname(absoluteOutputPath), { recursive: true });
  fs.writeFileSync(absoluteOutputPath, `${JSON.stringify(payload, null, 2)}\n`);

  process.stdout.write(`${JSON.stringify({
    output: path.relative(process.cwd(), absoluteOutputPath),
    closedCount: payload.closedCount
  }, null, 2)}\n`);
}

main();
