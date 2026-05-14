export function verifyExecution(evidence) {
  const findings = [];

  if (!evidence) {
    findings.push({ severity: "HIGH", code: "NO_EVIDENCE", message: "No execution evidence was provided for verification." });
    return { pass: false, findings, gateResults: {} };
  }

  if (evidence.testsPassed !== true) {
    findings.push({ severity: "HIGH", code: "MISSING_TESTS", message: "Execution evidence does not confirm passing tests." });
  }

  if (evidence.securityChecksPassed !== true) {
    findings.push({ severity: "CRITICAL", code: "SECURITY_UNVERIFIED", message: "Security checks are missing or failed." });
  }

  if (evidence.contractChecksPassed !== true) {
    findings.push({ severity: "MEDIUM", code: "CONTRACT_UNVERIFIED", message: "Contract or boundary checks are missing." });
  }

  if (evidence.errorHandlingValidated !== true) {
    findings.push({ severity: "MEDIUM", code: "ERROR_HANDLING_GAP", message: "Error handling validation is missing." });
  }

  if (typeof evidence.qualityScore === "number" && evidence.qualityScore < 0.8) {
    findings.push({ severity: "MEDIUM", code: "LOW_QUALITY_SCORE", message: "Quality score is below the required threshold (0.8)." });
  }

  if (evidence.aiSafetyChecked === false) {
    findings.push({ severity: "HIGH", code: "AI_SAFETY_UNVERIFIED", message: "AI safety checks failed or were not performed for LLM-related changes." });
  }

  if (evidence.architectureReviewed === false) {
    findings.push({ severity: "MEDIUM", code: "ARCHITECTURE_UNREVIEWED", message: "Architecture impact was not reviewed for structural changes." });
  }

  if (typeof evidence.tokenBudgetExceeded === "boolean" && evidence.tokenBudgetExceeded) {
    findings.push({ severity: "LOW", code: "TOKEN_BUDGET_EXCEEDED", message: "Execution exceeded the allocated token budget tier." });
  }

  const blocking = findings.filter((f) => f.severity === "CRITICAL" || f.severity === "HIGH");
  const advisory = findings.filter((f) => f.severity === "MEDIUM" || f.severity === "LOW");

  return {
    pass: blocking.length === 0,
    findings,
    gateResults: {
      blockingCount: blocking.length,
      advisoryCount: advisory.length,
      totalFindings: findings.length
    }
  };
}
