export function verifyExecution(evidence) {
  const findings = [];

  if (!evidence) {
    findings.push({ severity: "HIGH", code: "NO_EVIDENCE", message: "No execution evidence was provided for verification." });
    return { pass: false, findings };
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

  return {
    pass: findings.length === 0,
    findings
  };
}
