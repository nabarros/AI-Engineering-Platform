#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { buildSpendAttributionSnapshot } from "../src/orchestration/index.js";

function writeFile(relativePath, content) {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content);
  return path.relative(process.cwd(), absolutePath);
}

function buildExecutions() {
  const base = Date.UTC(2026, 3, 1);
  return [
    { team: "be", modelTier: "MEDIUM", tokenUsage: 4200, timestampMs: base + 0 * 86400000 },
    { team: "be", modelTier: "MEDIUM", tokenUsage: 4600, timestampMs: base + 1 * 86400000 },
    { team: "be", modelTier: "HIGH", tokenUsage: 5200, timestampMs: base + 2 * 86400000 },
    { team: "be", modelTier: "HIGH", tokenUsage: 13800, timestampMs: base + 3 * 86400000 },
    { team: "fe", modelTier: "LOW", tokenUsage: 2200, timestampMs: base + 0 * 86400000 },
    { team: "fe", modelTier: "LOW", tokenUsage: 2500, timestampMs: base + 1 * 86400000 },
    { team: "fe", modelTier: "MEDIUM", tokenUsage: 2600, timestampMs: base + 2 * 86400000 },
    { team: "fe", modelTier: "MEDIUM", tokenUsage: 2800, timestampMs: base + 3 * 86400000 },
    { team: "qa", modelTier: "LOW", tokenUsage: 1700, timestampMs: base + 0 * 86400000 },
    { team: "qa", modelTier: "LOW", tokenUsage: 1800, timestampMs: base + 1 * 86400000 },
    { team: "qa", modelTier: "LOW", tokenUsage: 1650, timestampMs: base + 2 * 86400000 },
    { team: "qa", modelTier: "LOW", tokenUsage: 1720, timestampMs: base + 3 * 86400000 }
  ];
}

function renderMarkdown(snapshot) {
  const teamRows = snapshot.report.teams
    .map((team) => `| ${team.team} | ${team.totalTokens} | ${team.sampleCount} | ${team.averageTokensPerRun} | ${team.byModelTier.LOW} | ${team.byModelTier.MEDIUM} | ${team.byModelTier.HIGH} |`)
    .join("\n");

  const alertRows = snapshot.anomalies.alerts.length === 0
    ? "| none | n/a | n/a | n/a |"
    : snapshot.anomalies.alerts
      .map((alert) => `| ${alert.team} | ${alert.dateBucket} | ${alert.currentTokens} | ${alert.thresholdTokens} |`)
      .join("\n");

  return [
    "# P4 Spend Attribution and Anomaly Snapshot",
    "",
    `- generatedAt: ${new Date(snapshot.generatedAt).toISOString()}`,
    `- totalExecutions: ${snapshot.report.totalExecutions}`,
    `- anomalyAlerts: ${snapshot.anomalies.alertCount}`,
    "",
    "## Team Spend Attribution",
    "",
    "| Team | Total Tokens | Runs | Avg Tokens/Run | LOW | MEDIUM | HIGH |",
    "|---|---:|---:|---:|---:|---:|---:|",
    teamRows,
    "",
    "## Detected Alerts",
    "",
    "| Team | Date | Current Tokens | Threshold Tokens |",
    "|---|---|---:|---:|",
    alertRows,
    ""
  ].join("\n");
}

function main() {
  const snapshot = buildSpendAttributionSnapshot(buildExecutions(), {
    generatedAt: Date.UTC(2026, 4, 9),
    spikeMultiplier: 1.7,
    minTokensForAlert: 7000,
    trailingWindowDays: 3
  });

  const jsonPath = writeFile("data/p4-spend-attribution-anomalies.json", `${JSON.stringify(snapshot, null, 2)}\n`);
  const markdownPath = writeFile("docs/p4-spend-attribution-report.md", renderMarkdown(snapshot));

  process.stdout.write(`${JSON.stringify({
    generatedAt: snapshot.generatedAt,
    outputs: {
      snapshotJson: jsonPath,
      reportMarkdown: markdownPath
    },
    anomalyAlerts: snapshot.anomalies.alertCount
  }, null, 2)}\n`);
}

main();
