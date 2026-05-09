#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import {
  buildCrossPriorityBenchmarkReport,
  createDeterministicCrossPriorityBenchmarkSample,
  renderCrossPriorityBenchmarkMarkdown
} from "../src/orchestration/index.js";

function readJsonIfPresent(relativePath) {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
}

function writeFile(relativePath, content) {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content);
  return path.relative(process.cwd(), absolutePath);
}

function buildInputsFromArtifacts() {
  const baseline = createDeterministicCrossPriorityBenchmarkSample();
  const retrievalArtifact = readJsonIfPresent("data/p3-retrieval-quality-dashboard.json");

  if (Array.isArray(retrievalArtifact?.report?.samples)) {
    baseline.retrievalSamples = retrievalArtifact.report.samples;
    baseline.generatedAt = retrievalArtifact.report.generatedAt || baseline.generatedAt;
  }

  return baseline;
}

function main() {
  const inputs = buildInputsFromArtifacts();
  const report = buildCrossPriorityBenchmarkReport({
    generatedAt: inputs.generatedAt,
    executions: inputs.executions,
    retrievalSamples: inputs.retrievalSamples
  });

  const signoffMemo = readJsonIfPresent("data/p4-gate-signoff-memo.json");
  const payload = {
    report,
    governanceSignals: {
      qualityRetentionDelta: signoffMemo?.benchmarkSummary?.qualityRetentionDelta ?? null
    }
  };

  const jsonOutputPath = writeFile(
    "data/cross-priority-benchmark-report.json",
    `${JSON.stringify(payload, null, 2)}\n`
  );
  const markdownOutputPath = writeFile(
    "docs/cross-priority-benchmark-report.md",
    renderCrossPriorityBenchmarkMarkdown(report)
  );

  process.stdout.write(`${JSON.stringify({
    generatedAt: report.generatedAt,
    readiness: report.readiness.status,
    outputs: {
      benchmarkJson: jsonOutputPath,
      benchmarkMarkdown: markdownOutputPath
    }
  }, null, 2)}\n`);
}

main();
