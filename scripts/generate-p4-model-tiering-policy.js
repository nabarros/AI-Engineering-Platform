#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import {
  MODEL_TIER_POLICY_VERSION,
  buildTieringRoutingMatrix
} from "../src/orchestration/index.js";

function writeFile(relativePath, content) {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content);
  return path.relative(process.cwd(), absolutePath);
}

function renderMarkdown(matrix) {
  const rows = matrix.rows
    .slice(0, 30)
    .map((row) => `| ${row.stepType} | ${row.risk} | ${row.confidenceBand} | ${row.tier} |`)
    .join("\n");

  return [
    "# P4 Model Tiering Policy",
    "",
    `- policyVersion: ${MODEL_TIER_POLICY_VERSION}`,
    `- generatedAt: ${new Date(matrix.generatedAt).toISOString()}`,
    `- rows: ${matrix.rows.length}`,
    "",
    "## Decision Matrix (Sample)",
    "",
    "| Step Type | Risk | Confidence Band | Tier |",
    "|---|---|---|---|",
    rows,
    "",
    "## Notes",
    "",
    "- High and critical risk always escalate to HIGH tier.",
    "- Low confidence always escalates to HIGH tier.",
    "- Low-risk and high-confidence paths can use LOW tier.",
    ""
  ].join("\n");
}

function main() {
  const matrix = buildTieringRoutingMatrix();

  const jsonPath = writeFile("data/p4-model-tiering-routing-matrix.json", `${JSON.stringify(matrix, null, 2)}\n`);
  const markdownPath = writeFile("docs/p4-model-tiering-policy.md", renderMarkdown(matrix));

  process.stdout.write(`${JSON.stringify({
    generatedAt: matrix.generatedAt,
    outputs: {
      routingMatrixJson: jsonPath,
      policyMarkdown: markdownPath
    }
  }, null, 2)}\n`);
}

main();
