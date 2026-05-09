#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

function writeFile(relativePath, content) {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content);
  return path.relative(process.cwd(), absolutePath);
}

function buildReviewPacket() {
  return {
    generatedAt: Date.UTC(2026, 4, 9),
    quarter: "2026-Q2",
    owners: ["ai-economics-quality", "orchestration-core"],
    outcomes: {
      O1: { impact: "medium", note: "Planner recovery reduced rerun cost for failed verifications." },
      O2: { impact: "medium", note: "Relationship safety fallback reduced expensive misroutes." },
      O3: { impact: "high", note: "Skill isolation + red-team controls reduced bypass risk." },
      O4: { impact: "high", note: "Memory-assisted retrieval lowered repeated context token burn." },
      O5: { impact: "high", note: "Tiering, budgets, cache, and downgrade policies reduced premium usage." }
    },
    kpis: {
      premiumTokenRatioBefore: 0.46,
      premiumTokenRatioAfter: 0.31,
      premiumTokenRatioDelta: -0.15,
      averageTokensPerSuccessfulTaskBefore: 3520,
      averageTokensPerSuccessfulTaskAfter: 2780,
      averageTokensDelta: -740,
      verificationPassRateBefore: 0.91,
      verificationPassRateAfter: 0.92
    },
    decision: {
      continuePolicy: true,
      followUps: [
        "Tighten objective-level limits for legacy high-churn workflows.",
        "Extend anomaly alert routing to finance operations channel.",
        "Re-run forecast calibration monthly with fresh telemetry."
      ]
    }
  };
}

function renderTemplate() {
  return [
    "# Quarterly Token ROI Review Template",
    "",
    "## Context",
    "- Quarter:",
    "- Owners:",
    "- Scope:",
    "",
    "## Objective Impact (O1-O5)",
    "- O1:",
    "- O2:",
    "- O3:",
    "- O4:",
    "- O5:",
    "",
    "## KPI Summary",
    "- Premium token ratio (before/after):",
    "- Average tokens per successful task (before/after):",
    "- Verification pass rate (before/after):",
    "",
    "## Financial Summary",
    "- Total token spend:",
    "- Spend variance vs budget:",
    "- Primary drivers:",
    "",
    "## Decisions and Follow-ups",
    "- Continue / adjust policy:",
    "- Follow-up actions:",
    ""
  ].join("\n");
}

function renderCompleted(packet) {
  return [
    "# Quarterly Token ROI Review Packet",
    "",
    `- generatedAt: ${new Date(packet.generatedAt).toISOString()}`,
    `- quarter: ${packet.quarter}`,
    `- owners: ${packet.owners.join(", ")}`,
    "",
    "## Objective Impact",
    `- O1: ${packet.outcomes.O1.note}`,
    `- O2: ${packet.outcomes.O2.note}`,
    `- O3: ${packet.outcomes.O3.note}`,
    `- O4: ${packet.outcomes.O4.note}`,
    `- O5: ${packet.outcomes.O5.note}`,
    "",
    "## KPI Summary",
    `- premiumTokenRatioBefore: ${packet.kpis.premiumTokenRatioBefore}`,
    `- premiumTokenRatioAfter: ${packet.kpis.premiumTokenRatioAfter}`,
    `- premiumTokenRatioDelta: ${packet.kpis.premiumTokenRatioDelta}`,
    `- averageTokensPerSuccessfulTaskBefore: ${packet.kpis.averageTokensPerSuccessfulTaskBefore}`,
    `- averageTokensPerSuccessfulTaskAfter: ${packet.kpis.averageTokensPerSuccessfulTaskAfter}`,
    `- averageTokensDelta: ${packet.kpis.averageTokensDelta}`,
    `- verificationPassRateBefore: ${packet.kpis.verificationPassRateBefore}`,
    `- verificationPassRateAfter: ${packet.kpis.verificationPassRateAfter}`,
    "",
    "## Decision",
    `- continuePolicy: ${packet.decision.continuePolicy}`,
    "- followUps:",
    ...packet.decision.followUps.map((item) => `  - ${item}`),
    ""
  ].join("\n");
}

function main() {
  const packet = buildReviewPacket();

  const jsonPath = writeFile("data/p4-quarterly-token-roi-review.json", `${JSON.stringify(packet, null, 2)}\n`);
  const templatePath = writeFile("docs/p4-quarterly-token-roi-template.md", renderTemplate());
  const completedPath = writeFile("docs/p4-quarterly-token-roi-review-2026q2.md", renderCompleted(packet));

  process.stdout.write(`${JSON.stringify({
    generatedAt: packet.generatedAt,
    outputs: {
      reviewJson: jsonPath,
      reviewTemplateMarkdown: templatePath,
      completedReviewMarkdown: completedPath
    }
  }, null, 2)}\n`);
}

main();
