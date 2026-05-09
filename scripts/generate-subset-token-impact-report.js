import fs from "node:fs";
import path from "node:path";
import { buildSubsetTokenImpactDashboard, buildSubsetTokenImpactReport } from "../src/orchestration/metrics.js";

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
    { taskClass: "bugfix", subsetApplied: false, tokenUsage: 2200 },
    { taskClass: "bugfix", subsetApplied: true, tokenUsage: 1700 },
    { taskClass: "feature", subsetApplied: false, tokenUsage: 3500 },
    { taskClass: "feature", subsetApplied: true, tokenUsage: 2800 },
    { taskClass: "review", subsetApplied: false, tokenUsage: 1600 },
    { taskClass: "review", subsetApplied: true, tokenUsage: 1200 }
  ];
}

function main() {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3] || "data/subset-token-impact-report.json";
  const executions = loadExecutionsFromArg(inputPath) || getDefaultExecutions();

  const report = buildSubsetTokenImpactReport(executions);
  const dashboard = buildSubsetTokenImpactDashboard(report);
  const payload = {
    report,
    dashboard
  };

  const absoluteOutputPath = path.resolve(process.cwd(), outputPath);
  fs.mkdirSync(path.dirname(absoluteOutputPath), { recursive: true });
  fs.writeFileSync(absoluteOutputPath, `${JSON.stringify(payload, null, 2)}\n`);

  process.stdout.write(`${JSON.stringify({
    output: path.relative(process.cwd(), absoluteOutputPath),
    comparedTaskClassCount: report.comparedTaskClassCount,
    averageSavingsRate: report.averageSavingsRate
  }, null, 2)}\n`);
}

main();
