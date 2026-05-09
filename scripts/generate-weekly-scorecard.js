import fs from "node:fs";
import path from "node:path";
import { buildWeeklyCostQualityScorecard } from "../src/orchestration/metrics.js";

function loadExecutionsFromArg(argPath) {
  if (!argPath) {
    return null;
  }

  const absolutePath = path.resolve(process.cwd(), argPath);
  const raw = fs.readFileSync(absolutePath, "utf8");
  const parsed = JSON.parse(raw);

  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (Array.isArray(parsed?.executions)) {
    return parsed.executions;
  }

  throw new Error("Input JSON must be an array or an object containing an executions array.");
}

function getDefaultExecutions() {
  return [
    { objective: "routing-improvement", modelTier: "standard", tokenUsage: 1200, verificationPass: true },
    { objective: "routing-improvement", modelTier: "standard", tokenUsage: 1400, verificationPass: true },
    { objective: "security-hardening", modelTier: "premium", tokenUsage: 2600, verificationPass: false },
    { objective: "security-hardening", modelTier: "premium", tokenUsage: 2400, verificationPass: true }
  ];
}

function main() {
  const inputPath = process.argv[2];
  const executions = loadExecutionsFromArg(inputPath) || getDefaultExecutions();
  const scorecard = buildWeeklyCostQualityScorecard(executions);
  process.stdout.write(`${JSON.stringify(scorecard, null, 2)}\n`);
}

main();
