import fs from "node:fs";
import path from "node:path";
import { auditTopPromptSkillReferences } from "../src/orchestration/prompt-skill-audit.js";

function ensureDirectoryFor(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function main() {
  const outputJsonArg = process.argv[2] || "data/prompt-skill-audit-top25.json";
  const outputMarkdownArg = process.argv[3] || "docs/prompt-skill-audit-top25.md";
  const outputJsonPath = path.resolve(process.cwd(), outputJsonArg);
  const outputMarkdownPath = path.resolve(process.cwd(), outputMarkdownArg);

  const { report, markdown } = auditTopPromptSkillReferences({
    workspaceRoot: process.cwd(),
    requestedCount: 25
  });

  ensureDirectoryFor(outputJsonPath);
  ensureDirectoryFor(outputMarkdownPath);

  fs.writeFileSync(outputJsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(outputMarkdownPath, markdown);

  process.stdout.write(`${JSON.stringify({
    outputJson: path.relative(process.cwd(), outputJsonPath),
    outputMarkdown: path.relative(process.cwd(), outputMarkdownPath),
    auditedCount: report.auditedCount,
    requestedCount: report.requestedCount,
    filesWithIssues: report.summary.filesWithIssues
  }, null, 2)}\n`);
}

main();
