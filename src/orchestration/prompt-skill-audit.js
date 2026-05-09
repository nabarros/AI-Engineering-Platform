import fs from "node:fs";
import path from "node:path";

const MAX_AUDIT_COUNT = 25;

const PATH_REFERENCE_PATTERN = /(\.github\/skills\/[a-z0-9-]+\/SKILL\.md|\.ai\/skills\/[a-z0-9-]+\.md)/gi;

const ROLE_ALLOWLIST = Object.freeze({
  backend: new Set([
    ".ai/skills/api-design.md",
    ".ai/skills/database-patterns.md",
    ".ai/skills/auth-patterns.md",
    ".ai/skills/refactoring-rules.md",
    ".ai/skills/testing-jest.md",
    ".ai/skills/performance-optimization.md"
  ]),
  frontend: new Set([
    ".ai/skills/react-patterns.md",
    ".ai/skills/refactoring-rules.md",
    ".ai/skills/testing-jest.md",
    ".ai/skills/performance-optimization.md"
  ]),
  "ui-ux": new Set([
    ".ai/skills/react-patterns.md",
    ".ai/skills/testing-jest.md",
    ".ai/skills/refactoring-rules.md"
  ]),
  sre: new Set([
    ".ai/skills/performance-optimization.md",
    ".ai/skills/debugging-node.md"
  ]),
  router: new Set([
    ".ai/skills/api-design.md",
    ".ai/skills/react-patterns.md",
    ".ai/skills/database-patterns.md",
    ".ai/skills/auth-patterns.md",
    ".ai/skills/refactoring-rules.md",
    ".ai/skills/performance-optimization.md"
  ])
});

function normalizePath(value) {
  return String(value || "").replaceAll("\\", "/");
}

function fileExists(workspaceRoot, relativePath) {
  return fs.existsSync(path.join(workspaceRoot, relativePath));
}

function walkFiles(rootDir, matcher) {
  const results = [];

  function visit(currentDir) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const next = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        visit(next);
      } else if (matcher(next)) {
        results.push(next);
      }
    }
  }

  if (fs.existsSync(rootDir)) {
    visit(rootDir);
  }

  return results;
}

function inferRoleFromPath(relativePath) {
  const normalized = normalizePath(relativePath).toLowerCase();
  if (normalized.includes("backend")) return "backend";
  if (normalized.includes("frontend")) return "frontend";
  if (normalized.includes("ui-ux")) return "ui-ux";
  if (normalized.includes("sre")) return "sre";
  if (normalized.includes("router")) return "router";
  return "general";
}

function extractSkillReferences(content) {
  const references = [];
  let match = PATH_REFERENCE_PATTERN.exec(content);
  while (match) {
    references.push(match[1]);
    match = PATH_REFERENCE_PATTERN.exec(content);
  }
  PATH_REFERENCE_PATTERN.lastIndex = 0;
  return references.map((reference) => normalizePath(reference));
}

function toArtifactMarkdown(report) {
  const lines = [
    "# Prompt Skill Audit (Top 25)",
    "",
    `- generatedAt: ${new Date(report.generatedAt).toISOString()}`,
    `- requestedCount: ${report.requestedCount}`,
    `- auditedCount: ${report.auditedCount}`,
    `- filesWithIssues: ${report.summary.filesWithIssues}`,
    "",
    "## Remediation List",
    ""
  ];

  if (report.remediationList.length === 0) {
    lines.push("- No remediation required for audited prompts.");
  } else {
    for (const item of report.remediationList) {
      lines.push(`- ${item.path}: ${item.action} (${item.reason})`);
    }
  }

  lines.push("", "## Prompt Mapping", "");
  for (const item of report.auditedPrompts) {
    lines.push(`- ${item.path}`);
    lines.push(`  - role: ${item.role}`);
    lines.push(`  - skillReferences: ${item.skillReferences.join(", ") || "none"}`);
    lines.push(`  - unnecessarySkillReferences: ${item.unnecessarySkillReferences.join(", ") || "none"}`);
  }

  return `${lines.join("\n")}\n`;
}

