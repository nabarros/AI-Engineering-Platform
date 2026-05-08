import { normalizeRisk } from "./capability-registry.js";

const HIGH_OR_CRITICAL = new Set(["HIGH", "CRITICAL"]);
const FORBIDDEN_PATTERNS = [
  "/.ai/instructions/",
  "/.github/workflows/",
  "/infra/",
  "hardcoded secret",
  "bypass auth"
];

export function assessRisk(task) {
  const risk = normalizeRisk(task.risk || "MEDIUM");
  const description = String(task.description || "").toLowerCase();

  if (description.includes("production") || description.includes("database migration") || description.includes("rotate secret")) {
    return "CRITICAL";
  }
  if (description.includes("auth") || description.includes("authorization") || description.includes("schema")) {
    return "HIGH";
  }
  return risk;
}

export function enforcePolicy(task, options = {}) {
  const violations = [];
  const description = String(task.description || "").toLowerCase();
  const risk = assessRisk(task);

  for (const pattern of FORBIDDEN_PATTERNS) {
    if (description.includes(pattern.toLowerCase())) {
      violations.push({
        severity: "BLOCKER",
        code: "FORBIDDEN_OPERATION",
        message: `Task appears to include forbidden pattern: ${pattern}`
      });
    }
  }

  if (HIGH_OR_CRITICAL.has(risk) && options.confirmed !== true) {
    violations.push({
      severity: "BLOCKER",
      code: "MISSING_CONFIRMATION",
      message: `${risk} risk task requires explicit confirmation before execution.`
    });
  }

  return {
    risk,
    allowed: violations.length === 0,
    violations
  };
}
