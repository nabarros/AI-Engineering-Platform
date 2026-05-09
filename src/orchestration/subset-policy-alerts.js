const ALERTABLE_ENVIRONMENTS = new Set(["staging", "production"]);

export const SUBSET_POLICY_ALERT_RULES = Object.freeze({
  staging: Object.freeze({
    severity: "high",
    pageOnViolation: true,
    routeTo: "agent-governance-oncall",
    runbookPath: "docs/phase2-skill-determinism-runbook.md"
  }),
  production: Object.freeze({
    severity: "critical",
    pageOnViolation: true,
    routeTo: "agent-governance-oncall",
    runbookPath: "docs/phase2-skill-determinism-runbook.md"
  })
});

function normalizeEnvironment(environment) {
  return String(environment || "development").trim().toLowerCase();
}

function normalizeReasonCodes(reasonCodes) {
  if (!Array.isArray(reasonCodes)) {
    return [];
  }

  return [...new Set(reasonCodes.map((code) => String(code || "").trim()).filter(Boolean))].sort();
}

export function evaluateSubsetPolicyViolationAlert({
  requestId,
  environment,
  selectedAgent,
  deniedSkills = [],
  blockedReasonCodes = [],
  timestampMs = Date.now()
} = {}) {
  const normalizedEnvironment = normalizeEnvironment(environment);
  const rule = SUBSET_POLICY_ALERT_RULES[normalizedEnvironment];
  const normalizedDeniedSkills = [...new Set((Array.isArray(deniedSkills) ? deniedSkills : [])
    .map((skill) => String(skill || "").trim().toLowerCase())
    .filter(Boolean))].sort();
  const normalizedReasonCodes = normalizeReasonCodes(blockedReasonCodes);
  const violationDetected = normalizedDeniedSkills.length > 0 || normalizedReasonCodes.length > 0;

  if (!ALERTABLE_ENVIRONMENTS.has(normalizedEnvironment) || !rule || !violationDetected) {
    return {
      triggered: false,
      environment: normalizedEnvironment,
      reason: ALERTABLE_ENVIRONMENTS.has(normalizedEnvironment) ? "no_violation_detected" : "environment_not_alertable"
    };
  }

  return {
    triggered: true,
    environment: normalizedEnvironment,
    timestampMs,
    alertName: "subset-policy-violation",
    severity: rule.severity,
    page: Boolean(rule.pageOnViolation),
    routeTo: rule.routeTo,
    requestId: String(requestId || ""),
    selectedAgent: String(selectedAgent || ""),
    deniedSkills: normalizedDeniedSkills,
    blockedReasonCodes: normalizedReasonCodes,
    runbookPath: rule.runbookPath
  };
}