export function auditTopPromptSkillReferences({ workspaceRoot, requestedCount = MAX_AUDIT_COUNT } = {}) {
  const root = path.resolve(String(workspaceRoot || process.cwd()));
  const candidatePaths = [];

  const agentFiles = walkFiles(path.join(root, ".github/agents"), (filePath) => filePath.endsWith(".agent.md"));
  const promptFiles = walkFiles(path.join(root, ".github/prompts"), (filePath) => filePath.endsWith(".prompt.md"));
  const skillFiles = walkFiles(path.join(root, ".github/skills"), (filePath) => filePath.endsWith("/SKILL.md"));
  const instructionFiles = walkFiles(path.join(root, ".github/instructions"), (filePath) => filePath.endsWith(".instructions.md"));

  const explicitControlFiles = [
    ".github/copilot-instructions.md",
    "COPILOT_INSTRUCTIONS.md",
    "CLAUDE.md",
    "AGENT_GUIDE.md",
    "README.md"
  ]
    .map((relativePath) => path.join(root, relativePath))
    .filter((absolutePath) => fs.existsSync(absolutePath));

  candidatePaths.push(...agentFiles, ...promptFiles, ...skillFiles, ...instructionFiles, ...explicitControlFiles);

  const uniqueCandidates = [...new Set(candidatePaths.map((item) => normalizePath(path.relative(root, item))))].sort();
  const auditedPaths = uniqueCandidates.slice(0, Math.max(1, requestedCount));

  const auditedPrompts = [];
  const remediationList = [];

  for (const relativePath of auditedPaths) {
    const absolutePath = path.join(root, relativePath);
    const content = fs.readFileSync(absolutePath, "utf8");
    const role = inferRoleFromPath(relativePath);
    const skillReferences = extractSkillReferences(content);

    const duplicates = skillReferences.filter((reference, index) => skillReferences.indexOf(reference) !== index);
    const unknownReferences = skillReferences.filter((reference) => !fileExists(root, reference));

    const allowlist = ROLE_ALLOWLIST[role] || null;
    const outOfScopeReferences = allowlist
      ? skillReferences.filter((reference) => reference.startsWith(".ai/skills/") && !allowlist.has(reference))
      : [];

    const unnecessarySkillReferences = [...new Set([...duplicates, ...unknownReferences, ...outOfScopeReferences])].sort();
    const actions = [];

    for (const reference of duplicates) {
      actions.push(`remove duplicate reference ${reference}`);
    }
    for (const reference of unknownReferences) {
      actions.push(`remove or correct unknown reference ${reference}`);
    }
    for (const reference of outOfScopeReferences) {
      actions.push(`replace out-of-scope reference ${reference} with allowlisted role skill`);
    }

    if (actions.length === 0) {
      actions.push("no change required");
    } else {
      remediationList.push({
        path: relativePath,
        action: actions.join("; "),
        reason: "unnecessary skill references detected"
      });
    }

    auditedPrompts.push({
      path: relativePath,
      role,
      skillReferences,
      unnecessarySkillReferences,
      recommendedActions: actions
    });
  }

  const filesWithIssues = auditedPrompts.filter((item) => item.unnecessarySkillReferences.length > 0).length;
  const report = {
    generatedAt: Date.now(),
    requestedCount,
    auditedCount: auditedPrompts.length,
    candidateCount: uniqueCandidates.length,
    auditedPrompts,
    remediationList,
    summary: {
      filesWithIssues,
      totalUnnecessaryReferences: auditedPrompts.reduce((sum, item) => sum + item.unnecessarySkillReferences.length, 0),
      passRate: auditedPrompts.length > 0 ? Number(((auditedPrompts.length - filesWithIssues) / auditedPrompts.length).toFixed(4)) : 0
    }
  };

  return {
    report,
    markdown: toArtifactMarkdown(report)
  };
}
