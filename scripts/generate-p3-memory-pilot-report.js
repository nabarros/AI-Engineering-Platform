#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import {
  buildMemoryAssistedPilotReport,
  buildRetrievalQualityDashboard,
  buildRetrievalQualityReport,
  createDeterministicMemoryPilotSample,
  renderMemoryPilotMarkdown
} from "../src/orchestration/index.js";

function writeFile(relativePath, content) {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content);
  return path.relative(process.cwd(), absolutePath);
}

function main() {
  const sample = createDeterministicMemoryPilotSample();
  const report = buildMemoryAssistedPilotReport(sample);

  const qualityReport = buildRetrievalQualityReport([
    ...sample.baseline,
    ...sample.memoryAssisted
  ], {
    generatedAt: sample.generatedAt
  });
  const qualityDashboard = buildRetrievalQualityDashboard(qualityReport);

  const jsonOutputPath = writeFile(
    "data/p3-memory-assisted-pilot-report.json",
    `${JSON.stringify(report, null, 2)}\n`
  );
  const dashboardOutputPath = writeFile(
    "data/p3-retrieval-quality-dashboard.json",
    `${JSON.stringify({
      report: qualityReport,
      dashboard: qualityDashboard
    }, null, 2)}\n`
  );
  const markdownOutputPath = writeFile(
    "docs/p3-memory-assisted-pilot-report.md",
    renderMemoryPilotMarkdown(report)
  );

  process.stdout.write(`${JSON.stringify({
    generatedAt: report.generatedAt,
    outputs: {
      pilotReportJson: jsonOutputPath,
      retrievalDashboardJson: dashboardOutputPath,
      pilotReportMarkdown: markdownOutputPath
    },
    delta: report.delta
  }, null, 2)}\n`);
}

main();
