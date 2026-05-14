import { normalizeRisk } from "./capability-registry.js";

const HIGH_OR_CRITICAL = new Set(["HIGH", "CRITICAL"]);
const FORBIDDEN_PATTERNS = [
  "/.ai/instructions/",
  "/.github/workflows/",
  "/infra/",
  "hardcoded secret",
  "bypass auth"
];

const RISK_ESCALATION_TRIGGERS = Object.freeze({
  CRITICAL: [
    "production", "database migration", "rotate secret", "delete database",
    "drop table", "production deployment", "destroy infrastructure"
  ],
  HIGH: [
    "auth", "authorization", "schema change", "api contract",
    "model deployment", "prompt injection", "pii", "encryption",
    "service boundary", "breaking change"
  ]
});

export function assessRisk(task) {
  const risk = normalizeRisk(task.risk || "MEDIUM");
  const description = String(task.description || "").toLowerCase();

  for (const trigger of RISK_ESCALATION_TRIGGERS.CRITICAL) {
    if (description.includes(trigger)) return "CRITICAL";
  }

  for (const trigger of RISK_ESCALATION_TRIGGERS.HIGH) {
    if (description.includes(trigger)) return "HIGH";
  }

  return risk;
}

export function enforcePolicy(task, options = {}) {
  const violations = [];
  const warnings = [];
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

  if (description.includes("model") && description.includes("production")) {
    warnings.push({
      severity: "WARNING",
      code: "AI_MODEL_PRODUCTION",
      message: "Model changes targeting production require AI safety review."
    });
  }

  if (description.includes("prompt") && (description.includes("system") || description.includes("production"))) {
    warnings.push({
      severity: "WARNING",
      code: "PROMPT_PRODUCTION_CHANGE",
      message: "System prompt changes require review for injection resistance and alignment."
    });
  }

  return {
    risk,
    allowed: violations.length === 0,
    violations,
    warnings
  };
}
