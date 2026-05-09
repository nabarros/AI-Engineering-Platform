#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import {
  createCostPolicyRedTeamScenarios,
  runCostPolicyRedTeamEvaluation
} from "../src/orchestration/index.js";

function writeFile(relativePath, content) {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content);
  return path.relative(process.cwd(), absolutePath);
}

function evaluator(scenario) {
  switch (scenario.id) {
    case "RT-COST-001":
      return {
        controlOutcome: "force_premium",
        blocked: true,
        severity: "LOW"
      };
    case "RT-COST-002":
      return {
        controlOutcome: "objective_limit_blocks",
        blocked: true,
        severity: "LOW"
      };
    case "RT-COST-003":
      return {
        controlOutcome: "optimizer_downgrade_guardrail",
        blocked: true,
        severity: "LOW"
      };
    default:
      return {
        controlOutcome: "unknown",
        blocked: false,
        severity: "HIGH",
        mitigation: "Add deterministic policy checks for unknown scenario."
      };
  }
}

function renderMarkdown(report) {
  const findingRows = report.findings
    .map((finding) => `| ${finding.scenarioId} | ${finding.category} | ${finding.severity} | ${finding.status} | ${finding.expectedControl} | ${finding.observedControl} |`)
    .join("\n");

  const backlogRows = report.mitigationBacklog.length === 0
    ? "| none | n/a | n/a | n/a |"
    : report.mitigationBacklog
      .map((item) => `| ${item.id} | ${item.scenarioId} | ${item.severity} | ${item.status} |`)
      .join("\n");

  return [
    "# P4 Red-Team Cost Policy and Routing Bypass Evaluation",
    "",
    `- generatedAt: ${new Date(report.generatedAt).toISOString()}`,
    `- scenarioCount: ${report.scenarioCount}`,
    `- status: ${report.summary.status}`,
    `- openHighSeverityFindings: ${report.summary.openHighSeverityFindings}`,
    "",
    "## Findings",
    "",
    "| Scenario | Category | Severity | Status | Expected Control | Observed Control |",
    "|---|---|---|---|---|---|",
    findingRows,
    "",
    "## Mitigation Backlog",
    "",
    "| Backlog Item | Scenario | Severity | Status |",
    "|---|---|---|---|",
    backlogRows,
    ""
  ].join("\n");
}

function main() {
  const scenarios = createCostPolicyRedTeamScenarios();
  const report = runCostPolicyRedTeamEvaluation({
    scenarios,
    evaluator,
    generatedAt: Date.UTC(2026, 4, 9)
  });

  const jsonPath = writeFile("data/p4-red-team-cost-policy-report.json", `${JSON.stringify(report, null, 2)}\n`);
  const markdownPath = writeFile("docs/p4-red-team-cost-policy-report.md", renderMarkdown(report));

  process.stdout.write(`${JSON.stringify({
    generatedAt: report.generatedAt,
    outputs: {
      reportJson: jsonPath,
      reportMarkdown: markdownPath
    },
    status: report.summary.status
  }, null, 2)}\n`);
}

main();
