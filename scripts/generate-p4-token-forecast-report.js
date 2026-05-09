#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import {
  buildTokenForecastValidationReport,
  createTokenForecaster
} from "../src/orchestration/index.js";

function writeFile(relativePath, content) {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content);
  return path.relative(process.cwd(), absolutePath);
}

function buildSampleTelemetry() {
  return [
    { stepType: "routing", risk: "LOW", modelTier: "LOW", objective: "objective:review", tokens: 520 },
    { stepType: "routing", risk: "LOW", modelTier: "LOW", objective: "objective:review", tokens: 560 },
    { stepType: "routing", risk: "MEDIUM", modelTier: "MEDIUM", objective: "objective:backend", tokens: 850 },
    { stepType: "execution", risk: "MEDIUM", modelTier: "MEDIUM", objective: "objective:backend", tokens: 2100 },
    { stepType: "execution", risk: "MEDIUM", modelTier: "MEDIUM", objective: "objective:backend", tokens: 1950 },
    { stepType: "execution", risk: "LOW", modelTier: "LOW", objective: "objective:review", tokens: 1180 },
    { stepType: "verification", risk: "LOW", modelTier: "LOW", objective: "objective:review", tokens: 700 },
    { stepType: "verification", risk: "MEDIUM", modelTier: "MEDIUM", objective: "objective:backend", tokens: 880 }
  ];
}

function buildValidationSamples() {
  return [
    { stepType: "routing", risk: "LOW", modelTier: "LOW", objective: "objective:review", actualTokens: 550 },
    { stepType: "routing", risk: "MEDIUM", modelTier: "MEDIUM", objective: "objective:backend", actualTokens: 840 },
    { stepType: "execution", risk: "MEDIUM", modelTier: "MEDIUM", objective: "objective:backend", actualTokens: 2050 },
    { stepType: "execution", risk: "LOW", modelTier: "LOW", objective: "objective:review", actualTokens: 1210 },
    { stepType: "verification", risk: "LOW", modelTier: "LOW", objective: "objective:review", actualTokens: 710 },
    { stepType: "verification", risk: "MEDIUM", modelTier: "MEDIUM", objective: "objective:backend", actualTokens: 910 }
  ];
}

function renderMarkdown(report) {
  const rows = report.samples
    .map((sample) => `| ${sample.stepType} | ${sample.risk} | ${sample.modelTier} | ${sample.actualTokens} | ${sample.predictedTokens} | ${sample.errorBound} | ${sample.withinErrorBound ? "yes" : "no"} |`)
    .join("\n");

  return [
    "# P4 Token Forecast Validation Report",
    "",
    `- generatedAt: ${new Date(report.generatedAt).toISOString()}`,
    `- status: ${report.status}`,
    `- sampleCount: ${report.sampleCount}`,
    `- meanAbsolutePercentageError: ${report.metrics.meanAbsolutePercentageError}`,
    `- coverageWithinErrorBound: ${report.metrics.coverageWithinErrorBound}`,
    "",
    "## Thresholds",
    "",
    `- maxMeanAbsolutePercentageError: ${report.thresholds.maxMeanAbsolutePercentageError}`,
    `- minCoverageWithinErrorBound: ${report.thresholds.minCoverageWithinErrorBound}`,
    "",
    "## Validation Samples",
    "",
    "| Step Type | Risk | Tier | Actual | Predicted | Error Bound | Within Bound |",
    "|---|---|---|---:|---:|---:|---|",
    rows,
    ""
  ].join("\n");
}

function main() {
  const forecaster = createTokenForecaster();
  for (const sample of buildSampleTelemetry()) {
    forecaster.recordStepTelemetry(sample);
  }

  const report = buildTokenForecastValidationReport({
    forecaster,
    validationSamples: buildValidationSamples(),
    generatedAt: Date.UTC(2026, 4, 9)
  });

  const jsonPath = writeFile("data/p4-token-forecast-validation.json", `${JSON.stringify({
    report,
    forecasterSnapshot: forecaster.snapshot()
  }, null, 2)}\n`);
  const markdownPath = writeFile("docs/p4-token-forecast-validation.md", renderMarkdown(report));

  process.stdout.write(`${JSON.stringify({
    generatedAt: report.generatedAt,
    outputs: {
      reportJson: jsonPath,
      reportMarkdown: markdownPath
    },
    status: report.status
  }, null, 2)}\n`);
}

main();
